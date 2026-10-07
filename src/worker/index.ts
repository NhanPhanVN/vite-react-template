import { Hono } from "hono";

type ShipmentRole = "sender" | "receiver";
type PackageSide = "front" | "back";
type ShipmentStatus = "shipped" | "on_the_way" | "return";

type ShipmentRow = {
	id: string;
	title: string;
	status: ShipmentStatus;
	receiver_name: string;
	shipped_on: string | null;
	received_confirmed_at: string | null;
	created_at: string;
};

type EvidenceRow = {
	role: ShipmentRole;
	side: PackageSide;
	image_id: string;
	image_url: string;
	page_url: string;
	delete_url: string;
	created_at: string;
};

const app = new Hono<{ Bindings: Env & { my_binding: D1Database } }>();

const PICRD_UPLOAD_URL = "https://picrd.com/api/upload";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
]);

app.onError((error, c) => {
	console.error("Shipping API request failed:", error);
	return c.json({ error: "The shipping service is temporarily unavailable." }, 500);
});

app.post("/api/picrd/upload", async (c) => {
	let form: FormData;
	try {
		form = await c.req.formData();
	} catch {
		return c.json({ error: "Upload a valid multipart form with an image file." }, 400);
	}

	const file = form.get("file");
	if (!(file instanceof File)) {
		return c.json({ error: "Choose an image file to upload." }, 400);
	}
	if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
		return c.json({ error: "Choose a PNG, JPEG, WebP, or GIF image." }, 400);
	}
	if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
		return c.json({ error: "Images must be larger than 0 bytes and no more than 10 MB." }, 400);
	}

	const picrdForm = new FormData();
	picrdForm.append("file", file, file.name);
	picrdForm.append("visibility", "unlisted");

	let picrdResponse: Response;
	try {
		picrdResponse = await fetch(PICRD_UPLOAD_URL, {
			method: "POST",
			body: picrdForm,
		});
	} catch (error) {
		console.error("Picrd upload request failed:", error);
		return c.json({ error: "Could not connect to Picrd. Please try again." }, 502);
	}

	const responseBody = await picrdResponse.text();
	let upload: unknown;
	try {
		upload = JSON.parse(responseBody);
	} catch {
		console.error("Picrd returned a non-JSON upload response.");
		return c.json({ error: "Picrd returned an invalid upload response." }, 502);
	}

	if (!picrdResponse.ok) {
		const message = isRecord(upload)
			? typeof upload.detail === "string"
				? upload.detail
				: typeof upload.error === "string"
					? upload.error
					: `Picrd rejected the upload (${picrdResponse.status}).`
			: `Picrd rejected the upload (${picrdResponse.status}).`;
		const status = picrdResponse.status === 429 ? 429 : 502;
		return c.json({ error: message }, status);
	}

	if (
		!isRecord(upload) ||
		typeof upload.image_id !== "string" ||
		typeof upload.image_url !== "string" ||
		typeof upload.page_url !== "string" ||
		typeof upload.delete_url !== "string" ||
		!isPicrdUpload(
			upload.image_id,
			upload.image_url,
			upload.page_url,
			upload.delete_url,
		)
	) {
		console.error("Picrd returned invalid image URLs.");
		return c.json({ error: "Picrd returned invalid image details." }, 502);
	}

	return c.json({
		image_id: upload.image_id,
		image_url: upload.image_url,
		page_url: upload.page_url,
		delete_url: upload.delete_url,
	});
});

app.get("/api/shipments", async (c) => {
	const { results: shipments } = await c.env.my_binding
		.prepare(
			"SELECT id, title, status, receiver_name, shipped_on, received_confirmed_at, created_at FROM shipments ORDER BY created_at DESC, id DESC",
		)
		.all<ShipmentRow>();

	return c.json({ shipments });
});

app.post("/api/shipments", async (c) => {
	const payload: unknown = await c.req.json().catch(() => null);
	if (
		!isRecord(payload) ||
		typeof payload.title !== "string" ||
		typeof payload.receiver_name !== "string" ||
		typeof payload.shipped_on !== "string"
	) {
		return c.json(
			{ error: "Provide a shipment title, receiver name, and shipped date." },
			400,
		);
	}

	const title = payload.title.trim();
	if (!title || title.length > 120) {
		return c.json({ error: "The title must be between 1 and 120 characters." }, 400);
	}
	const receiverName = payload.receiver_name.trim();
	if (!receiverName || receiverName.length > 120) {
		return c.json(
			{ error: "The receiver name must be between 1 and 120 characters." },
			400,
		);
	}
	if (!isDateOnly(payload.shipped_on)) {
		return c.json({ error: "Choose a valid shipped date." }, 400);
	}

	const id = crypto.randomUUID();
	const shipment = await c.env.my_binding
		.prepare(
			"INSERT INTO shipments (id, title, receiver_name, shipped_on) VALUES (?, ?, ?, ?) RETURNING id, title, status, receiver_name, shipped_on, received_confirmed_at, created_at",
		)
		.bind(id, title, receiverName, payload.shipped_on)
		.first<ShipmentRow>();

	if (!shipment) {
		return c.json({ error: "Could not create the shipment." }, 500);
	}

	return c.json({ shipment: { ...shipment, evidence: [] } }, 201);
});

app.get("/api/shipments/:id", async (c) => {
	const id = c.req.param("id");
	if (!isShipmentId(id)) return c.json({ error: "Shipment not found." }, 404);

	const shipment = await c.env.my_binding
		.prepare(
			"SELECT id, title, status, receiver_name, shipped_on, received_confirmed_at, created_at FROM shipments WHERE id = ?",
		)
		.bind(id)
		.first<ShipmentRow>();
	if (!shipment) return c.json({ error: "Shipment not found." }, 404);

	const { results: evidence } = await c.env.my_binding
		.prepare(
			"SELECT role, side, image_id, image_url, page_url, delete_url, created_at FROM shipment_evidence WHERE shipment_id = ? ORDER BY role, side",
		)
		.bind(id)
		.all<EvidenceRow>();

	return c.json({ shipment: { ...shipment, evidence } });
});

app.patch("/api/shipments/:id/status", async (c) => {
	const id = c.req.param("id");
	if (!isShipmentId(id)) return c.json({ error: "Shipment not found." }, 404);

	const payload: unknown = await c.req.json().catch(() => null);
	if (!isRecord(payload) || !isStatus(payload.status)) {
		return c.json({ error: "Choose a valid shipment status." }, 400);
	}

	const shipment = await c.env.my_binding
		.prepare(
			"UPDATE shipments SET status = ? WHERE id = ? RETURNING id, title, status, receiver_name, shipped_on, received_confirmed_at, created_at",
		)
		.bind(payload.status, id)
		.first<ShipmentRow>();

	if (!shipment) return c.json({ error: "Shipment not found." }, 404);
	return c.json({ shipment });
});

app.patch("/api/shipments/:id/details", async (c) => {
	const id = c.req.param("id");
	if (!isShipmentId(id)) return c.json({ error: "Shipment not found." }, 404);

	const payload: unknown = await c.req.json().catch(() => null);
	if (
		!isRecord(payload) ||
		typeof payload.receiver_name !== "string" ||
		typeof payload.shipped_on !== "string"
	) {
		return c.json({ error: "Provide a receiver name and shipped date." }, 400);
	}

	const receiverName = payload.receiver_name.trim();
	if (!receiverName || receiverName.length > 120) {
		return c.json(
			{ error: "The receiver name must be between 1 and 120 characters." },
			400,
		);
	}
	if (!isDateOnly(payload.shipped_on)) {
		return c.json({ error: "Choose a valid shipped date." }, 400);
	}

	const shipment = await c.env.my_binding
		.prepare(
			"UPDATE shipments SET receiver_name = ?, shipped_on = ? WHERE id = ? RETURNING id, title, status, receiver_name, shipped_on, received_confirmed_at, created_at",
		)
		.bind(receiverName, payload.shipped_on, id)
		.first<ShipmentRow>();
	if (!shipment) return c.json({ error: "Shipment not found." }, 404);
	return c.json({ shipment });
});

app.post("/api/shipments/:id/confirm", async (c) => {
	const id = c.req.param("id");
	if (!isShipmentId(id)) return c.json({ error: "Shipment not found." }, 404);

	const shipment = await c.env.my_binding
		.prepare(
			"UPDATE shipments SET received_confirmed_at = COALESCE(received_confirmed_at, CURRENT_TIMESTAMP) WHERE id = ? RETURNING id, title, status, receiver_name, shipped_on, received_confirmed_at, created_at",
		)
		.bind(id)
		.first<ShipmentRow>();
	if (!shipment) return c.json({ error: "Shipment not found." }, 404);
	return c.json({ shipment });
});

app.post("/api/shipments/:id/evidence", async (c) => {
	const shipmentId = c.req.param("id");
	if (!isShipmentId(shipmentId)) {
		return c.json({ error: "Shipment not found." }, 404);
	}

	const payload: unknown = await c.req.json().catch(() => null);
	if (!isRecord(payload)) {
		return c.json({ error: "Invalid photo details." }, 400);
	}

	const { role, side, image_id, image_url, page_url, delete_url } = payload;
	if (
		!isRole(role) ||
		!isSide(side) ||
		typeof image_id !== "string" ||
		typeof image_url !== "string" ||
		typeof page_url !== "string" ||
		typeof delete_url !== "string" ||
		!isPicrdUpload(image_id, image_url, page_url, delete_url)
	) {
		return c.json({ error: "Picrd returned invalid photo details." }, 400);
	}

	const shipment = await c.env.my_binding
		.prepare("SELECT id FROM shipments WHERE id = ?")
		.bind(shipmentId)
		.first<{ id: string }>();
	if (!shipment) return c.json({ error: "Shipment not found." }, 404);

	const existing = await c.env.my_binding
		.prepare(
			"SELECT image_id FROM shipment_evidence WHERE shipment_id = ? AND role = ? AND side = ?",
		)
		.bind(shipmentId, role, side)
		.first<{ image_id: string }>();
	if (existing) {
		return c.json(
			{ error: "This photo slot is already filled. Delete its photo before replacing it." },
			409,
		);
	}

	const evidence = await c.env.my_binding
		.prepare(
			"INSERT INTO shipment_evidence (shipment_id, role, side, image_id, image_url, page_url, delete_url) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING role, side, image_id, image_url, page_url, delete_url, created_at",
		)
		.bind(shipmentId, role, side, image_id, image_url, page_url, delete_url)
		.first<EvidenceRow>();

	if (!evidence) return c.json({ error: "Could not save the photo URL." }, 500);
	return c.json({ evidence }, 201);
});

app.delete("/api/shipments/:id/evidence/:role/:side", async (c) => {
	const shipmentId = c.req.param("id");
	const role = c.req.param("role");
	const side = c.req.param("side");
	if (!isShipmentId(shipmentId)) {
		return c.json({ error: "Shipment not found." }, 404);
	}
	if (!isRole(role) || !isSide(side)) {
		return c.json({ error: "Photo slot not found." }, 404);
	}

	const result = await c.env.my_binding
		.prepare(
			"DELETE FROM shipment_evidence WHERE shipment_id = ? AND role = ? AND side = ?",
		)
		.bind(shipmentId, role, side)
		.run();
	if (!result.meta.changes) return c.json({ error: "Photo not found." }, 404);
	return c.json({ success: true });
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isShipmentId(value: string) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		value,
	);
}

function isRole(value: unknown): value is ShipmentRole {
	return value === "sender" || value === "receiver";
}

function isSide(value: unknown): value is PackageSide {
	return value === "front" || value === "back";
}

function isStatus(value: unknown): value is ShipmentStatus {
	return value === "shipped" || value === "on_the_way" || value === "return";
}

function isDateOnly(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isPicrdUpload(
	imageId: string,
	imageUrl: string,
	pageUrl: string,
	deleteUrl: string,
) {
	if (!/^[A-Za-z0-9_-]{1,80}$/.test(imageId)) return false;
	try {
		const image = new URL(imageUrl);
		const page = new URL(pageUrl);
		const deletion = new URL(deleteUrl);
		const imagePath = image.pathname.match(
			/^\/images\/([A-Za-z0-9_-]+)\.(png|jpe?g|webp|gif)$/i,
		);
		return (
			image.protocol === "https:" &&
			image.hostname === "i.picrd.com" &&
			!image.port &&
			!image.username &&
			!image.password &&
			imagePath?.[1] === imageId &&
			page.protocol === "https:" &&
			page.hostname === "picrd.com" &&
			!page.port &&
			!page.username &&
			!page.password &&
			page.pathname === `/${imageId}` &&
			deletion.protocol === "https:" &&
			deletion.hostname === "picrd.com" &&
			!deletion.port &&
			!deletion.username &&
			!deletion.password &&
			/^\/delete\/[A-Za-z0-9_-]+$/.test(deletion.pathname)
		);
	} catch {
		return false;
	}
}

export default app;

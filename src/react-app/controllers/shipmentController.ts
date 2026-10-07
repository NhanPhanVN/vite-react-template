import type {
	PackageSide,
	PicrdUpload,
	Shipment,
	ShipmentRole,
	ShipmentSummary,
	ShipmentStatus,
} from "../models/shipment";

const PICRD_UPLOAD_URL = "https://picrd.com/api/upload";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
]);

export class EvidenceSaveError extends Error {
	constructor(
		message: string,
		readonly picrdDeleteUrl: string,
	) {
		super(message);
	}
}

async function readResponse<T>(response: Response): Promise<T> {
	const body = await response.text();
	let data: { error?: string } & T;
	try {
		data = JSON.parse(body) as { error?: string } & T;
	} catch {
		throw new Error(
			response.ok
				? "The server returned an unexpected response."
				: `The server returned an error (${response.status}).`,
		);
	}
	if (!response.ok) {
		throw new Error(data.error ?? `Request failed (${response.status}).`);
	}
	return data;
}

export async function createShipment(
	title: string,
	receiverName: string,
	shippedOn: string,
): Promise<Shipment> {
	const response = await fetch("/api/shipments", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			title,
			receiver_name: receiverName,
			shipped_on: shippedOn,
		}),
	});
	const result = await readResponse<{ shipment: Shipment }>(response);
	return result.shipment;
}

export async function listShipments(): Promise<ShipmentSummary[]> {
	const response = await fetch("/api/shipments");
	const result = await readResponse<{ shipments: ShipmentSummary[] }>(response);
	return result.shipments;
}

export async function updateShipmentStatus(
	id: string,
	status: ShipmentStatus,
): Promise<Shipment> {
	const response = await fetch(`/api/shipments/${encodeURIComponent(id)}/status`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ status }),
	});
	const result = await readResponse<{ shipment: Shipment }>(response);
	return result.shipment;
}

export async function updateShipmentDetails(
	id: string,
	receiverName: string,
	shippedOn: string,
): Promise<Shipment> {
	const response = await fetch(`/api/shipments/${encodeURIComponent(id)}/details`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			receiver_name: receiverName,
			shipped_on: shippedOn,
		}),
	});
	const result = await readResponse<{ shipment: Shipment }>(response);
	return result.shipment;
}

export async function confirmShipmentReceived(id: string): Promise<Shipment> {
	const response = await fetch(`/api/shipments/${encodeURIComponent(id)}/confirm`, {
		method: "POST",
	});
	const result = await readResponse<{ shipment: Shipment }>(response);
	return result.shipment;
}

export async function getShipment(id: string): Promise<Shipment> {
	const response = await fetch(`/api/shipments/${encodeURIComponent(id)}`);
	const result = await readResponse<{ shipment: Shipment }>(response);
	return result.shipment;
}

export async function uploadEvidenceImage(file: File): Promise<PicrdUpload> {
	if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
		throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
	}
	if (file.size > MAX_IMAGE_BYTES) {
		throw new Error("Images must be 10 MB or smaller.");
	}

	const formData = new FormData();
	formData.append("file", file);
	formData.append("visibility", "unlisted");

	let response: Response;
	try {
		response = await fetch(PICRD_UPLOAD_URL, {
			method: "POST",
			body: formData,
		});
	} catch {
		throw new Error(
			"Picrd is blocking browser uploads because CORS is not enabled for this site. Ask Picrd to allow your site origin on POST /api/upload, then try again.",
		);
	}

	const result = await readResponse<PicrdUpload & { error?: string }>(response);
	if (
		typeof result.image_id !== "string" ||
		typeof result.image_url !== "string" ||
		typeof result.page_url !== "string" ||
		typeof result.delete_url !== "string"
	) {
		throw new Error("Picrd returned an incomplete upload response.");
	}
	return result;
}

export async function saveEvidence(
	shipmentId: string,
	role: ShipmentRole,
	side: PackageSide,
	upload: PicrdUpload,
): Promise<ShipmentEvidenceResponse> {
	const response = await fetch(
		`/api/shipments/${encodeURIComponent(shipmentId)}/evidence`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ role, side, ...upload }),
		},
	);
	try {
		const result = await readResponse<{
			evidence?: ShipmentEvidenceResponse;
		}>(response);
		if (!result.evidence) throw new Error("The server did not return the saved photo.");
		return result.evidence;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Could not save the photo URL.";
		throw new EvidenceSaveError(
			`${message} The image was uploaded to Picrd but its URL was not saved; delete the unused upload from Picrd.`,
			upload.delete_url,
		);
	}
}

export type ShipmentEvidenceResponse = {
	role: ShipmentRole;
	side: PackageSide;
	image_id: string;
	image_url: string;
	page_url: string;
	delete_url: string;
	created_at: string;
};

export async function removeEvidence(
	shipmentId: string,
	role: ShipmentRole,
	side: PackageSide,
): Promise<void> {
	const response = await fetch(
		`/api/shipments/${encodeURIComponent(shipmentId)}/evidence/${role}/${side}`,
		{ method: "DELETE" },
	);
	await readResponse<{ success: boolean }>(response);
}

import { Hono } from "hono";

type ChatMessage = {
	id: number;
	username: string;
	message: string;
	created_at: string;
};

const app = new Hono<{ Bindings: Env & { my_binding: D1Database } }>();

app.get("/api/messages", async (c) => {
	const { results } = await c.env.my_binding
		.prepare(
			"SELECT id, username, message, created_at FROM messages ORDER BY id DESC LIMIT 100",
		)
		.all<ChatMessage>();

	return c.json({ messages: results.reverse() });
});

app.post("/api/messages", async (c) => {
	const payload: unknown = await c.req.json().catch(() => null);
	if (typeof payload !== "object" || payload === null) {
		return c.json({ error: "Please provide a name and message." }, 400);
	}

	const { username, message } = payload as {
		username?: unknown;
		message?: unknown;
	};
	if (typeof username !== "string" || typeof message !== "string") {
		return c.json({ error: "Please provide a name and message." }, 400);
	}

	const trimmedUsername = username.trim();
	const trimmedMessage = message.trim();
	if (!trimmedUsername || trimmedUsername.length > 40) {
		return c.json({ error: "Your name must be between 1 and 40 characters." }, 400);
	}
	if (!trimmedMessage || trimmedMessage.length > 1000) {
		return c.json(
			{ error: "Your message must be between 1 and 1000 characters." },
			400,
		);
	}

	const insertedMessage = await c.env.my_binding
		.prepare(
			"INSERT INTO messages (username, message) VALUES (?, ?) RETURNING id, username, message, created_at",
		)
		.bind(trimmedUsername, trimmedMessage)
		.first<ChatMessage>();

	if (!insertedMessage) {
		return c.json({ error: "Your message could not be saved." }, 500);
	}

	return c.json({ message: insertedMessage }, 201);
});

export default app;

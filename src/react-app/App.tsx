import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type ChatMessage = {
	id: number;
	username: string;
	message: string;
	created_at: string;
};

function App() {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [username, setUsername] = useState("");
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		async function loadMessages() {
			try {
				const response = await fetch("/api/messages");
				const data = (await response.json()) as {
					messages?: ChatMessage[];
					error?: string;
				};
				if (!response.ok) {
					throw new Error(data.error ?? "Could not load messages.");
				}
				setMessages(data.messages ?? []);
			} catch (loadError) {
				setError(
					loadError instanceof Error
						? loadError.message
						: "Could not load messages.",
				);
			} finally {
				setLoading(false);
			}
		}

		void loadMessages();
	}, []);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedName = username.trim();
		const trimmedMessage = message.trim();
		if (!trimmedName || !trimmedMessage || sending) return;

		setSending(true);
		setError("");
		try {
			const response = await fetch("/api/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: trimmedName,
					message: trimmedMessage,
				}),
			});
			const data = (await response.json()) as {
				message?: ChatMessage;
				error?: string;
			};
			const savedMessage = data.message;
			if (!response.ok || !savedMessage) {
				throw new Error(data.error ?? "Could not send your message.");
			}
			setMessages((currentMessages) => [...currentMessages, savedMessage]);
			setMessage("");
		} catch (sendError) {
			setError(
				sendError instanceof Error
					? sendError.message
					: "Could not send your message.",
			);
		} finally {
			setSending(false);
		}
	}

	return (
		<main className="page-shell">
			<header className="topbar">
				<a className="brand" href="/" aria-label="Commonroom home">
					<span className="brand-mark" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none">
							<path
								d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H11l-4.5 4v-4.3A2.75 2.75 0 0 1 4 13.25v-7.5Z"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinejoin="round"
							/>
							<path
								d="M8 8h8M8 11.5h5"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
							/>
						</svg>
					</span>
					<span>commonroom</span>
				</a>
				<div className="connection-status">
					<span className="status-dot" />
					Chat room
				</div>
			</header>

			<section className="chat-layout" aria-labelledby="page-title">
				<div className="intro">
					<p className="eyebrow">A little corner of the internet</p>
					<h1 id="page-title">
						Good conversations
						<br />
						start <span>here.</span>
					</h1>
					<p className="intro-copy">
						Say hello, share a thought, or just see who’s around.
					</p>
				</div>

				<section className="chat-card" aria-label="Chat room">
					<div className="chat-card-header">
						<div className="room-avatar" aria-hidden="true">
							✳
						</div>
						<div>
							<h2>The common room</h2>
							<p>A friendly place to say hi</p>
						</div>
						<span className="message-count">
							{messages.length} {messages.length === 1 ? "message" : "messages"}
						</span>
					</div>

					<div className="messages" aria-live="polite" aria-busy={loading}>
						{loading ? (
							<div className="empty-state">
								<span className="loader" aria-hidden="true" />
								<p>Making the room ready…</p>
							</div>
						) : messages.length === 0 ? (
							<div className="empty-state">
								<span className="empty-icon" aria-hidden="true">
									☀
								</span>
								<p className="empty-title">It’s quiet in here.</p>
								<p>Leave the first message and get things started.</p>
							</div>
						) : (
							<div className="message-list">
								{messages.map((chatMessage) => (
									<article className="message-item" key={chatMessage.id}>
										<div className="message-avatar" aria-hidden="true">
											{chatMessage.username.charAt(0).toUpperCase()}
										</div>
										<div className="message-content">
											<div className="message-meta">
												<strong>{chatMessage.username}</strong>
												<time dateTime={`${chatMessage.created_at.replace(" ", "T")}Z`}>
													{formatTime(chatMessage.created_at)}
												</time>
											</div>
											<p>{chatMessage.message}</p>
										</div>
									</article>
								))}
								<div ref={messagesEndRef} />
							</div>
						)}
					</div>

					<form className="composer" onSubmit={handleSubmit}>
						<label className="field-label" htmlFor="username">
							Your name
						</label>
						<input
							id="username"
							className="name-input"
							type="text"
							placeholder="What should we call you?"
							value={username}
							onChange={(event) => setUsername(event.target.value)}
							maxLength={40}
							autoComplete="name"
							required
						/>
						<label className="field-label message-label" htmlFor="message">
							Your message
						</label>
						<div className="message-input-wrap">
							<textarea
								id="message"
								placeholder="Write something kind…"
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								maxLength={1000}
								rows={2}
								required
							/>
							<button
								className="send-button"
								type="submit"
								disabled={sending || !username.trim() || !message.trim()}
								aria-label="Send message"
							>
								{sending ? (
									<span className="button-loader" aria-hidden="true" />
								) : (
									<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
										<path
											d="M5 12h14m-6-6 6 6-6 6"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								)}
							</button>
						</div>
						<div className="composer-footer">
							{error ? (
								<p className="error-message" role="alert">
									{error}
								</p>
							) : (
								<p className="helper-text">Be nice. Good vibes only.</p>
							)}
							<span className="character-count">{message.length}/1000</span>
						</div>
					</form>
				</section>
				<footer className="page-footer">
					A small space for good conversation <span>✳</span>
				</footer>
			</section>
		</main>
	);
}

function formatTime(timestamp: string) {
	const date = new Date(`${timestamp.replace(" ", "T")}Z`);
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

export default App;

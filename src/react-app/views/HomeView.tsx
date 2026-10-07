import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
	createShipment,
	listShipments,
	updateShipmentStatus,
} from "../controllers/shipmentController";
import StatusSelect from "../components/StatusSelect";
import ShareDialog from "../components/ShareDialog";
import type { ShipmentSummary, ShipmentStatus } from "../models/shipment";

function HomeView() {
	const [title, setTitle] = useState("");
	const [receiverName, setReceiverName] = useState("");
	const [shippedOn, setShippedOn] = useState(todayDate());
	const [error, setError] = useState("");
	const [creating, setCreating] = useState(false);
	const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
	const [loadingShipments, setLoadingShipments] = useState(true);
	const [updatingStatusId, setUpdatingStatusId] = useState("");
	const [shareShipmentId, setShareShipmentId] = useState("");

	useEffect(() => {
		let active = true;
		let refreshing = false;

		async function refreshShipments() {
			if (refreshing) return;
			refreshing = true;
			try {
				const latestShipments = await listShipments();
				if (active) setShipments(latestShipments);
			} catch (loadError) {
				if (active) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Could not load shipments.",
					);
				}
			} finally {
				refreshing = false;
				if (active) setLoadingShipments(false);
			}
		}

		void refreshShipments();
		const intervalId = window.setInterval(
			() => void refreshShipments(),
			1000,
		);
		return () => {
			active = false;
			window.clearInterval(intervalId);
		};
	}, []);

	async function handleCreate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (creating) return;
		setCreating(true);
		setError("");
		try {
			const shipment = await createShipment(
				title.trim(),
				receiverName.trim(),
				shippedOn,
			);
			window.location.assign(`/shipment/${shipment.id}`);
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: "Could not create the shipment.",
			);
			setCreating(false);
		}
	}

	async function handleStatusChange(
		shipmentId: string,
		status: ShipmentStatus,
	) {
		if (updatingStatusId) return;
		setUpdatingStatusId(shipmentId);
		setError("");
		try {
			const updatedShipment = await updateShipmentStatus(shipmentId, status);
			setShipments((current) =>
				current.map((shipment) =>
					shipment.id === shipmentId
						? { ...shipment, status: updatedShipment.status }
						: shipment,
				),
			);
		} catch (statusError) {
			setError(
				statusError instanceof Error
					? statusError.message
					: "Could not update shipment status.",
			);
		} finally {
			setUpdatingStatusId("");
		}
	}

	return (
		<main className="home-view">
			<section className="hero">
				<p className="eyebrow">A clearer way to send</p>
				<h1>
					Proof of care,
					<br />
					from <span>door to door.</span>
				</h1>
				<p className="hero-copy">
					Keep the packing photos, delivery evidence, and shipment details
					together in one shareable place.
				</p>
			</section>

			<section className="create-card" aria-labelledby="create-title">
				<div className="step-number">01</div>
				<div className="create-card-body">
					<p className="card-kicker">Start a record</p>
					<h2 id="create-title">Create a shipment</h2>
					<p className="card-description">
						Give this shipment a title. You’ll get one link to share with the
						sender and receiver.
					</p>
					<form onSubmit={handleCreate}>
						<label className="field-label" htmlFor="shipment-title">
							Shipment title
						</label>
						<div className="create-row">
							<input
								id="shipment-title"
								className="text-input"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="e.g. Camera lens to Alex"
								maxLength={120}
								required
								autoFocus
							/>
							<button
								className="primary-button"
								type="submit"
								disabled={creating || !title.trim()}
							>
								{creating ? "Creating…" : "Create record"}
								{!creating && <span aria-hidden="true">↗</span>}
							</button>
						</div>
						<div className="create-details-row">
							<div>
								<label className="field-label" htmlFor="receiver-name">
									Receiver name
								</label>
								<input
									id="receiver-name"
									className="text-input"
									value={receiverName}
									onChange={(event) => setReceiverName(event.target.value)}
									placeholder="Who is receiving it?"
									maxLength={120}
									required
								/>
							</div>
							<div>
								<label className="field-label" htmlFor="shipped-on">
									Shipped on
								</label>
								<input
									id="shipped-on"
									className="text-input"
									type="date"
									value={shippedOn}
									onChange={(event) => setShippedOn(event.target.value)}
									required
								/>
							</div>
						</div>
						{error && (
							<p className="error-message" role="alert">
								{error}
							</p>
						)}
					</form>
					<p className="privacy-note">
						<span aria-hidden="true">◇</span> Anyone with the share link can
						view or update this record.
					</p>
				</div>
			</section>

			<section className="shipments-section" aria-labelledby="shipments-title">
				<div className="shipments-section-heading">
					<div>
						<p className="card-kicker">Your records</p>
						<h2 id="shipments-title">All shipments</h2>
					</div>
					<span className="shipment-total">
						{shipments.length} {shipments.length === 1 ? "record" : "records"}
					</span>
				</div>
				{error && (
					<p className="error-message" role="alert">
						{error}
					</p>
				)}
				{loadingShipments ? (
					<div className="shipments-empty">
						<span className="loader" aria-hidden="true" />
						<p>Loading shipments…</p>
					</div>
				) : shipments.length === 0 ? (
					<div className="shipments-empty">
						<p>No shipments yet. Create your first record above.</p>
					</div>
				) : (
					<div className="shipment-list">
						{shipments.map((shipment) => (
							<article className="shipment-list-item" key={shipment.id}>
								<a
									className="shipment-list-link"
									href={shipmentUrl(shipment.id)}
								>
									<span className="shipment-list-icon" aria-hidden="true">
										↗
									</span>
									<span className="shipment-list-copy">
										<strong>{shipment.title}</strong>
										<small>
											To {shipment.receiver_name || "receiver not set"} · Shipped{" "}
											{shipment.shipped_on
												? formatDate(shipment.shipped_on)
												: "date not set"}
										</small>
									</span>
								</a>
								{!shipment.received_confirmed_at &&
									shipment.shipped_on && (
										<span
											className="pending-confirmation"
											title={`${daysSince(shipment.shipped_on)} days since shipped`}
											aria-label={`Not confirmed, ${daysSince(shipment.shipped_on)} days since shipped`}
										>
											<span className="unconfirmed-badge">
												{daysSince(shipment.shipped_on)}
											</span>
											<span className="pending-confirmation-label">
												Not confirmed
											</span>
										</span>
									)}
								<StatusSelect
									status={shipment.status}
									disabled={updatingStatusId === shipment.id}
									onChange={(status) =>
										void handleStatusChange(shipment.id, status)
									}
								/>
								<button
									className="row-share-button"
									type="button"
									onClick={() => setShareShipmentId(shipment.id)}
									aria-label={`Share ${shipment.title}`}
								>
									Share
								</button>
							</article>
						))}
					</div>
				)}
				<p className="list-refresh-note">
					<span className="live-dot" /> Refreshes automatically every second
				</p>
			</section>

			<div className="steps-row" aria-label="How it works">
				<div>
					<span>1</span>
					<p>Create a shipment</p>
				</div>
				<i aria-hidden="true" />
				<div>
					<span>2</span>
					<p>Add front &amp; back photos</p>
				</div>
				<i aria-hidden="true" />
				<div>
					<span>3</span>
					<p>Share the link</p>
				</div>
			</div>
			{shareShipmentId && (
				<ShareDialog
					shipmentId={shareShipmentId}
					onClose={() => setShareShipmentId("")}
				/>
			)}
		</main>
	);
}

function shipmentUrl(id: string) {
	return new URL(
		`/shipment/${encodeURIComponent(id)}`,
		window.location.origin,
	).toString();
}

function formatDate(timestamp: string) {
	const dateOnly = timestamp.match(/^\d{4}-\d{2}-\d{2}$/);
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(
		dateOnly
			? new Date(`${timestamp}T00:00:00`)
			: new Date(`${timestamp.replace(" ", "T")}Z`),
	);
}

function todayDate() {
	const today = new Date();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${today.getFullYear()}-${month}-${day}`;
}

function daysSince(shippedOn: string) {
	const [year, month, day] = shippedOn.split("-").map(Number);
	const shippedAt = Date.UTC(year, month - 1, day);
	const today = new Date();
	const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
	return Math.max(0, Math.floor((todayUtc - shippedAt) / 86_400_000));
}

export default HomeView;

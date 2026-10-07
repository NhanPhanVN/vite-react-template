import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
	confirmShipmentReceived,
	EvidenceSaveError,
	getShipment,
	removeEvidence,
	saveEvidence,
	updateShipmentDetails,
	uploadEvidenceImage,
} from "../controllers/shipmentController";
import StatusSelect from "../components/StatusSelect";
import ShareDialog from "../components/ShareDialog";
import {
	EVIDENCE_SLOTS,
	type PackageSide,
	type Shipment,
	type ShipmentEvidence,
	type ShipmentRole,
	type ShipmentStatus,
} from "../models/shipment";
import { updateShipmentStatus } from "../controllers/shipmentController";

type UploadingSlot = `${ShipmentRole}-${PackageSide}`;

function ShipmentView({ shipmentId }: { shipmentId: string }) {
	const [shipment, setShipment] = useState<Shipment | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [uploading, setUploading] = useState<UploadingSlot | null>(null);
	const [pendingDelete, setPendingDelete] = useState<ShipmentEvidence | null>(
		null,
	);
	const [orphanDeleteUrl, setOrphanDeleteUrl] = useState("");
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const [updatingStatus, setUpdatingStatus] = useState(false);
	const [receiverName, setReceiverName] = useState("");
	const [shippedOn, setShippedOn] = useState("");
	const [savingDetails, setSavingDetails] = useState(false);
	const [confirmingReceipt, setConfirmingReceipt] = useState(false);
	const detailsInitialized = useRef(false);

	const refreshShipment = useCallback(async () => {
		const currentShipment = await getShipment(shipmentId);
		setShipment(currentShipment);
		setError("");
	}, [shipmentId]);

	useEffect(() => {
		let active = true;

		async function refresh() {
			try {
				const currentShipment = await getShipment(shipmentId);
				if (active) {
					setShipment(currentShipment);
					if (!detailsInitialized.current) {
						setReceiverName(currentShipment.receiver_name);
						setShippedOn(currentShipment.shipped_on ?? "");
						detailsInitialized.current = true;
					}
					setError("");
				}
			} catch (loadError) {
				if (active) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Could not load this shipment.",
					);
				}
			} finally {
				if (active) setLoading(false);
			}
		}

		void refresh();
		let refreshing = false;
		const refreshWithoutOverlap = async () => {
			if (refreshing) return;
			refreshing = true;
			try {
				await refresh();
			} finally {
				refreshing = false;
			}
		};
		const intervalId = window.setInterval(
			() => void refreshWithoutOverlap(),
			1000,
		);
		return () => {
			active = false;
			window.clearInterval(intervalId);
		};
	}, [shipmentId]);

	const evidenceBySlot = useMemo(
		() =>
			new Map(
				(shipment?.evidence ?? []).map((item) => [
					`${item.role}-${item.side}`,
					item,
				]),
			),
		[shipment?.evidence],
	);

	async function handleUpload(
		role: ShipmentRole,
		side: PackageSide,
		event: ChangeEvent<HTMLInputElement>,
	) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file || uploading) return;

		const key = `${role}-${side}` as UploadingSlot;
		setUploading(key);
		setError("");
		setOrphanDeleteUrl("");
		try {
			const picrdResponse = await uploadEvidenceImage(file);
			await saveEvidence(shipmentId, role, side, picrdResponse);
			await refreshShipment();
		} catch (uploadError) {
			if (uploadError instanceof EvidenceSaveError) {
				setOrphanDeleteUrl(uploadError.picrdDeleteUrl);
			}
			setError(
				uploadError instanceof Error
					? uploadError.message
					: "Could not upload this photo.",
			);
		} finally {
			setUploading(null);
		}
	}

	function openPicrdDelete(evidence: ShipmentEvidence) {
		window.open(evidence.delete_url, "_blank", "noopener,noreferrer");
		setPendingDelete(evidence);
		setError("");
	}

	async function confirmEvidenceRemoval() {
		if (!pendingDelete) return;
		const { role, side } = pendingDelete;
		setError("");
		try {
			await removeEvidence(shipmentId, role, side);
			setPendingDelete(null);
			await refreshShipment();
		} catch (removeError) {
			setError(
				removeError instanceof Error
					? removeError.message
					: "Could not remove this photo.",
			);
		}
	}

	async function handleStatusChange(status: ShipmentStatus) {
		if (!shipment || updatingStatus || shipment.status === status) return;
		setUpdatingStatus(true);
		setError("");
		try {
			const updatedShipment = await updateShipmentStatus(shipment.id, status);
			setShipment((current) =>
				current ? { ...current, status: updatedShipment.status } : current,
			);
		} catch (statusError) {
			setError(
				statusError instanceof Error
					? statusError.message
					: "Could not update shipment status.",
			);
		} finally {
			setUpdatingStatus(false);
		}
	}

	async function handleDetailsSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!shipment || savingDetails) return;
		setSavingDetails(true);
		setError("");
		try {
			const updated = await updateShipmentDetails(
				shipment.id,
				receiverName.trim(),
				shippedOn,
			);
			setShipment((current) => (current ? { ...current, ...updated } : current));
		} catch (detailsError) {
			setError(
				detailsError instanceof Error
					? detailsError.message
					: "Could not save shipment details.",
			);
		} finally {
			setSavingDetails(false);
		}
	}

	async function handleConfirmReceived() {
		if (!shipment || confirmingReceipt) return;
		setConfirmingReceipt(true);
		setError("");
		try {
			const updated = await confirmShipmentReceived(shipment.id);
			setShipment((current) =>
				current
					? { ...current, received_confirmed_at: updated.received_confirmed_at }
					: current,
			);
		} catch (confirmationError) {
			setError(
				confirmationError instanceof Error
					? confirmationError.message
					: "Could not confirm receipt.",
			);
		} finally {
			setConfirmingReceipt(false);
		}
	}

	return (
		<main className="shipment-view">
			<div className="shipment-breadcrumb">
				<a href="/">← All shipments</a>
				<span>Shared record</span>
			</div>

			{loading ? (
				<div className="loading-panel">
					<span className="loader" aria-hidden="true" />
					<p>Loading shipment…</p>
				</div>
			) : !shipment ? (
				<section className="not-found">
					<span className="not-found-icon" aria-hidden="true">
						?
					</span>
					<h1>Shipment not found</h1>
					<p>{error || "This link may be invalid or the record was removed."}</p>
					<a className="primary-button link-button" href="/">
						Create a shipment
					</a>
				</section>
			) : (
				<>
					<section className="shipment-heading">
						<div className="shipment-heading-copy">
							<p className="eyebrow">Shipment record</p>
							<h1>{shipment.title}</h1>
							<p className="shipment-date">
								Created {formatDate(shipment.created_at)} <span>·</span>{" "}
								{shipment.evidence.length} of 4 photos
							</p>
							<div className="record-status">
								<span>Status</span>
								<StatusSelect
									status={shipment.status}
									disabled={updatingStatus}
									onChange={(status) => void handleStatusChange(status)}
								/>
							</div>
						</div>
						<button
							className="secondary-button share-button"
							type="button"
							onClick={() => setShareDialogOpen(true)}
						>
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M8 12.5 15.2 8m-7.2 8 7.2 4.5M19 6.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm9 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
									stroke="currentColor"
									strokeWidth="1.7"
								/>
							</svg>
							Share shipment
						</button>
					</section>

					<section className="shipment-details-card" aria-labelledby="details-title">
						<div className="details-card-heading">
							<div>
								<p className="card-kicker">Shipment details</p>
								<h2 id="details-title">Delivery information</h2>
							</div>
							{shipment.received_confirmed_at ? (
								<span className="confirmed-badge">
									<span aria-hidden="true">✓</span> Received confirmed
								</span>
							) : (
								<button
									className="confirm-received-button"
									type="button"
									disabled={confirmingReceipt}
									onClick={() => void handleConfirmReceived()}
								>
									{confirmingReceipt ? "Confirming…" : "Confirm received"}
								</button>
							)}
						</div>
						{shipment.received_confirmed_at ? (
							<p className="confirmation-note">
								Receipt confirmed {formatDateTime(shipment.received_confirmed_at)}.
							</p>
						) : (
							<p className="confirmation-note">
								The receiver can confirm delivery here to clear the waiting badge.
							</p>
						)}
						<form className="shipment-details-form" onSubmit={handleDetailsSave}>
							<div className="detail-field">
								<label className="field-label" htmlFor="receiver-name-edit">
									Receiver name
								</label>
								<input
									id="receiver-name-edit"
									className="text-input"
									value={receiverName}
									onChange={(event) => setReceiverName(event.target.value)}
									maxLength={120}
									required
								/>
							</div>
							<div className="detail-field">
								<label className="field-label" htmlFor="shipped-on-edit">
									Shipped on
								</label>
								<input
									id="shipped-on-edit"
									className="text-input"
									type="date"
									value={shippedOn}
									onChange={(event) => setShippedOn(event.target.value)}
									required
								/>
							</div>
							<button
								className="secondary-button save-details-button"
								type="submit"
								disabled={savingDetails}
							>
								{savingDetails ? "Saving…" : "Save details"}
							</button>
						</form>
					</section>

					<div className="share-notice">
						<span aria-hidden="true">↗</span>
						Anyone with this link can view, add, or delete photos. Share it only
						with the sender and receiver.
					</div>

					{error && (
						<div className="error-banner" role="alert">
							<span aria-hidden="true">!</span>
							{error}
							{orphanDeleteUrl && (
								<a
									className="orphan-delete-link"
									href={orphanDeleteUrl}
									target="_blank"
									rel="noreferrer"
								>
									Open Picrd cleanup
								</a>
							)}
							<button
								type="button"
								onClick={() => {
									setError("");
									setOrphanDeleteUrl("");
								}}
								aria-label="Dismiss error"
							>
								×
							</button>
						</div>
					)}

					<div className="evidence-grid">
						{(["sender", "receiver"] as const).map((role) => {
							const count = EVIDENCE_SLOTS.filter(
								(slot) => slot.role === role && evidenceBySlot.has(`${role}-${slot.side}`),
							).length;
							return (
								<section className={`evidence-card ${role}`} key={role}>
									<div className="evidence-card-header">
										<div className="role-icon" aria-hidden="true">
											{role === "sender" ? "↑" : "↓"}
										</div>
										<div>
											<p className="card-kicker">{role === "sender" ? "Before transit" : "After delivery"}</p>
											<h2>{role === "sender" ? "Sender" : "Receiver"} photos</h2>
										</div>
										<span className="photo-count">{count}/2</span>
									</div>
									<p className="role-hint">
										{role === "sender"
											? "Show how the package was prepared."
											: "Show the package as it arrived."}
									</p>
									<div className="photo-slots">
										{EVIDENCE_SLOTS.filter((slot) => slot.role === role).map(
											(slot) => {
												const key =
													`${slot.role}-${slot.side}` as UploadingSlot;
												const evidence = evidenceBySlot.get(key);
												return (
													<div className="photo-slot" key={key}>
														<div className="photo-slot-label">
															<span>{slot.label} side</span>
															<span className="side-index">
																{slot.side === "front" ? "01" : "02"}
															</span>
														</div>
														{evidence ? (
															<div className="evidence-preview">
																<a
																	className="image-link"
																	href={evidence.page_url}
																	target="_blank"
																	rel="noreferrer"
																>
																	<img
																		src={evidence.image_url}
																		alt={`${role} package, ${slot.side} side`}
																	/>
																</a>
																<div className="image-actions">
																	<a
																		href={evidence.page_url}
																		target="_blank"
																		rel="noreferrer"
																	>
																		View original ↗
																	</a>
																	<button
																		type="button"
																		className="delete-photo-button"
																		onClick={() => openPicrdDelete(evidence)}
																	>
																		Delete
																	</button>
																</div>
																{pendingDelete?.image_id === evidence.image_id && (
																	<div className="delete-confirm">
																		<p>
																			Confirm deletion in the Picrd tab, then
																			remove this photo from the record.
																		</p>
																		<div>
																			<button
																				type="button"
																				className="confirm-delete-button"
																				onClick={() =>
																					void confirmEvidenceRemoval()
																				}
																			>
																				Remove from record
																			</button>
																			<button
																				type="button"
																				className="cancel-button"
																				onClick={() => setPendingDelete(null)}
																			>
																				Cancel
																			</button>
																		</div>
																	</div>
																)}
															</div>
														) : (
															<label
																className={`upload-tile ${uploading === key ? "is-uploading" : ""}`}
															>
																<input
																	type="file"
																	accept="image/png,image/jpeg,image/webp,image/gif"
																	disabled={uploading !== null}
																	onChange={(event) =>
																		void handleUpload(
																			role,
																			slot.side,
																			event,
																		)
																	}
																/>
																{uploading === key ? (
																	<>
																		<span className="loader" aria-hidden="true" />
																		<span className="upload-main">Uploading…</span>
																		<span className="upload-sub">
																			Sending directly to Picrd
																		</span>
																	</>
																) : (
																	<>
																		<span className="upload-icon" aria-hidden="true">
																			+
																		</span>
																		<span className="upload-main">Add photo</span>
																		<span className="upload-sub">
																			PNG, JPG, WebP or GIF · max 10 MB
																		</span>
																	</>
																)}
															</label>
														)}
													</div>
												);
											},
										)}
									</div>
								</section>
							);
						})}
					</div>

					<p className="refresh-note">
						<span className="live-dot" /> Updates automatically every second
					</p>
				</>
			)}
			{shareDialogOpen && (
				<ShareDialog
					shipmentId={shipmentId}
					onClose={() => setShareDialogOpen(false)}
				/>
			)}
		</main>
	);
}

function formatDate(timestamp: string) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(`${timestamp.replace(" ", "T")}Z`));
}

function formatDateTime(timestamp: string) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(`${timestamp.replace(" ", "T")}Z`));
}

export default ShipmentView;

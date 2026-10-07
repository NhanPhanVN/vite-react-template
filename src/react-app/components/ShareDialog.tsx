import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

function ShareDialog({
	shipmentId,
	onClose,
}: {
	shipmentId: string;
	onClose: () => void;
}) {
	const [qrImage, setQrImage] = useState("");
	const [qrError, setQrError] = useState("");
	const [copied, setCopied] = useState(false);
	const onCloseRef = useRef(onClose);
	const shareUrl = new URL(
		`/shipment/${encodeURIComponent(shipmentId)}`,
		window.location.origin,
	).toString();

	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	useEffect(() => {
		let active = true;
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") onCloseRef.current();
		}
		window.addEventListener("keydown", handleKeyDown);
		void QRCode.toDataURL(shareUrl, {
			width: 220,
			margin: 1,
			errorCorrectionLevel: "M",
			color: { dark: "#26372d", light: "#fffefa" },
		}).then(
			(dataUrl) => {
				if (active) setQrImage(dataUrl);
			},
			() => {
				if (active) setQrError("Could not generate a QR code.");
			},
		);
		return () => {
			active = false;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [shareUrl]);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch {
			setQrError("Could not copy automatically. Select and copy the link above.");
		}
	}

	return (
		<div
			className="modal-backdrop"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<section
				className="share-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="share-dialog-title"
			>
				<button
					className="dialog-close"
					type="button"
					onClick={onClose}
					aria-label="Close share dialog"
				>
					×
				</button>
				<p className="card-kicker">Pass it along</p>
				<h2 id="share-dialog-title">Share this shipment</h2>
				<p className="dialog-copy">
					Send this link to the receiver so they can see the record and confirm
					when it arrives.
				</p>
				<label className="field-label" htmlFor="shipment-share-url">
					Share link
				</label>
				<div className="share-url-row">
					<input
						id="shipment-share-url"
						className="text-input"
						value={shareUrl}
						readOnly
						onFocus={(event) => event.currentTarget.select()}
					/>
					<button className="primary-button" type="button" onClick={() => void copyLink()}>
						{copied ? "Copied" : "Copy link"}
					</button>
				</div>
				{qrError && (
					<p className="error-message" role="alert">
						{qrError}
					</p>
				)}
				<div className="share-qr">
					<div className="share-qr-image">
						{qrImage ? (
							<img src={qrImage} alt="QR code for the shipment share link" />
						) : (
							<span className="loader" aria-label="Generating QR code" />
						)}
					</div>
					<p>Scan to open the shipment record</p>
				</div>
			</section>
		</div>
	);
}

export default ShareDialog;

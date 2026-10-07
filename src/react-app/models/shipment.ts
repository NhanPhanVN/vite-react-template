export type ShipmentRole = "sender" | "receiver";
export type PackageSide = "front" | "back";
export type ShipmentStatus = "shipped" | "on_the_way" | "return";

export const SHIPMENT_STATUSES: { value: ShipmentStatus; label: string }[] = [
	{ value: "shipped", label: "Shipped" },
	{ value: "on_the_way", label: "On the way" },
	{ value: "return", label: "Return" },
];

export type EvidenceSlot = {
	role: ShipmentRole;
	side: PackageSide;
	label: string;
};

export const EVIDENCE_SLOTS: EvidenceSlot[] = [
	{ role: "sender", side: "front", label: "Front" },
	{ role: "sender", side: "back", label: "Back" },
	{ role: "receiver", side: "front", label: "Front" },
	{ role: "receiver", side: "back", label: "Back" },
];

export type ShipmentEvidence = {
	role: ShipmentRole;
	side: PackageSide;
	image_id: string;
	image_url: string;
	page_url: string;
	delete_url: string;
	created_at: string;
};

export type Shipment = {
	id: string;
	title: string;
	status: ShipmentStatus;
	receiver_name: string;
	shipped_on: string | null;
	received_confirmed_at: string | null;
	created_at: string;
	evidence: ShipmentEvidence[];
};

export type ShipmentSummary = Omit<Shipment, "evidence">;

export type PicrdUpload = {
	image_id: string;
	image_url: string;
	page_url: string;
	delete_url: string;
};

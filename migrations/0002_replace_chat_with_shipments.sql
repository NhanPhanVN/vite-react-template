DROP TABLE IF EXISTS messages;

CREATE TABLE shipments (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shipment_evidence (
	shipment_id TEXT NOT NULL REFERENCES shipments (id) ON DELETE CASCADE,
	role TEXT NOT NULL CHECK (role IN ('sender', 'receiver')),
	side TEXT NOT NULL CHECK (side IN ('front', 'back')),
	image_id TEXT NOT NULL,
	image_url TEXT NOT NULL,
	page_url TEXT NOT NULL,
	delete_url TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (shipment_id, role, side)
);

CREATE INDEX idx_shipment_evidence_shipment
	ON shipment_evidence (shipment_id);

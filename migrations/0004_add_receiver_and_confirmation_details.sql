ALTER TABLE shipments
	ADD COLUMN receiver_name TEXT NOT NULL DEFAULT '';

ALTER TABLE shipments
	ADD COLUMN shipped_on TEXT;

ALTER TABLE shipments
	ADD COLUMN received_confirmed_at TEXT;

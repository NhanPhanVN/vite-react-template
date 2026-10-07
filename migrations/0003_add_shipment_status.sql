ALTER TABLE shipments
	ADD COLUMN status TEXT NOT NULL DEFAULT 'on_the_way'
	CHECK (status IN ('shipped', 'on_the_way', 'return'));

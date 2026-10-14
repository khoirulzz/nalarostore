BEGIN;
ALTER TABLE users ADD COLUMN firebase_uid text UNIQUE;
ALTER TABLE stores ADD COLUMN pilot_until timestamptz;
ALTER TABLE product_variants ADD COLUMN image_url text;
COMMIT;

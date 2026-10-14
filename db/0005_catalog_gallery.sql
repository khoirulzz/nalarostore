BEGIN;
ALTER TABLE products ADD COLUMN gallery jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(gallery)='array');
COMMIT;

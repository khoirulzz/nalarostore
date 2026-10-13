BEGIN;
CREATE TABLE platform_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id),billing_instructions text NOT NULL DEFAULT '',trial_days integer NOT NULL DEFAULT 7 CHECK(trial_days BETWEEN 0 AND 30),grace_days integer NOT NULL DEFAULT 7 CHECK(grace_days BETWEEN 0 AND 30));
INSERT INTO platform_settings(id) VALUES(true);
COMMIT;

BEGIN;
ALTER TABLE stores ADD COLUMN umkm_activated_at timestamptz;
UPDATE stores s SET umkm_activated_at=(SELECT min(a.created_at) FROM audit_logs a WHERE a.store_id=s.id AND a.action='pilot.update' AND a.metadata->>'months'='6') WHERE EXISTS(SELECT 1 FROM audit_logs a WHERE a.store_id=s.id AND a.action='pilot.update' AND a.metadata->>'months'='6');
ALTER TABLE store_subscriptions DROP CONSTRAINT store_subscriptions_status_check, ADD CONSTRAINT store_subscriptions_status_check CHECK(status IN ('pending','trial','active','past_due','grace','expired','canceled'));
ALTER TABLE store_subscriptions ADD COLUMN billing_mode text NOT NULL DEFAULT 'standard' CHECK(billing_mode IN ('standard','internal'));
CREATE UNIQUE INDEX one_pending_subscription ON store_subscriptions(store_id) WHERE status='pending';
CREATE TABLE store_deletion_confirmations (
 token uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 actor_user_id uuid NOT NULL REFERENCES users(id), store_name text NOT NULL,
 stage integer NOT NULL DEFAULT 1 CHECK(stage IN (1,2)),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
ALTER TABLE custom_project_leads ADD COLUMN store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
CREATE TABLE media_deletion_jobs (store_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
COMMIT;

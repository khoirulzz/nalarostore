-- Nalaro Store Foundation Schema / Aiven PostgreSQL
-- This creates structure only. Do NOT enable live payment or merchant writes yet.
-- UUID generated in Worker with crypto.randomUUID(). Timestamps UTC in DB.
BEGIN;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text,
 email_verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS merchants (
 id uuid PRIMARY KEY, business_name text NOT NULL, owner_user_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stores (
 id uuid PRIMARY KEY, merchant_id uuid NOT NULL REFERENCES merchants(id),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
 name text NOT NULL, description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','suspended')),
 theme_key text NOT NULL DEFAULT 'atelier',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stores_merchant ON stores(merchant_id);
CREATE TABLE IF NOT EXISTS merchant_memberships (
 user_id uuid NOT NULL REFERENCES users(id), merchant_id uuid NOT NULL REFERENCES merchants(id),
 role text NOT NULL CHECK(role IN ('owner','manager','fulfillment','viewer')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,merchant_id)
);
CREATE TABLE IF NOT EXISTS store_domains (
 id uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES stores(id), hostname text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('platform','custom')),
 verification_status text NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_domains_store ON store_domains(store_id);
CREATE TABLE IF NOT EXISTS categories (
 id uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES stores(id),slug text NOT NULL,name text NOT NULL,position integer NOT NULL DEFAULT 0,
 UNIQUE(store_id,slug),UNIQUE(store_id,id)
);
CREATE TABLE IF NOT EXISTS products (
 id uuid PRIMARY KEY,store_id uuid NOT NULL REFERENCES stores(id),slug text NOT NULL,
 name text NOT NULL,description text NOT NULL DEFAULT '',price_idr bigint NOT NULL CHECK(price_idr>=0),
 category text NOT NULL DEFAULT 'Produk',category_id uuid,primary_image_url text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 position integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,slug),UNIQUE(store_id,id),
 FOREIGN KEY(store_id,category_id) REFERENCES categories(store_id,id)
);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(store_id,status,position,created_at DESC);
CREATE TABLE IF NOT EXISTS product_variants (
 id uuid PRIMARY KEY,store_id uuid NOT NULL,product_id uuid NOT NULL,sku text NOT NULL,
 option_label text NOT NULL DEFAULT 'Default',price_override_idr bigint CHECK(price_override_idr>=0),
 stock_qty integer NOT NULL DEFAULT 0 CHECK(stock_qty>=0),reserved_qty integer NOT NULL DEFAULT 0 CHECK(reserved_qty>=0 AND reserved_qty<=stock_qty),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
 UNIQUE(store_id,sku),UNIQUE(store_id,id),
 FOREIGN KEY(store_id,product_id) REFERENCES products(store_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(store_id,product_id);
CREATE TABLE IF NOT EXISTS product_media (
 id uuid PRIMARY KEY, store_id uuid NOT NULL,product_id uuid NOT NULL,object_key text NOT NULL,
 alt_text text NOT NULL DEFAULT '',sort_order int NOT NULL DEFAULT 0,
 FOREIGN KEY(store_id,product_id) REFERENCES products(store_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS store_order_counters (
 store_id uuid PRIMARY KEY REFERENCES stores(id),counter bigint NOT NULL DEFAULT 0 CHECK(counter>=0)
);
CREATE TABLE IF NOT EXISTS orders (
 id uuid PRIMARY KEY,store_id uuid NOT NULL REFERENCES stores(id),order_number text NOT NULL,
 idempotency_key text NOT NULL,customer_name text NOT NULL,contact_email text,contact_phone text NOT NULL,
 address_json jsonb,shipping_method text NOT NULL CHECK(shipping_method IN ('pickup','local_flat')),
 subtotal_idr bigint NOT NULL CHECK(subtotal_idr>=0),shipping_idr bigint NOT NULL DEFAULT 0 CHECK(shipping_idr>=0),
 total_idr bigint NOT NULL CHECK(total_idr=subtotal_idr+shipping_idr),
 payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','pending','paid','failed','expired','refunded')),
 fulfillment_status text NOT NULL DEFAULT 'unfulfilled' CHECK(fulfillment_status IN ('unfulfilled','packing','shipped','delivered','pickup_ready','picked_up','returned')),
 order_status text NOT NULL DEFAULT 'pending' CHECK(order_status IN ('pending','confirmed','processing','completed','canceled','expired')),
 source text NOT NULL DEFAULT 'web' CHECK(source IN ('web','manual')),
 reservation_expires_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,order_number),UNIQUE(store_id,idempotency_key),UNIQUE(store_id,id)
);
CREATE INDEX IF NOT EXISTS idx_orders_store_time ON orders(store_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_reservation_expiry ON orders(reservation_expires_at) WHERE order_status='pending';
CREATE TABLE IF NOT EXISTS order_items (
 id uuid PRIMARY KEY,store_id uuid NOT NULL,order_id uuid NOT NULL,variant_id uuid NOT NULL,
 name_snapshot text NOT NULL,variant_snapshot text NOT NULL,sku_snapshot text NOT NULL,
 quantity int NOT NULL CHECK(quantity>0),unit_price_idr bigint NOT NULL CHECK(unit_price_idr>=0),
 line_total_idr bigint NOT NULL CHECK(line_total_idr=quantity*unit_price_idr),
 FOREIGN KEY(store_id,order_id) REFERENCES orders(store_id,id),
 FOREIGN KEY(store_id,variant_id) REFERENCES product_variants(store_id,id)
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(store_id,order_id);
CREATE TABLE IF NOT EXISTS inventory_movements (
 id uuid PRIMARY KEY,store_id uuid NOT NULL,variant_id uuid NOT NULL,order_id uuid,
 kind text NOT NULL CHECK(kind IN ('initial','adjustment','reserve','release','fulfill','return')),
 quantity_delta int NOT NULL, actor_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(store_id,variant_id) REFERENCES product_variants(store_id,id),
 FOREIGN KEY(store_id,order_id) REFERENCES orders(store_id,id)
);
CREATE TABLE IF NOT EXISTS manual_payment_reviews (
 id uuid PRIMARY KEY,store_id uuid NOT NULL,order_id uuid NOT NULL,reviewed_by uuid NOT NULL REFERENCES users(id),
 decision text NOT NULL CHECK(decision IN ('verified','rejected')),note text,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(store_id,order_id) REFERENCES orders(store_id,id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id uuid PRIMARY KEY,store_id uuid,actor_user_id uuid,action text NOT NULL,entity_type text NOT NULL,
 entity_id text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_store ON audit_logs(store_id,created_at DESC);
CREATE TABLE IF NOT EXISTS outbox_events (
 id uuid PRIMARY KEY,store_id uuid,topic text NOT NULL,payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),
 attempts int NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox_events(status,next_attempt_at);
-- Hybrid business subscription pricing; all prices are owner-managed, never constants in frontend.
CREATE TABLE IF NOT EXISTS plans (
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE,name text NOT NULL,description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 is_public boolean NOT NULL DEFAULT false,sort_order int NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS plan_prices (
 id uuid PRIMARY KEY,plan_id uuid NOT NULL REFERENCES plans(id),billing_interval text NOT NULL CHECK(billing_interval IN ('monthly','yearly')),
 amount_idr bigint NOT NULL CHECK(amount_idr>=0),is_active boolean NOT NULL DEFAULT false,
 valid_from timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(plan_id,billing_interval,valid_from)
);
CREATE TABLE IF NOT EXISTS plan_entitlements (
 plan_id uuid NOT NULL REFERENCES plans(id),feature_code text NOT NULL,allowed boolean NOT NULL DEFAULT true,
 limit_value bigint CHECK(limit_value>=0),PRIMARY KEY(plan_id,feature_code)
);
CREATE TABLE IF NOT EXISTS store_subscriptions (
 id uuid PRIMARY KEY,store_id uuid NOT NULL REFERENCES stores(id),plan_id uuid NOT NULL REFERENCES plans(id),
 plan_price_id uuid NOT NULL REFERENCES plan_prices(id),billing_interval text NOT NULL CHECK(billing_interval IN ('monthly','yearly')),
 price_snapshot_idr bigint NOT NULL CHECK(price_snapshot_idr>=0),
 status text NOT NULL CHECK(status IN ('trial','active','past_due','grace','expired','canceled')),
 current_period_start timestamptz,current_period_end timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_store ON store_subscriptions(store_id,status);
CREATE TABLE IF NOT EXISTS subscription_invoices (
 id uuid PRIMARY KEY,subscription_id uuid NOT NULL REFERENCES store_subscriptions(id),invoice_number text NOT NULL UNIQUE,
 amount_idr bigint NOT NULL CHECK(amount_idr>=0),period_start timestamptz,period_end timestamptz,
 status text NOT NULL CHECK(status IN ('draft','unpaid','paid','void','overdue')),
 issued_at timestamptz NOT NULL DEFAULT now(),paid_at timestamptz
);
CREATE TABLE IF NOT EXISTS custom_project_leads (
 id uuid PRIMARY KEY,business_name text NOT NULL,contact_name text,contact_email text,contact_phone text,
 project_brief text NOT NULL,status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','quoted','accepted','declined','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS store_responsible_profiles (
 store_id uuid PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
 full_name text NOT NULL DEFAULT '', position text NOT NULL DEFAULT 'Pemilik',
 contact_phone text NOT NULL DEFAULT '', contact_email text NOT NULL DEFAULT '',
 birth_date date, operational_address text NOT NULL DEFAULT '',
 updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (length(full_name)<=120), CHECK (length(position)<=80)
);
CREATE TABLE IF NOT EXISTS customer_profiles (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 full_name text NOT NULL DEFAULT '', contact_phone text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_addresses (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 label text NOT NULL, recipient_name text NOT NULL, contact_phone text NOT NULL,
 address text NOT NULL, is_default boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_addresses_user ON customer_addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_default ON customer_addresses(user_id) WHERE is_default;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_buyer_history ON orders(buyer_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS customer_conversations (
 id uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 buyer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 guest_token_hash text, guest_expires_at timestamptz,
 customer_name text NOT NULL, product_id uuid REFERENCES products(id) ON DELETE SET NULL,
 order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
 buyer_read_at timestamptz NOT NULL DEFAULT now(), seller_read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (guest_token_hash IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS conversations_store_recent ON customer_conversations(store_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_buyer ON customer_conversations(buyer_user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS customer_messages (
 id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES customer_conversations(id) ON DELETE CASCADE,
 sender_kind text NOT NULL CHECK(sender_kind IN ('buyer','seller')),
 sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 client_message_id uuid NOT NULL, body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conversation_id,client_message_id)
);
CREATE INDEX IF NOT EXISTS messages_conversation_recent ON customer_messages(conversation_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS seller_notification_receipts (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
 notification_key text NOT NULL, read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,store_id,notification_key)
);

COMMIT;

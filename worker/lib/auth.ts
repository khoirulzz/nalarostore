import type { DB } from "./db";
import { assert, json, seal } from "./security";
import { verifyFirebaseToken, type FirebaseConfig } from "./firebase";
export type Identity = {
  id: string;
  email: string;
  verified: boolean;
  admin: boolean;
  /** Set only after an explicit, authorized admin workspace request. */
  actingStoreId?: string;
};
export type AuthConfig = FirebaseConfig & {
  APP_ORIGIN: string;
  APP_ENV: string;
  TOKEN_SECRET?: string;
  OWNER_EMAIL: string;
  EMAIL?: SendEmail;
};
export async function identity(
  db: DB,
  request: Request,
  env: AuthConfig,
): Promise<Identity | null> {
  const raw = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/i)?.[1];
  if (!raw) return null;
  await rateLimit(
    db,
    "identity-ip:" + (request.headers.get("cf-connecting-ip") || "local"),
    600,
  );
  const firebase = await verifyFirebaseToken(raw, env);
  return db.tx(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "firebase:" + firebase.uid,
    ]);
    let user = (
      await tx.query(
        "SELECT id,email,firebase_uid FROM users WHERE firebase_uid=$1",
        [firebase.uid],
      )
    )[0];
    if (!user) {
      const existing = (
        await tx.query(
          "SELECT id,firebase_uid FROM users WHERE email=$1 FOR UPDATE",
          [firebase.email],
        )
      )[0];
      assert(
        !existing || (!existing.firebase_uid && firebase.verified),
        409,
        "Email sudah terhubung ke akun lain. Hubungi dukungan.",
      );
      if (existing) {
        await tx.query(
          "UPDATE users SET firebase_uid=$2,password_hash=NULL WHERE id=$1",
          [existing.id, firebase.uid],
        );
        user = existing;
      } else {
        user = (
          await tx.query(
            "INSERT INTO users(id,email,firebase_uid) VALUES($1,$2,$3) RETURNING id",
            [crypto.randomUUID(), firebase.email, firebase.uid],
          )
        )[0];
      }
    }
    const conflict = (
      await tx.query("SELECT id FROM users WHERE email=$1 AND id<>$2", [
        firebase.email,
        user.id,
      ])
    )[0];
    assert(
      !conflict,
      409,
      "Email sudah terhubung ke akun lain. Hubungi dukungan.",
    );
    await tx.query(
      "UPDATE users SET email=$2,email_verified_at=CASE WHEN $3 THEN COALESCE(email_verified_at,now()) ELSE NULL END WHERE id=$1",
      [user.id, firebase.email, firebase.verified],
    );
    const owner =
      firebase.verified && firebase.email === env.OWNER_EMAIL.toLowerCase();
    if (owner)
      await tx.query(
        "INSERT INTO platform_admins(user_id) VALUES($1) ON CONFLICT DO NOTHING",
        [user.id],
      );
    return {
      id: user.id as string,
      email: firebase.email,
      verified: firebase.verified,
      admin: owner,
    };
  });
}
export function requireUser(
  user: Identity | null,
  verified = true,
): asserts user is Identity {
  assert(user, 401, "Masuk untuk melanjutkan.");
  assert(
    !verified || user.verified,
    403,
    "Verifikasi email sebelum mengelola toko.",
  );
}
export function requireAdmin(user: Identity | null): asserts user is Identity {
  requireUser(user);
  assert(user.admin, 403, "Akses khusus pemilik platform.");
}
export async function storeAccess(
  db: DB,
  user: Identity | null,
  storeId: string,
  write = false,
) {
  requireUser(user);
  if (user.admin && user.actingStoreId === storeId) {
    const store = (
      await db.query("SELECT s.*,'owner' AS role FROM stores s WHERE id=$1", [
        storeId,
      ])
    )[0];
    assert(store, 404, "Toko tidak ditemukan.");
    if (!write)
      await audit(db, user.id, storeId, "admin.store.view", "store", storeId);
    return store;
  }
  const rows = await db.query(
    `SELECT s.*,m.role FROM stores s JOIN merchant_memberships m ON m.merchant_id=s.merchant_id WHERE s.id=$1 AND m.user_id=$2`,
    [storeId, user.id],
  );
  assert(rows[0], 404, "Toko tidak ditemukan.");
  if (write)
    assert(
      rows[0].status !== "suspended",
      423,
      "Toko dinonaktifkan admin. Hubungi pengelola platform.",
    );
  if (write)
    assert(
      ["owner", "manager"].includes(rows[0].role),
      403,
      "Peranmu tidak dapat melakukan perubahan ini.",
    );
  return rows[0];
}
export async function audit(
  db: DB,
  actor: string | null,
  storeId: string | null,
  action: string,
  entity: string,
  entityId: string,
  metadata: unknown = {},
) {
  await db.query(
    `INSERT INTO audit_logs(id,store_id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      crypto.randomUUID(),
      storeId,
      actor,
      action,
      entity,
      entityId,
      JSON.stringify(metadata),
    ],
  );
}
export async function enqueue(
  db: DB,
  storeId: string | null,
  to: string,
  subject: string,
  text: string,
) {
  await db.query(
    `INSERT INTO outbox_events(id,store_id,topic,payload) VALUES($1,$2,'email',$3)`,
    [crypto.randomUUID(), storeId, JSON.stringify({ to, subject, text })],
  );
}
export async function rateLimit(db: DB, key: string, limit = 30) {
  const rows = await db.query(
    `INSERT INTO rate_limits(key,hits) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.window_start<now()-interval '10 minutes' THEN 1 ELSE rate_limits.hits+1 END,window_start=CASE WHEN rate_limits.window_start<now()-interval '10 minutes' THEN now() ELSE rate_limits.window_start END RETURNING hits`,
    [key],
  );
  assert(
    rows[0].hits <= limit,
    429,
    "Terlalu banyak permintaan. Coba lagi beberapa menit lagi.",
  );
}
export async function authRoutes(
  _db: DB,
  request: Request,
  _env: AuthConfig,
  user: Identity | null,
  path: string,
): Promise<Response | undefined> {
  if (path === "/api/auth/me" && request.method === "GET")
    return json({ user });
  if (/^\/api\/auth\/(register|login|verify|resend|logout)$/.test(path))
    return json(
      { error: "Gunakan Firebase Authentication untuk mengelola akun." },
      410,
    );
}
export async function encryptedToken(raw: string, env: AuthConfig) {
  assert(env.TOKEN_SECRET, 503, "Layanan belum dikonfigurasi.");
  return seal(raw, env.TOKEN_SECRET);
}

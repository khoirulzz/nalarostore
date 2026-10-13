import type { DB } from "./db";
import { assert, json } from "./security";
import { audit, storeAccess, type Identity } from "./auth";
export async function domainProof(
  db: DB,
  hostname: string,
  rootDomain: string,
) {
  assert(
    hostname.endsWith("." + rootDomain),
    404,
    "Alamat toko tidak ditemukan.",
  );
  const row = (
    await db.query(
      "SELECT store_id,hostname FROM store_domains WHERE hostname=$1 AND kind='platform'",
      [hostname],
    )
  )[0];
  assert(row, 404, "Alamat toko tidak ditemukan.");
  return json({
    store_id: row.store_id,
    hostname: row.hostname,
    platform: rootDomain,
  });
}
export async function verifyDomain(
  db: DB,
  sid: string,
  user: Identity | null,
  rootDomain: string,
) {
  const store = await storeAccess(db, user, sid, true);
  const hostname = `${store.slug}.${rootDomain}`;
  let proof: { store_id?: string; hostname?: string; platform?: string };
  try {
    const response = await fetch(
      `https://${hostname}/.well-known/nalarostore-domain`,
      { redirect: "error", signal: AbortSignal.timeout(5000) },
    );
    assert(response.ok, 409, "Subdomain belum terhubung.");
    const reader = response.body?.getReader();
    assert(reader, 409, "Subdomain belum terhubung.");
    let text = "";
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      text += new TextDecoder().decode(r.value);
      if (text.length > 2000) {
        await reader.cancel();
        assert(false, 409, "Respons verifikasi tidak valid.");
      }
    }
    proof = JSON.parse(text);
  } catch {
    assert(
      false,
      409,
      "Subdomain belum siap. Gunakan alamat toko pada platform sementara admin menyiapkan DNS dan HTTPS.",
    );
  }
  assert(
    proof.store_id === sid &&
      proof.hostname === hostname &&
      proof.platform === rootDomain,
    409,
    "Subdomain mengarah ke layanan yang berbeda.",
  );
  await db.tx(async (tx) => {
    await tx.query(
      "UPDATE store_domains SET verification_status='verified' WHERE store_id=$1 AND hostname=$2 AND kind='platform'",
      [sid, hostname],
    );
    await audit(tx, user!.id, sid, "domain.verify", "store", sid);
  });
  return json({ hostname, verified: true });
}

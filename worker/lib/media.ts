import type { DB } from "./db";
import { assert, id, json } from "./security";
import {
  audit,
  requireUser,
  storeAccess,
  type Identity,
  rateLimit,
} from "./auth";
import { entitlement, incrementUsage } from "./billing";
export function imageMime(b: Uint8Array) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const dimensions = (w: number, h: number) =>
    w > 0 && h > 0 && w <= 8192 && h <= 8192 && w * h <= 30000000;
  if (
    b.length >= 45 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v) &&
    new TextDecoder().decode(b.slice(12, 16)) === "IHDR" &&
    new TextDecoder().decode(b.slice(-8, -4)) === "IEND" &&
    dimensions(view.getUint32(16), view.getUint32(20))
  )
    return "image/png";
  if (
    b.length >= 24 &&
    b[0] === 255 &&
    b[1] === 216 &&
    b[b.length - 2] === 255 &&
    b[b.length - 1] === 217
  ) {
    let offset = 2;
    while (offset + 9 < b.length) {
      if (b[offset] !== 255) break;
      const marker = b[offset + 1];
      if (marker === 0xda) break;
      const size = view.getUint16(offset + 2);
      if (size < 2 || offset + size + 2 > b.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return dimensions(
          view.getUint16(offset + 7),
          view.getUint16(offset + 5),
        )
          ? "image/jpeg"
          : null;
      offset += size + 2;
    }
  }
  if (
    b.length >= 30 &&
    new TextDecoder().decode(b.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(b.slice(8, 12)) === "WEBP" &&
    view.getUint32(4, true) + 8 === b.length
  ) {
    const chunk = new TextDecoder().decode(b.slice(12, 16));
    let w = 0,
      h = 0;
    if (chunk === "VP8X") {
      w = 1 + b[24] + (b[25] << 8) + (b[26] << 16);
      h = 1 + b[27] + (b[28] << 8) + (b[29] << 16);
    } else if (
      chunk === "VP8 " &&
      b[23] === 0x9d &&
      b[24] === 0x01 &&
      b[25] === 0x2a
    ) {
      w = view.getUint16(26, true) & 0x3fff;
      h = view.getUint16(28, true) & 0x3fff;
    } else if (chunk === "VP8L" && b[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      w = (bits & 0x3fff) + 1;
      h = ((bits >>> 14) & 0x3fff) + 1;
    }
    return dimensions(w, h) ? "image/webp" : null;
  }
  return null;
}
export async function upload(
  db: DB,
  request: Request,
  user: Identity | null,
  sid: string,
  bucket: R2Bucket | undefined,
) {
  id.parse(sid);
  await storeAccess(db, user, sid, true);
  requireUser(user);
  await rateLimit(db, "upload:" + user.id, 30);
  assert(bucket, 503, "Penyimpanan gambar belum tersedia.");
  const max = 5 * 1024 * 1024;
  assert(
    Number(request.headers.get("content-length") || 0) <= max,
    413,
    "Maksimal ukuran gambar 5 MB.",
  );
  const reader = request.body?.getReader();
  assert(reader, 400, "Gambar diperlukan.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const p = await reader.read();
    if (p.done) break;
    size += p.value.length;
    if (size > max) {
      await reader.cancel();
      assert(false, 413, "Maksimal ukuran gambar 5 MB.");
    }
    chunks.push(p.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  const mime = imageMime(bytes);
  assert(
    mime && mime === request.headers.get("content-type")?.split(";")[0],
    400,
    "Gunakan gambar JPG, PNG atau WebP yang valid.",
  );
  const key = `${sid}/${crypto.randomUUID()}.${mime.split("/")[1]}`;
  await db
    .tx(async (tx) => {
      await tx.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [sid]);
      await entitlement(tx, sid, "media_bytes", size);
      await incrementUsage(tx, sid, "media_bytes", size);
      await bucket.put(key, bytes, { httpMetadata: { contentType: mime } });
      await audit(tx, user.id, sid, "media.upload", "media", key, { size });
    })
    .catch(async (e) => {
      await bucket.delete(key);
      throw e;
    });
  return json({ key, url: "/api/media/" + key }, 201);
}

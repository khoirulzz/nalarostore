import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
} from "jose";
import { z } from "zod";
import { assert, HttpError } from "./security";

export type FirebaseConfig = {
  APP_ENV: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_AUTH_EMULATOR_HOST?: string;
};
const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
const accountSchema = z.object({
  users: z
    .array(
      z.object({
        localId: z.string().min(1).max(128),
        email: z.email(),
        emailVerified: z.boolean().optional(),
        disabled: z.boolean().optional(),
        validSince: z.string().optional(),
      }),
    )
    .min(1)
    .max(1),
});

export async function verifyFirebaseToken(raw: string, env: FirebaseConfig) {
  assert(
    env.FIREBASE_PROJECT_ID && env.FIREBASE_API_KEY,
    503,
    "Firebase Auth belum dikonfigurasi.",
  );
  assert(raw.length <= 12000, 401, "Sesi tidak valid. Masuk kembali.");
  let payload: JWTPayload;
  const emulator = env.FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator) {
    assert(
      env.APP_ENV === "development" || env.APP_ENV === "test",
      503,
      "Emulator hanya tersedia untuk pengujian lokal.",
    );
    assert(
      /^(localhost|127\.0\.0\.1):\d+$/.test(emulator),
      503,
      "Alamat emulator harus lokal.",
    );
    try {
      payload = decodeJwt(raw);
    } catch {
      throw new HttpError(401, "Sesi tidak valid. Masuk kembali.");
    }
    assert(
      payload.iss ===
        `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` &&
        payload.aud === env.FIREBASE_PROJECT_ID &&
        typeof payload.exp === "number" &&
        payload.exp > Date.now() / 1000,
      401,
      "Sesi tidak valid. Masuk kembali.",
    );
  } else {
    try {
      ({ payload } = await jwtVerify(raw, keys, {
        algorithms: ["RS256"],
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        audience: env.FIREBASE_PROJECT_ID,
        requiredClaims: ["exp", "iat", "auth_time", "sub"],
        clockTolerance: 5,
      }));
    } catch {
      throw new HttpError(
        401,
        "Sesi berakhir atau tidak valid. Masuk kembali.",
      );
    }
  }
  assert(
    typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      payload.sub.length <= 128 &&
      typeof payload.auth_time === "number" &&
      payload.auth_time <= Date.now() / 1000 + 5 &&
      typeof payload.iat === "number" &&
      payload.iat <= Date.now() / 1000 + 5,
    401,
    "Sesi tidak valid.",
  );
  // Check the authoritative account so disabled accounts and revoked refresh tokens
  // cannot keep using an otherwise correctly signed ID token.
  const origin = emulator
    ? `http://${emulator}/identitytoolkit.googleapis.com`
    : "https://identitytoolkit.googleapis.com";
  let response: Response;
  try {
    response = await fetch(
      `${origin}/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: raw }),
        signal: AbortSignal.timeout(8000),
      },
    );
  } catch {
    throw new HttpError(503, "Layanan akun sedang tidak tersedia. Coba lagi.");
  }
  assert(
    response.status < 500 && response.status !== 429,
    503,
    "Layanan akun sedang sibuk. Coba lagi.",
  );
  assert(response.ok, 401, "Sesi berakhir. Masuk kembali.");
  const parsed = accountSchema.safeParse(await response.json());
  assert(parsed.success, 401, "Akun tidak tersedia.");
  const user = parsed.data.users[0];
  assert(
    user.localId === payload.sub &&
      !user.disabled &&
      (!user.validSince || payload.auth_time >= Number(user.validSince)),
    401,
    "Sesi dicabut. Masuk kembali.",
  );
  return {
    uid: user.localId,
    email: user.email.toLowerCase(),
    verified: user.emailVerified === true,
  };
}

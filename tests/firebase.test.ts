import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyFirebaseToken } from "../worker/lib/firebase";
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: { keys: unknown[] };
const env = {
  APP_ENV: "production",
  FIREBASE_PROJECT_ID: "nalarostore",
  FIREBASE_API_KEY: "test-key",
};
const now = () => Math.floor(Date.now() / 1000);
beforeAll(async () => {
  pair = await generateKeyPair("RS256");
  const key = await exportJWK(pair.publicKey);
  jwks = { keys: [{ ...key, alg: "RS256", use: "sig", kid: "firebase-test" }] };
});
afterEach(() => vi.restoreAllMocks());
async function signed(
  values: Record<string, unknown> = {},
  overridePair = pair,
) {
  return new SignJWT({
    auth_time: now() - 10,
    email: "owner@test.invalid",
    email_verified: true,
    ...values,
  })
    .setProtectedHeader({ alg: "RS256", kid: "firebase-test" })
    .setIssuer("https://securetoken.google.com/nalarostore")
    .setAudience("nalarostore")
    .setSubject("firebase-user")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(overridePair.privateKey);
}
function responses(account: Record<string, unknown> = {}) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      String(input).includes("googleapis.com/service_accounts/")
        ? Response.json(jwks)
        : Response.json({
            users: [
              {
                localId: "firebase-user",
                email: "owner@test.invalid",
                emailVerified: true,
                ...account,
              },
            ],
          }),
    );
}
describe("Firebase server trust boundary", () => {
  it("verifies signed tokens and authoritative account state", async () => {
    responses();
    expect(await verifyFirebaseToken(await signed(), env)).toEqual({
      uid: "firebase-user",
      email: "owner@test.invalid",
      verified: true,
    });
  });
  it("rejects forged signatures, expired tokens and tokens from another project", async () => {
    responses();
    await expect(
      verifyFirebaseToken(
        await signed({}, await generateKeyPair("RS256")),
        env,
      ),
    ).rejects.toMatchObject({ status: 401 });
    const expired = await new SignJWT({ auth_time: now() - 100 })
      .setProtectedHeader({ alg: "RS256", kid: "firebase-test" })
      .setIssuer("https://securetoken.google.com/nalarostore")
      .setAudience("nalarostore")
      .setSubject("firebase-user")
      .setIssuedAt(now() - 100)
      .setExpirationTime(now() - 20)
      .sign(pair.privateKey);
    await expect(verifyFirebaseToken(expired, env)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      verifyFirebaseToken(await signed(), {
        ...env,
        FIREBASE_PROJECT_ID: "other-project",
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejects disabled accounts, revoked sessions and inconsistent account UID", async () => {
    const mock = responses({ disabled: true });
    await expect(
      verifyFirebaseToken(await signed(), env),
    ).rejects.toMatchObject({ status: 401 });
    mock.mockResolvedValue(
      Response.json({
        users: [
          {
            localId: "firebase-user",
            email: "owner@test.invalid",
            validSince: String(now()),
          },
        ],
      }),
    );
    await expect(
      verifyFirebaseToken(await signed(), env),
    ).rejects.toMatchObject({ status: 401 });
    mock.mockResolvedValue(
      Response.json({
        users: [{ localId: "different-user", email: "owner@test.invalid" }],
      }),
    );
    await expect(
      verifyFirebaseToken(await signed(), env),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("never accepts unsigned emulator tokens in production", async () => {
    await expect(
      verifyFirebaseToken("fake", {
        ...env,
        FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

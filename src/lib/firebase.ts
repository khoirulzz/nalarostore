import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  browserLocalPersistence,
  setPersistence,
  type Auth,
  type PasswordValidationStatus,
} from "firebase/auth";

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
export const firebaseConfigured =
  !!projectId && !!import.meta.env.VITE_FIREBASE_API_KEY;
export const firebaseEmulated = !!import.meta.env
  .VITE_FIREBASE_AUTH_EMULATOR_URL;
let firebaseAuth: Auth | null = null;
if (firebaseConfigured) {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  firebaseAuth = getAuth(app);
  firebaseAuth.languageCode = "id";
  const emulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
  if (emulator) {
    const url = new URL(emulator);
    if (!import.meta.env.DEV && import.meta.env.MODE !== "test")
      throw Error(
        "Emulator Firebase tidak boleh digunakan dalam build produksi.",
      );
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      throw Error("Alamat emulator harus localhost.");
    connectAuthEmulator(firebaseAuth, emulator, { disableWarnings: true });
  }
}
export const auth = firebaseAuth;
export const authReady = auth
  ? setPersistence(auth, browserLocalPersistence).then(() =>
      auth!.authStateReady(),
    )
  : Promise.resolve();
export function requireFirebase() {
  if (!auth)
    throw Error(
      "Konfigurasi Firebase belum diisi. Lengkapi .env.local untuk masuk.",
    );
  return auth;
}
export async function authorizationHeaders(): Promise<Record<string, string>> {
  await authReady;
  return auth?.currentUser
    ? { authorization: "Bearer " + (await auth.currentUser.getIdToken()) }
    : {};
}
export const passwordFallback = {
  min: 8,
  max: 4096,
  uppercase: true,
  lowercase: true,
  numeric: true,
  special: false,
};
export function passwordRules(
  password: string,
  status?: PasswordValidationStatus,
) {
  const p = status?.passwordPolicy.customStrengthOptions;
  const min = p?.minPasswordLength ?? passwordFallback.min;
  const max = p?.maxPasswordLength ?? passwordFallback.max;
  return [
    { text: `Minimal ${min} karakter`, valid: password.length >= min },
    { text: `Maksimal ${max} karakter`, valid: password.length <= max },
    ...((p?.containsUppercaseLetter ?? passwordFallback.uppercase)
      ? [{ text: "Huruf besar (A–Z)", valid: /[A-Z]/.test(password) }]
      : []),
    ...((p?.containsLowercaseLetter ?? passwordFallback.lowercase)
      ? [{ text: "Huruf kecil (a–z)", valid: /[a-z]/.test(password) }]
      : []),
    ...((p?.containsNumericCharacter ?? passwordFallback.numeric)
      ? [{ text: "Angka (0–9)", valid: /[0-9]/.test(password) }]
      : []),
    ...((p?.containsNonAlphanumericCharacter ?? passwordFallback.special)
      ? [{ text: "Karakter khusus", valid: /[^A-Za-z0-9]/.test(password) }]
      : []),
  ];
}
export function authError(error: unknown) {
  const code = (error as { code?: string }).code;
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email atau kata sandi tidak cocok.",
    "auth/wrong-password": "Email atau kata sandi tidak cocok.",
    "auth/user-not-found": "Email atau kata sandi tidak cocok.",
    "auth/email-already-in-use":
      "Email belum dapat digunakan. Coba masuk atau pulihkan kata sandi.",
    "auth/invalid-email": "Periksa kembali alamat emailmu.",
    "auth/weak-password": "Kata sandi belum memenuhi persyaratan di bawah.",
    "auth/password-does-not-meet-requirements":
      "Kata sandi belum memenuhi persyaratan di bawah.",
    "auth/too-many-requests":
      "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
    "auth/network-request-failed":
      "Koneksi terputus. Periksa internet dan coba lagi.",
    "auth/expired-action-code": "Tautan sudah kedaluwarsa. Minta tautan baru.",
    "auth/invalid-action-code": "Tautan tidak valid atau sudah digunakan.",
    "auth/user-disabled": "Akun dinonaktifkan. Hubungi dukungan Nalaro.",
    "auth/requires-recent-login":
      "Masuk kembali sebelum mengubah keamanan akun.",
    "auth/operation-not-allowed":
      "Login email dan kata sandi belum diaktifkan di Firebase.",
    "auth/unauthorized-continue-uri":
      "Alamat aplikasi belum diizinkan pada pengaturan Firebase.",
  };
  return (
    (code && messages[code]) ||
    (code
      ? "Layanan akun belum tersedia. Coba lagi."
      : (error as Error).message || "Permintaan belum berhasil.")
  );
}

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build" && mode === "production") {
    const required = [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
    ];
    const missing = required.filter((key) => !env[key]?.trim());
    if (missing.length)
      throw Error(`Production Firebase Web configuration missing: ${missing.join(", ")}. Set Pages build variables or update the public .env.production fallback.`);
    console.info("Production Firebase Web configuration: ready (6 public variables).");
  }
  if (
    command === "build" &&
    mode !== "test" &&
    (env.VITE_FIREBASE_AUTH_EMULATOR_URL || env.FIREBASE_AUTH_EMULATOR_HOST)
  )
    throw Error(
      "Firebase Auth Emulator tidak boleh masuk ke build produksi. Kosongkan konfigurasi emulator.",
    );
  return {
    plugins: [react()],
    server: { port: 5173 },
    build: { target: "es2022", outDir: "dist" },
  };
});

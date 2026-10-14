import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
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

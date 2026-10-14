import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

export function localMedia(directory: string): R2Bucket {
  const root = resolve(directory);
  function file(key: string) {
    if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpeg|webp)$/.test(key))
      throw Error("Invalid media key");
    const path = resolve(root, key),
      rel = relative(root, path);
    if (rel.startsWith(".." + sep) || rel === "..")
      throw Error("Invalid media path");
    return path;
  }
  return {
    async put(key: string, value: Uint8Array) {
      const path = file(key);
      await mkdir(resolve(path, ".."), { recursive: true });
      await writeFile(path, value);
      return null;
    },
    async delete(key: string) {
      await rm(file(key), { force: true });
    },
    async get(key: string) {
      try {
        const bytes = await readFile(file(key));
        return {
          body: new Blob([bytes]).stream(),
          httpMetadata: {
            contentType: key.endsWith(".png")
              ? "image/png"
              : key.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg",
          },
        };
      } catch {
        return null;
      }
    },
  } as R2Bucket;
}

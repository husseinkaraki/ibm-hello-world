import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { MAX_IMAGE_BYTES, validateImage, VeoError } from "./veo-contract.ts";

/** User-supplied Lucy asset; deliberately independent of Google credential bindings. */
export async function loadLucyReference() {
  try {
    const path = join(process.cwd(), "content/finding-love-at-a-hackathon/media/lucy.png");
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_IMAGE_BYTES) throw new Error("Invalid asset");
    const bytes = new Uint8Array(await readFile(path));
    validateImage(bytes, "image/png");
    return { bytes, mimeType: "image/png", fingerprint: createHash("sha256").update(bytes).digest("hex") };
  } catch { throw new VeoError("Lucy's reference photo is unavailable. Please try again shortly.", 503); }
}

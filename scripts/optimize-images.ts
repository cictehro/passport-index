import fs from "fs";
import path from "path";
import sharp from "sharp";
import { log, group } from "./log.ts";

const SOURCE_ORDER = ["full", "xxxlarge", "xxlarge", "xlarge", "large", "medium", "small", "thumb"] as const;
const TARGETS = [
  { name: "icon", width: 40 },
  { name: "hero", width: 192 },
] as const;

const OUT_DIR = "./generated/images/passport-covers";
const MANIFEST_PATH = "./generated/passport-cover-manifest.json";

function bestSourceUrl(entry: Record<string, string>): string | null {
  for (const key of SOURCE_ORDER) {
    if (entry[key]) return entry[key];
  }
  return null;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": "passport-index-crawler/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

log("reading ./data/passport_cover_images.json");
const covers: Record<string, Record<string, string>> = JSON.parse(
  fs.readFileSync("./data/passport_cover_images.json", "utf8")
);
const codes = Object.keys(covers);
log(`${codes.length} passport codes`);

fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest: Record<string, Record<string, string>> = {};
let ok = 0;
let skipped = 0;
let failed = 0;

await group("optimize-images: fetch + resize + encode", async () => {
  for (const code of codes) {
    const src = bestSourceUrl(covers[code]);
    if (!src) {
      skipped++;
      continue;
    }
    try {
      const buf = await fetchBuffer(src);
      manifest[code] = {};
      for (const { name, width } of TARGETS) {
        const outFile = `${code}-${width}.webp`;
        await sharp(buf)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(path.join(OUT_DIR, outFile));
        manifest[code][name] = `images/passport-covers/${outFile}`;
      }
      ok++;
    } catch (e) {
      log(`${code}: FAILED (${e})`);
      failed++;
    }
  }
});

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
log(`done: ${ok} ok, ${skipped} skipped (no source), ${failed} failed`);

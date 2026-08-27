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
const USER_AGENT = "passport-index-crawler/1.0 (https://github.com/savvydarknight/r-passe; contact: 153359624+savvydarknight@users.noreply.github.com)";
const REQUEST_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bestSourceUrl(entry: Record<string, string>): string | null {
  for (const key of SOURCE_ORDER) {
    if (entry[key]) return entry[key];
  }
  return null;
}

async function fetchBuffer(url: string, retried = false): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 429 && !retried) {
    await sleep(5000);
    return fetchBuffer(url, true);
  }
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
    await sleep(REQUEST_DELAY_MS);
  }
});

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
log(`done: ${ok} ok, ${skipped} skipped (no source), ${failed} failed`);

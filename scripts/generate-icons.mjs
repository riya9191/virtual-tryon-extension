import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// sharp is a backend dependency; resolve it from there rather than requiring a
// separate install for this one-off asset script.
const require = createRequire(resolve(here, "../backend/package.json"));
const sharp = require("sharp");

const outDir = resolve(here, "../extension/public/icons");
const sizes = [16, 32, 48, 128];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#4338CA"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M53 40a11 11 0 1 1 15 10v9"/>
    <path d="M68 59 104 88a5 5 0 0 1-3 9H27a5 5 0 0 1-3-9l36-29z"/>
  </g>
  <circle cx="99" cy="34" r="7" fill="#FDE68A"/>
</svg>`;

await mkdir(outDir, { recursive: true });

const source = Buffer.from(svg);
await Promise.all(
  sizes.map(async (size) => {
    const png = await sharp(source, { density: 384 }).resize(size, size).png().toBuffer();
    await writeFile(resolve(outDir, `icon-${size}.png`), png);
    console.log(`wrote icon-${size}.png (${png.length} bytes)`);
  }),
);

await writeFile(resolve(outDir, "icon.svg"), svg, "utf8");
console.log("wrote icon.svg");

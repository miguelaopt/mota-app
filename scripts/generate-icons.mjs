// Gera os ícones PWA a partir de scripts/icon.svg.
// Uso: node scripts/generate-icons.mjs
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("./icon.svg", import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

const render = (size) => sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 });

await render(192).toFile(out("icon-192.png"));
await render(512).toFile(out("icon-512.png"));
await render(180).toFile(out("apple-touch-icon.png"));
await render(32).toFile(out("favicon-32.png"));

// Maskable: o conteúdo tem de caber no círculo central (80%), por isso
// reduz-se o desenho e mantém-se o fundo a toda a área.
const inner = await sharp(svg, { density: 384 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#e0621a" } })
  .composite([{ input: inner, top: 56, left: 56 }])
  .png({ compressionLevel: 9 })
  .toFile(out("maskable-512.png"));

console.log("Ícones gerados em public/icons/");

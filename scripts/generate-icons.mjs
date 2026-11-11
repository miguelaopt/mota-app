// Gera os ícones PWA e a ilustração da mota a partir de scripts/z400.svg.
// Uso: node scripts/generate-icons.mjs
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const bikeSvg = await readFile(new URL("./z400.svg", import.meta.url), "utf8");
// Conteúdo da ilustração sem o elemento <svg> exterior, para a compor noutros enquadramentos.
const bike = bikeSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

/** Fundo de estúdio: onyx, luz suave de cima, reflexo jade no chão e grão fino. */
function icon({ scale, tx, ty, floorY }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="studio" cx="0.55" cy="0.28" r="0.85">
      <stop offset="0" stop-color="#2c3137"/>
      <stop offset="0.55" stop-color="#111316"/>
      <stop offset="1" stop-color="#08090a"/>
    </radialGradient>
    <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#2af5b3" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#2af5b3" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#studio)"/>
  <ellipse cx="560" cy="${floorY}" rx="430" ry="46" fill="url(#floor)"/>
  <path d="M0 ${floorY + 2} H1024" stroke="#2af5b3" stroke-opacity="0.18" stroke-width="2"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})">${bike}</g>
  <rect width="1024" height="1024" filter="url(#grain)"/>
</svg>`;
}

const render = (svg, size) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 });

// Ícone normal: mota grande, cortada atrás, com a frente e o farol em destaque.
const main = icon({ scale: 1.3, tx: -352, ty: -40, floorY: 858 });
// Maskable: a mota inteira dentro da zona segura (círculo de 80%).
const maskable = icon({ scale: 0.84, tx: 0, ty: 160, floorY: 742 });

await mkdir(out("icons"), { recursive: true });
await render(main, 1024).toFile(out("icons/icon-1024.png"));
await render(main, 512).toFile(out("icons/icon-512.png"));
await render(main, 192).toFile(out("icons/icon-192.png"));
await render(main, 180).toFile(out("icons/apple-touch-icon.png"));
await render(main, 32).toFile(out("icons/favicon-32.png"));
await render(maskable, 512).toFile(out("icons/maskable-512.png"));

// Ilustração usada no Início quando ainda não há foto da mota.
await mkdir(out("illustrations"), { recursive: true });
await sharp(Buffer.from(bikeSvg), { density: 192 }).resize(1200, 760).webp({ quality: 88 }).toFile(out("illustrations/z400.webp"));

console.log("Ícones e ilustração gerados em public/");

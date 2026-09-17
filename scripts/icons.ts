/** Renders the app icon PNGs from assets/icon.svg with Sharp. */
import sharp from 'sharp';
import { mkdirSync, copyFileSync } from 'node:fs';

const src = 'assets/icon.svg';
const out = 'public/icons';
mkdirSync(out, { recursive: true });

async function png(name: string, size: number, pad = 0) {
  const inner = Math.round(size * (1 - pad * 2));
  const img = sharp(src).resize(inner, inner);
  if (pad > 0) {
    await sharp({ create: { width: size, height: size, channels: 4, background: '#0E100C' } })
      .composite([{ input: await img.png().toBuffer(), gravity: 'centre' }])
      .png()
      .toFile(`${out}/${name}`);
  } else {
    await img.png().toFile(`${out}/${name}`);
  }
  console.log('wrote', name, size);
}

await png('apple-touch-icon.png', 180);
await png('icon-192.png', 192);
await png('icon-512.png', 512);
await png('icon-512-maskable.png', 512, 0.1);
copyFileSync(src, `${out}/icon.svg`);

import sharp from "sharp";
import { writeFileSync } from "fs";

// Create SVG source — Atlas Paving icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#1d3c6e"/>
  <path d="M256 80L400 224H304V420H208V224H112L256 80Z" fill="white" opacity="0.96"/>
  <rect x="170" y="356" width="172" height="40" rx="20" fill="#f59e0b"/>
</svg>`;

const svgBuf = Buffer.from(svg);

for (const size of [192, 512]) {
  const out = await sharp(svgBuf).resize(size, size).png().toBuffer();
  writeFileSync(`client/public/icon-${size}.png`, out);
  console.log(`icon-${size}.png written`);
}

// 180px apple touch icon
const apple = await sharp(svgBuf).resize(180, 180).png().toBuffer();
writeFileSync("client/public/apple-touch-icon.png", apple);
console.log("apple-touch-icon.png written");

// favicon 32px
const fav = await sharp(svgBuf).resize(32, 32).png().toBuffer();
writeFileSync("client/public/favicon.png", fav);
console.log("favicon.png written");

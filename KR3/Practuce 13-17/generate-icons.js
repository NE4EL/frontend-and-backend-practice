const sharp = require('sharp');
const path = require('path');

const svgBell = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#4285f4"/>
  <path d="M50,13 C48,13 46.5,14.5 46.5,17
           C36,19.5 28,30 28,43
           L28,61 L21,67 L21,71
           L79,71 L79,67 L72,61
           L72,43 C72,30 64,19.5 53.5,17
           C53.5,14.5 52,13 50,13 Z"
        fill="white"/>
  <circle cx="50" cy="79" r="6.5" fill="white"/>
</svg>`;

const sizes = [16, 32, 48, 64, 128, 256, 512];
const iconsDir = path.join(__dirname, 'icons');

(async () => {
    for (const size of sizes) {
        await sharp(Buffer.from(svgBell))
            .resize(size, size)
            .png()
            .toFile(path.join(iconsDir, `favicon-${size}x${size}.png`));
        console.log(`  ✓ favicon-${size}x${size}.png`);
    }

    await sharp(Buffer.from(svgBell))
        .resize(32, 32)
        .png()
        .toFile(path.join(iconsDir, 'favicon.ico'));
    console.log('  ✓ favicon.ico');
    console.log('Иконки сгенерированы.');
})();

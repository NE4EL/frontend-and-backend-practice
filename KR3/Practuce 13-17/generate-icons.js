const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
    const len = Buffer.allocUnsafe(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([typeB, data]));
    const crcB = Buffer.allocUnsafe(4);
    crcB.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeB, data, crcB]);
}

function createPNG(w, h, r, g, b) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdr = Buffer.allocUnsafe(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    const row = Buffer.allocUnsafe(1 + w * 3);
    row[0] = 0;
    for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }

    const raw = Buffer.concat(Array.from({ length: h }, () => row));
    const compressed = zlib.deflateSync(raw);

    return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

const iconsDir = path.join(__dirname, 'icons');
const [r, g, b] = [66, 133, 244];

[16, 32, 48, 64, 128, 256, 512].forEach(size => {
    const file = path.join(iconsDir, `favicon-${size}x${size}.png`);
    fs.writeFileSync(file, createPNG(size, size, r, g, b));
    console.log(`  ✓ favicon-${size}x${size}.png`);
});

fs.writeFileSync(path.join(iconsDir, 'favicon.ico'), createPNG(32, 32, r, g, b));
console.log('  ✓ favicon.ico');
console.log('Иконки сгенерированы.');

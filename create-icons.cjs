// Create PNG icon files for PWA
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// CRC32 calculation function
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) & 0xFFFFFFFF;
}

const crc32Table = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let n = 0; n < 8; n++) {
    if (c & 1) c = 0xEDB88320 ^ (c >> 1);
    else c = c >> 1;
  }
  crc32Table[i] = c;
}

// Create PNG function
function createPNG(width, height) {
  // Raw row data: filter byte (0) + width*3 RGB bytes (solid blue: 0,0,255)
  const rawRow = Buffer.alloc(3 * width + 1);
  rawRow[0] = 0; // filter type = 0 (none)
  for (let i = 0; i < width; i++) {
    rawRow[1 + i * 3] = 0;     // R
    rawRow[2 + i * 3] = 0;     // G
    rawRow[3 + i * 3] = 255;   // B
  }
  
  // Compress with zlib
  const compressed = zlib.deflateSync(rawRow);
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // Width and height as 4-byte big-endian
  const widthBuf = Buffer.alloc(4);
  widthBuf.writeUInt32BE(width, 0);
  const heightBuf = Buffer.alloc(4);
  heightBuf.writeUInt32BE(height, 0);
  
  // IHDR chunk data: width(4) + height(4) + bit_depth(1) + color_type(1) + compression(1) + filter(1) + interlace(1) = 13 bytes
  const ihdrData = Buffer.concat([widthBuf, heightBuf, Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00])]);
  
  // IHDR chunk: length(4) + type('IHDR'(4)) + data(13) + crc(4)
  const ihdrType = Buffer.from('IHDR', 'ascii');
  const icrc = crc32(Buffer.concat([ihdrType, ihdrData]));
  const ihdrChunk = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, ihdrData.length]),
    ihdrType,
    ihdrData,
    Buffer.from([icrc >> 24, (icrc >> 16) & 0xFF, (icrc >> 8) & 0xFF, icrc & 0xFF])
  ]);
  
  // IDAT chunk
  const idatChunk = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, compressed.length]),
    Buffer.from('IDAT', 'ascii'),
    compressed,
    Buffer.alloc(4) // CRC placeholder
  ]);
  
  // IEND chunk (CRC is known: 0xAE426082)
  const iendChunk = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0]),
    Buffer.from('IEND', 'ascii'),
    Buffer.from([0xAE, 0x42, 0x60, 0x82])
  ]);
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Create all required icon sizes
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of iconSizes) {
  const png = createPNG(size, size);
  const filename = path.join(__dirname, 'icons', `icon-${size}x${size}.png`);
  fs.writeFileSync(filename, png);
  console.log('Created icon-' + size + 'x' + size + '.png');
}

console.log('All PNG icons created successfully!');
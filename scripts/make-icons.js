import fs from "fs";
import zlib from "zlib";

function createPNG(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);

    // CRC32
    let c = 0xffffffff;
    const bufToCrc = Buffer.concat([typeBuf, data]);
    for (let i = 0; i < bufToCrc.length; i++) {
      c ^= bufToCrc[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    crcBuf.writeInt32BE(~c, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdrChunk = makeChunk("IHDR", ihdr);

  // Scanlines: width * 3 + 1 filter byte per line
  const rawData = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    const offset = y * (width * 3 + 1);
    rawData[offset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      // Gradient effect
      const t = y / height;
      rawData[px] = Math.floor(r * (1 - t * 0.3));
      rawData[px + 1] = Math.floor(g * (1 - t * 0.2));
      rawData[px + 2] = Math.floor(b * (1 + t * 0.2));
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressedData);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const icon192 = createPNG(192, 192, 5, 150, 105); // emerald color #059669
const icon512 = createPNG(512, 512, 5, 150, 105);

fs.writeFileSync("public/icon-192.png", icon192);
fs.writeFileSync("public/icon-512.png", icon512);
console.log("Generated PWA icons successfully!");
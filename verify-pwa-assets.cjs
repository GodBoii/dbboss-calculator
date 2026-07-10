const fs = require("fs");

const requiredPngs = [
  { file: "public/lakshmi-boss-192.png", width: 192, height: 192 },
  { file: "public/lakshmi-boss-512.png", width: 512, height: 512 },
];

function readPngSize(file) {
  const buffer = fs.readFileSync(file);
  const isPng = buffer.toString("hex", 0, 8) === "89504e470d0a1a0a";

  if (!isPng) {
    throw new Error(`${file} is not a PNG file.`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

for (const asset of requiredPngs) {
  if (!fs.existsSync(asset.file)) {
    throw new Error(`Missing required PWA icon: ${asset.file}`);
  }

  const size = readPngSize(asset.file);
  if (size.width !== asset.width || size.height !== asset.height) {
    throw new Error(
      `${asset.file} must be ${asset.width}x${asset.height}, got ${size.width}x${size.height}.`,
    );
  }
}

console.log("PWA assets verified.");

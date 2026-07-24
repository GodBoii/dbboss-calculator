const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));
const serviceWorker = fs.readFileSync("public/sw.js", "utf8");
const appVersionSource = fs.readFileSync("src/lib/app-version.ts", "utf8");
const expectedVersion = packageJson.version;
const versions = {
  "package-lock.json": packageLock.version,
  "package-lock root package": packageLock.packages?.[""]?.version,
  "public/manifest.json": manifest.version,
};

for (const [source, version] of Object.entries(versions)) {
  if (version !== expectedVersion) {
    throw new Error(
      `Version mismatch: package.json=${expectedVersion}, ${source}=${version}.`,
    );
  }
}

if (!serviceWorker.includes(`const APP_VERSION = "${expectedVersion}";`)) {
  throw new Error(`public/sw.js does not use app version ${expectedVersion}.`);
}
if (!appVersionSource.includes(`APP_VERSION = "${expectedVersion}"`)) {
  throw new Error(`src/lib/app-version.ts does not use app version ${expectedVersion}.`);
}

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

console.log(`PWA assets and version ${expectedVersion} verified.`);

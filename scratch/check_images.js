const fs = require('fs');
const path = require('path');

function checkPngDimensions(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`${filePath}: FILE NOT FOUND`);
      return;
    }
    const buffer = fs.readFileSync(fullPath);
    // Verify PNG signature
    const signature = buffer.toString('hex', 0, 8);
    if (signature !== '89504e470d0a1a0a') {
      console.log(`${filePath}: Not a valid PNG file (Signature: ${signature})`);
      return;
    }
    
    // Check IHDR
    const ihdr = buffer.toString('ascii', 12, 16);
    if (ihdr !== 'IHDR') {
      console.log(`${filePath}: Could not find IHDR chunk`);
      return;
    }
    
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    console.log(`${filePath}: Size is ${width}x${height}`);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
}

console.log('Checking icons:');
checkPngDimensions('public/dbboss-192.png');
checkPngDimensions('public/dbboss-512.png');
checkPngDimensions('public/dbboss.png');
checkPngDimensions('public/logo.png');
checkPngDimensions('public/logo1.png');

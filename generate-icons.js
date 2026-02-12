import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputFile = join(__dirname, 'static', 'favicon.png');

async function generateIcons() {
  try {
    // Generate 180x180 for Apple Touch Icon
    await sharp(inputFile)
      .resize(180, 180)
      .toFile(join(__dirname, 'static', 'apple-touch-icon.png'));
    console.log('✓ Generated apple-touch-icon.png (180x180)');

    // Generate 192x192 for PWA
    await sharp(inputFile)
      .resize(192, 192)
      .toFile(join(__dirname, 'static', 'icon-192.png'));
    console.log('✓ Generated icon-192.png (192x192)');

    // Generate 512x512 for PWA
    await sharp(inputFile)
      .resize(512, 512)
      .toFile(join(__dirname, 'static', 'icon-512.png'));
    console.log('✓ Generated icon-512.png (512x512)');

    console.log('\nAll icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

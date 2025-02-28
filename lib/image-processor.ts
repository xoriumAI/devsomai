import sharp from 'sharp';
import { Buffer } from 'buffer';

const MAX_IMAGE_SIZE = 1024; // Maximum dimension size
const QUALITY = 85; // Image quality for JPEG/PNG

export interface ProcessedImage {
  buffer: Buffer;
  format: string;
  size: number;
}

export async function processImage(file: Buffer, mimeType: string): Promise<ProcessedImage> {
  let image = sharp(file);
  const metadata = await image.metadata();

  // Resize if necessary while maintaining aspect ratio
  if (metadata.width && metadata.height) {
    if (metadata.width > MAX_IMAGE_SIZE || metadata.height > MAX_IMAGE_SIZE) {
      image = image.resize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
  }

  // Convert to appropriate format and optimize
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      image = image.jpeg({ quality: QUALITY });
      break;
    case 'image/png':
      image = image.png({ quality: QUALITY });
      break;
    case 'image/gif':
      image = image.gif();
      break;
    default:
      image = image.png({ quality: QUALITY });
  }

  const processedBuffer = await image.toBuffer();
  
  return {
    buffer: processedBuffer,
    format: mimeType,
    size: processedBuffer.length
  };
} 
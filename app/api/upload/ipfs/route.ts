import { NextResponse } from 'next/server';
import sharp from 'sharp';
import FormData from 'form-data';
import axios from 'axios';

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image types for token
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif'
];

// Initialize Pinata client
async function uploadToPinata(imageBuffer: Buffer, fileName: string) {
  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  const data = new FormData();
  data.append('file', imageBuffer, {
    filename: fileName,
    contentType: 'image/png',
  });

  try {
    const response = await axios.post(url, data, {
      maxBodyLength: Infinity,
      headers: {
        'Authorization': `Bearer ${process.env.PINATA_JWT}`,
        ...data.getHeaders()
      }
    });

    if (response.status === 200) {
      return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    }
    throw new Error('Failed to upload to Pinata');
  } catch (error) {
    console.error('Pinata upload error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to upload to Pinata');
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log('Starting file upload process...');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('Received request:', {
      fileSize: file?.size,
      fileType: file?.type,
      timestamp: new Date().toISOString()
    });

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          error: 'Invalid file type',
          details: `File must be one of: ${ALLOWED_TYPES.join(', ')}`,
          received: file.type
        },
        { status: 400 }
      );
    }

    console.log('Processing image...');
    // Process image
    const buffer = Buffer.from(await file.arrayBuffer());
    const processedImage = await sharp(buffer)
      .resize(800, 800, { fit: 'inside' })
      .png()
      .toBuffer();

    console.log('Image processed successfully');

    // Upload to Pinata with retry logic
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        console.log(`Upload attempt ${4 - retries}/3...`);
        const fileName = `image_${Date.now()}.png`;
        const url = await uploadToPinata(processedImage, fileName);
        
        const uploadTime = Date.now() - startTime;
        console.log('File upload completed:', {
          url,
          uploadTime: `${uploadTime}ms`,
          timestamp: new Date().toISOString()
        });

        return NextResponse.json({ 
          url,
          uploadTime,
          success: true
        });
      } catch (error) {
        lastError = error;
        console.error('Upload attempt failed:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: 4 - retries,
          timestamp: new Date().toISOString()
        });
        
        retries--;
        if (retries > 0) {
          console.log(`Retrying upload in 2 seconds... (${retries} attempts remaining)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError;
  } catch (error) {
    console.error('Detailed error in upload endpoint:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to upload file',
        timestamp: new Date().toISOString(),
        uploadTime: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

// Add GET endpoint for cost estimation
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileSize = searchParams.get('fileSize');
    
    if (!fileSize) {
      return NextResponse.json(
        { error: 'File size parameter is required' },
        { status: 400 }
      );
    }

    const size = parseInt(fileSize);
    if (isNaN(size)) {
      return NextResponse.json(
        { error: 'Invalid file size parameter' },
        { status: 400 }
      );
    }

    // Validate file size
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json({
        valid: false,
        error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        maxSize: MAX_FILE_SIZE,
        currentSize: size
      });
    }

    // Return storage information
    return NextResponse.json({
      valid: true,
      cost: 0, // Pinata has a free tier
      maxSize: MAX_FILE_SIZE,
      currentSize: size,
      provider: 'Pinata',
      features: [
        'Free tier available',
        'Content-addressed via IPFS',
        'High availability',
        'Multiple gateways',
        'No expiration on free tier'
      ]
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to estimate storage cost',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 
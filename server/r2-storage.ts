import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";

/**
 * R2 Storage utility for uploading images to Cloudflare R2
 * R2 is S3-compatible, so we use the AWS SDK
 */

// Validate required environment variables
const requiredEnvVars = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL'
] as const;

// Check if R2 is configured
export function isR2Configured(): boolean {
  return requiredEnvVars.every(key => !!process.env[key]);
}

// Throw error if R2 is not configured
function validateR2Config() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missing.join(', ')}`);
  }
}

// Initialize R2 client (S3-compatible)
function getR2Client(): S3Client {
  validateR2Config();
  
  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  
  return new S3Client({
    region: 'auto', // R2 uses 'auto' for region
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Upload an image buffer to R2 storage
 * @param buffer Image file buffer
 * @param originalFilename Original filename (for extension)
 * @param mimeType MIME type of the image
 * @returns Public URL of the uploaded image
 */
export async function uploadImageToR2(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<string> {
  validateR2Config();
  
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;
  const publicUrl = process.env.R2_PUBLIC_URL!;
  const imagePath = process.env.R2_IMAGE_PATH || 'images';
  
  // Generate unique filename with original extension
  const extension = originalFilename.split('.').pop() || 'png';
  const uniqueId = nanoid(12);
  const timestamp = Date.now();
  const filename = `${timestamp}-${uniqueId}.${extension}`;
  
  // Full path in bucket
  const key = imagePath ? `${imagePath}/${filename}` : filename;
  
  try {
    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Make object publicly accessible (if bucket has public access enabled)
      // Note: You may need to configure bucket policies for public access
    });
    
    await client.send(command);
    
    // Construct public URL
    const imageUrl = `${publicUrl.replace(/\/$/, '')}/${key}`;
    
    console.log(`Image uploaded successfully: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate if a file is an allowed image type
 */
export function isValidImageType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * Validate image file size (max 10MB by default)
 */
export function isValidImageSize(sizeInBytes: number, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeInBytes <= maxSizeBytes;
}


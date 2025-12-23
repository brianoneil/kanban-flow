#!/usr/bin/env tsx
/**
 * Test script for multipart image upload
 * 
 * Usage:
 *   npm run test:upload <path-to-image> [width]
 * 
 * Example:
 *   npm run test:upload ./test-image.png
 *   npm run test:upload ./test-image.png 400
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';

const KANBAN_SERVER_URL = process.env.KANBAN_SERVER_URL || 'http://localhost:3000';

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml'
  };
  return mimeTypes[ext || ''] || 'image/png';
}

async function testImageUpload(filePath: string, width?: string) {
  console.log('\n📸 Image Upload Test\n');
  console.log('━'.repeat(50));
  console.log(`Server URL: ${KANBAN_SERVER_URL}`);
  console.log(`Image Path: ${filePath}`);
  console.log(`Width: ${width || 'auto'}`);
  console.log('━'.repeat(50));
  
  try {
    // Step 1: Read the file
    console.log('\n📂 Reading file...');
    const buffer = await readFile(filePath);
    const filename = basename(filePath);
    const mimeType = getMimeType(filename);
    const fileSize = buffer.length;
    
    console.log(`✓ File read successfully`);
    console.log(`  - Filename: ${filename}`);
    console.log(`  - MIME Type: ${mimeType}`);
    console.log(`  - Size: ${(fileSize / 1024).toFixed(2)} KB`);
    
    // Step 2: Create Blob and FormData
    console.log('\n📦 Creating multipart form data...');
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append('image', blob, filename);
    
    if (width) {
      formData.append('width', width);
    }
    
    console.log(`✓ FormData created`);
    
    // Step 3: Upload to server
    console.log('\n🚀 Uploading to server...');
    const startTime = Date.now();
    
    const response = await fetch(`${KANBAN_SERVER_URL}/api/upload-image`, {
      method: 'POST',
      body: formData
    });
    
    const uploadTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log(`✓ Upload successful (${uploadTime}ms)`);
    console.log('\n📊 Response:');
    console.log('━'.repeat(50));
    console.log(JSON.stringify(result, null, 2));
    console.log('━'.repeat(50));
    
    // Step 4: Verify the URL is accessible
    if (result.url) {
      console.log('\n🔍 Verifying uploaded image...');
      const verifyResponse = await fetch(result.url, { method: 'HEAD' });
      
      if (verifyResponse.ok) {
        const contentLength = verifyResponse.headers.get('content-length');
        const contentType = verifyResponse.headers.get('content-type');
        
        console.log(`✓ Image accessible at: ${result.url}`);
        console.log(`  - Content-Type: ${contentType}`);
        console.log(`  - Content-Length: ${contentLength ? `${(parseInt(contentLength) / 1024).toFixed(2)} KB` : 'unknown'}`);
      } else {
        console.log(`⚠️  Image URL returned 404 or error: ${verifyResponse.status}`);
      }
    }
    
    // Step 5: Display markdown
    if (result.markdown) {
      console.log('\n📝 Markdown to use in cards:');
      console.log('━'.repeat(50));
      console.log(result.markdown);
      console.log('━'.repeat(50));
    } else if (result.url) {
      // Generate markdown if server didn't return it (for older versions)
      const altText = filename.split('.')[0];
      const markdown = width ? `![${altText}|${width}](${result.url})` : `![${altText}](${result.url})`;
      console.log('\n📝 Markdown to use in cards:');
      console.log('━'.repeat(50));
      console.log(markdown);
      console.log('━'.repeat(50));
    }
    
    console.log('\n✅ Test completed successfully!\n');
    return result;
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error instanceof Error ? error.message : String(error));
    console.log('');
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('\n❌ Error: No image path provided\n');
  console.log('Usage:');
  console.log('  npm run test:upload <path-to-image> [width]\n');
  console.log('Examples:');
  console.log('  npm run test:upload ./test-image.png');
  console.log('  npm run test:upload ./screenshot.jpg 400');
  console.log('  npm run test:upload ~/Downloads/photo.png 50%\n');
  process.exit(1);
}

const filePath = args[0];
const width = args[1];

testImageUpload(filePath, width);


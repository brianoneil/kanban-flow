#!/usr/bin/env tsx
/**
 * Test script for MCP package image upload
 * 
 * This tests the actual npm package code path that Cursor uses
 * 
 * Usage:
 *   npm run test:mcp-upload <path-to-image> [width]
 * 
 * Example:
 *   npm run test:mcp-upload ./test-image.png
 *   npm run test:mcp-upload ./test-image.png 400
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

async function testMCPUpload(filePath: string, width?: string) {
  console.log('\n🤖 MCP Package Upload Test\n');
  console.log('━'.repeat(50));
  console.log('This test simulates what the npm package does');
  console.log('━'.repeat(50));
  console.log(`Server URL: ${KANBAN_SERVER_URL}`);
  console.log(`Image Path: ${filePath}`);
  console.log(`Width: ${width || 'auto'}`);
  console.log('━'.repeat(50));
  
  try {
    // Step 1: Read the file (same as npm package)
    console.log('\n📂 Step 1: Reading file locally...');
    const buffer = await readFile(filePath);
    const filename = basename(filePath);
    const mimeType = getMimeType(filename);
    const fileSize = buffer.length;
    
    console.log(`✓ File read successfully`);
    console.log(`  - Filename: ${filename}`);
    console.log(`  - MIME Type: ${mimeType}`);
    console.log(`  - Size: ${(fileSize / 1024).toFixed(2)} KB`);
    
    // Step 2: Create Blob and FormData (same as npm package v1.2.4)
    console.log('\n📦 Step 2: Creating Blob and FormData (npm package logic)...');
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append('image', blob, filename);
    
    if (width) {
      formData.append('width', width);
    }
    
    console.log(`✓ FormData created with native Blob`);
    console.log(`  - Blob size: ${blob.size} bytes`);
    console.log(`  - Blob type: ${blob.type}`);
    
    // Step 3: Upload to server (same as npm package)
    console.log('\n🚀 Step 3: Uploading to remote server...');
    const startTime = Date.now();
    
    const response = await fetch(`${KANBAN_SERVER_URL}/api/upload-image`, {
      method: 'POST',
      body: formData
      // Note: No credentials needed for /api endpoints (auth bypassed)
    });
    
    const uploadTime = Date.now() - startTime;
    
    console.log(`  - Request completed in ${uploadTime}ms`);
    console.log(`  - Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log(`✓ Upload successful!`);
    
    // Step 4: Verify response format
    console.log('\n📊 Step 4: Validating response...');
    
    if (!result.url) {
      throw new Error('Response missing "url" field');
    }
    
    if (!result.markdown) {
      console.log('⚠️  Warning: Response missing "markdown" field');
    }
    
    console.log(`✓ Response validation passed`);
    console.log('\nFull Response:');
    console.log('━'.repeat(50));
    console.log(JSON.stringify(result, null, 2));
    console.log('━'.repeat(50));
    
    // Step 5: Verify the URL is accessible
    console.log('\n🔍 Step 5: Verifying image accessibility...');
    const verifyResponse = await fetch(result.url, { method: 'HEAD' });
    
    if (verifyResponse.ok) {
      const contentLength = verifyResponse.headers.get('content-length');
      const contentType = verifyResponse.headers.get('content-type');
      
      console.log(`✓ Image accessible at R2`);
      console.log(`  - URL: ${result.url}`);
      console.log(`  - Content-Type: ${contentType}`);
      console.log(`  - Content-Length: ${contentLength ? `${(parseInt(contentLength) / 1024).toFixed(2)} KB` : 'unknown'}`);
    } else {
      throw new Error(`Image URL returned ${verifyResponse.status}`);
    }
    
    // Step 6: Display markdown
    const markdown = result.markdown || (width ? `![${filename.split('.')[0]}|${width}](${result.url})` : `![${filename.split('.')[0]}](${result.url})`);
    
    console.log('\n📝 Step 6: Generated markdown:');
    console.log('━'.repeat(50));
    console.log(markdown);
    console.log('━'.repeat(50));
    
    // Step 7: Summary
    console.log('\n✅ MCP Package Upload Test PASSED!\n');
    console.log('Summary:');
    console.log(`  - Upload time: ${uploadTime}ms`);
    console.log(`  - File size: ${(fileSize / 1024).toFixed(2)} KB`);
    console.log(`  - R2 URL: ${result.url}`);
    console.log(`  - Width: ${width || 'none (full responsive)'}`);
    console.log('');
    
    return result;
    
  } catch (error) {
    console.error('\n❌ MCP Package Upload Test FAILED:');
    console.error('━'.repeat(50));
    console.error(error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    console.log('');
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('\n❌ Error: No image path provided\n');
  console.log('Usage:');
  console.log('  npm run test:mcp-upload <path-to-image> [width]\n');
  console.log('Examples:');
  console.log('  npm run test:mcp-upload ./test-image.png');
  console.log('  npm run test:mcp-upload ./screenshot.jpg 400');
  console.log('  npm run test:mcp-upload ~/Downloads/photo.png 50%\n');
  process.exit(1);
}

const filePath = args[0];
const width = args[1];

testMCPUpload(filePath, width);


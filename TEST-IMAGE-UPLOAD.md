# Image Upload Test

This test script verifies that the multipart image upload functionality works correctly before publishing the npm package.

## Prerequisites

1. Make sure the local development server is running:
   ```bash
   npm run dev
   ```

2. The server should be running on `http://localhost:3000` (or set `KANBAN_SERVER_URL` env var)

## Usage

```bash
npm run test:upload <path-to-image> [width]
```

### Examples

**Basic upload (no width constraint):**
```bash
npm run test:upload ~/Downloads/screenshot.png
```

**Upload with pixel width:**
```bash
npm run test:upload ~/Downloads/screenshot.png 400
```

**Upload with percentage width:**
```bash
npm run test:upload ~/Downloads/photo.jpg 50%
```

## What the Test Does

1. ✅ Reads the image file from disk
2. ✅ Creates a Blob and FormData (same as the npm package)
3. ✅ Uploads to the server using multipart/form-data
4. ✅ Verifies the upload was successful
5. ✅ Checks that the uploaded image is accessible at the R2 URL
6. ✅ Displays the markdown to use in cards

## Expected Output

```
📸 Image Upload Test

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server URL: http://localhost:3000
Image Path: /Users/you/screenshot.png
Width: 400
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Reading file...
✓ File read successfully
  - Filename: screenshot.png
  - MIME Type: image/png
  - Size: 156.23 KB

📦 Creating multipart form data...
✓ FormData created

🚀 Uploading to server...
✓ Upload successful (892ms)

📊 Response:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "success": true,
  "url": "https://kanban-img.brainivylabs.com/kanban-flow-images/...",
  "markdown": "![screenshot|400](https://...)",
  "filename": "screenshot.png",
  "size": 159984,
  "mimeType": "image/png",
  "message": "Image uploaded successfully!..."
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Verifying uploaded image...
✓ Image accessible at: https://kanban-img.brainivylabs.com/...
  - Content-Type: image/png
  - Content-Length: 156.23 KB

📝 Markdown to use in cards:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
![screenshot|400](https://kanban-img.brainivylabs.com/...)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Test completed successfully!
```

## Troubleshooting

### Server not running
```
❌ Test failed:
API request failed: fetch failed
```
**Solution:** Start the dev server with `npm run dev`

### File not found
```
❌ Test failed:
ENOENT: no such file or directory
```
**Solution:** Check the file path is correct

### R2 not configured
```
❌ Test failed:
Upload failed: 503 Image upload is not configured
```
**Solution:** Make sure R2 environment variables are set in `.env`

### Image too large
```
❌ Test failed:
Upload failed: 400 Image file is too large. Maximum size is 10MB.
```
**Solution:** Use a smaller image (max 10MB)

## Quick Test Commands

Using a test image from node_modules:
```bash
npm run test:upload node_modules/passport/sponsors/workos.png
npm run test:upload node_modules/passport/sponsors/workos.png 200
```

Using your own screenshot:
```bash
npm run test:upload ~/Desktop/screenshot.png
npm run test:upload ~/Downloads/photo.jpg 50%
```


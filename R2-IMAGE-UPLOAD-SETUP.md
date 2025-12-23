# R2 Image Upload Setup Guide

This guide explains how to configure Cloudflare R2 storage for image uploads in KanbanFlow.

## 🎯 Overview

The image upload feature allows users to:
- **Drag & drop** images directly into card descriptions
- **Paste** images from clipboard
- **Upload via MCP tools** for automated workflows
- **View images** inline with markdown rendering
- **Click to expand** images in a full-screen lightbox

All images are stored in Cloudflare R2 (S3-compatible) storage.

---

## 📋 Prerequisites

1. A Cloudflare account
2. An R2 bucket created
3. R2 access keys generated

---

## 🔧 Setting Up Cloudflare R2

### Step 1: Create an R2 Bucket

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name your bucket (e.g., `kanbanflow-images`)
5. Click **Create bucket**

### Step 2: Enable Public Access (Optional but Recommended)

To make uploaded images publicly accessible:

1. Go to your bucket settings
2. Navigate to **Settings** → **Public access**
3. Click **Connect domain** or **Allow Access**
4. Configure a custom domain or use the R2.dev subdomain
5. Note the public URL (e.g., `https://pub-xxxxx.r2.dev`)

### Step 3: Generate API Keys

1. In Cloudflare dashboard, go to **R2** → **Manage R2 API Tokens**
2. Click **Create API Token**
3. Configure permissions:
   - **Permissions**: Object Read & Write
   - **Bucket**: Select your specific bucket or all buckets
   - **TTL**: Set expiration (or "Forever" for development)
4. Click **Create API Token**
5. **IMPORTANT**: Copy the following values immediately:
   - `Access Key ID`
   - `Secret Access Key`
   - `Account ID`

---

## ⚙️ Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# R2 Storage Configuration (for image uploads)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=kanbanflow-images
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
R2_IMAGE_PATH=images
```

### Environment Variable Details

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Your Cloudflare account ID | `abc123def456` |
| `R2_ACCESS_KEY_ID` | R2 API access key | `xxxxxxxxxxxxxxxxxxxx` |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key | `yyyyyyyyyyyyyyyyyyyy` |
| `R2_BUCKET_NAME` | Name of your R2 bucket | `kanbanflow-images` |
| `R2_PUBLIC_URL` | Public URL for accessing images | `https://pub-xxxxx.r2.dev` |
| `R2_IMAGE_PATH` | Directory path within bucket (optional) | `images` |

---

## 🚀 Deployment (Dokku)

For Dokku deployment, set the environment variables using:

```bash
dokku config:set kanbanflow \
  R2_ACCOUNT_ID=your-account-id \
  R2_ACCESS_KEY_ID=your-access-key \
  R2_SECRET_ACCESS_KEY=your-secret-key \
  R2_BUCKET_NAME=kanbanflow-images \
  R2_PUBLIC_URL=https://pub-xxxxx.r2.dev \
  R2_IMAGE_PATH=images
```

Or set them one by one:

```bash
dokku config:set kanbanflow R2_ACCOUNT_ID=your-account-id
dokku config:set kanbanflow R2_ACCESS_KEY_ID=your-access-key
dokku config:set kanbanflow R2_SECRET_ACCESS_KEY=your-secret-key
dokku config:set kanbanflow R2_BUCKET_NAME=kanbanflow-images
dokku config:set kanbanflow R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
dokku config:set kanbanflow R2_IMAGE_PATH=images
```

---

## 🧪 Testing the Setup

### Test 1: Check Configuration

Start your dev server:
```bash
npm run dev
```

The server will log if R2 is configured correctly.

### Test 2: Upload via UI

1. Open KanbanFlow in your browser
2. Create or edit a card
3. Drag & drop an image into the description field
4. You should see an upload progress indicator
5. The markdown `![image](url)` should be inserted
6. The image should display in the card

### Test 3: Upload via MCP Tool

Use Claude or another MCP client:

```
Upload this image and create a card with it:
[Attach or describe an image]
```

The MCP server will:
1. Accept the base64-encoded image
2. Upload to R2
3. Return the markdown syntax
4. Create the card with the image embedded

---

## 📁 Image Organization

Images are organized in R2 as follows:

```
bucket-name/
  └── images/                    # R2_IMAGE_PATH
      ├── 1234567890-abc123.png
      ├── 1234567891-def456.jpg
      └── 1234567892-ghi789.webp
```

**Filename format**: `{timestamp}-{unique-id}.{extension}`

- `timestamp`: Unix timestamp in milliseconds
- `unique-id`: 12-character nanoid for uniqueness
- `extension`: Original file extension

---

## 🔒 Security Considerations

### 1. API Keys
- **Never commit** R2 credentials to version control
- Use environment variables in all environments
- Rotate keys periodically

### 2. Bucket Permissions
- Configure bucket policies to restrict access if needed
- Consider enabling CORS for browser uploads
- Review R2 access logs periodically

### 3. File Validation
The server automatically validates:
- ✅ File type (JPEG, PNG, GIF, WebP, SVG only)
- ✅ File size (10MB max)
- ✅ Authentication required for uploads

---

## 🎨 Frontend Features

### Drag & Drop
- Drag an image onto any textarea (description/notes)
- Visual feedback with blue overlay
- Automatic upload and markdown insertion

### Paste from Clipboard
- Copy an image (screenshot, from browser, etc.)
- Paste into textarea (`Ctrl/Cmd + V`)
- Automatic upload and insertion

### Image Rendering
- **Inline display**: Images render directly in markdown
- **Responsive sizing**: Max-width prevents layout breaks
- **Lazy loading**: Images load as needed for performance
- **Click to expand**: Full-screen lightbox view
- **Error handling**: Graceful fallback for broken images

---

## 🔧 Troubleshooting

### "Image upload is not configured"

**Cause**: R2 environment variables are missing or incorrect

**Solution**:
1. Verify all R2 environment variables are set
2. Check for typos in variable names
3. Restart the server after setting variables
4. Check console logs for specific errors

### "Failed to upload image"

**Cause**: R2 API keys may be invalid or permissions insufficient

**Solution**:
1. Verify API keys are correct
2. Check that API token has "Object Read & Write" permissions
3. Ensure bucket name matches exactly
4. Check R2 account status

### Images not displaying

**Cause**: Public URL may be incorrect or bucket not public

**Solution**:
1. Verify `R2_PUBLIC_URL` is correct
2. Check bucket public access settings
3. Test URL directly in browser
4. Check CORS settings if serving from different domain

### "File is too large"

**Cause**: Image exceeds 10MB limit

**Solution**:
1. Compress the image before uploading
2. Convert to WebP format for better compression
3. Consider adjusting `MAX_FILE_SIZE` in `r2-storage.ts` if needed

---

## 💰 Cost Considerations

Cloudflare R2 pricing (as of 2024):
- **Storage**: $0.015 per GB/month
- **Class A Operations** (writes): $4.50 per million
- **Class B Operations** (reads): $0.36 per million
- **No egress fees** 🎉

**Example**: 10GB of images with 100K reads/month ≈ $0.15/month

---

## 🔄 Migration & Backup

### Backup Images

Use `rclone` to backup your R2 bucket:

```bash
# Configure rclone
rclone config

# Sync to local backup
rclone sync r2:kanbanflow-images /backup/images
```

### Migrate from Another Provider

If migrating from S3/other:

```bash
# Use rclone to copy
rclone copy s3:old-bucket r2:kanbanflow-images
```

---

## 🎉 You're All Set!

Your KanbanFlow board now supports rich image uploads! Users can:
- ✅ Drag & drop images into cards
- ✅ Paste screenshots directly
- ✅ View images inline with beautiful rendering
- ✅ Click to expand images full-screen
- ✅ Use MCP tools for automated workflows

**Need help?** Check the console logs or review the implementation in:
- Backend: `server/r2-storage.ts` and `server/routes.ts`
- Frontend: `client/src/lib/image-upload-utils.ts`
- Components: `client/src/components/*-dialog.tsx`


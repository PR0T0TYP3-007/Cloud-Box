# AWS S3 Storage Migration Guide

## Overview

The Cloud-Box system has been migrated from local filesystem storage to AWS S3. All file uploads, downloads, and thumbnails are now stored in an S3 bucket instead of the local `uploads/` directory.

## What Changed

### 1. **Storage Service**
- Created `S3StorageService` in `src/common/s3-storage.service.ts`
- Handles all S3 operations (upload, download, delete, metadata)
- Supports both AWS S3 and S3-compatible services (MinIO, LocalStack)

### 2. **Files Service** (`src/files/providers/files.service.ts`)
- Removed local filesystem operations (`fs.writeFileSync`, `fs.createReadStream`, etc.)
- Updated `uploadFile()` to upload directly to S3
- Updated `getFileStream()` to download from S3
- S3 keys follow pattern: `users/{userId}/files/{fileId}{extension}`

### 3. **Preview Service** (`src/files/providers/preview.service.ts`)
- Removed local thumbnail directory (`uploads/thumbnails`)
- Thumbnails now generated and cached in S3
- S3 keys for thumbnails: `thumbnails/{fileId}.webp`
- Thumbnail generation downloads original from S3, processes with Sharp, and re-uploads

### 4. **Files Module** (`src/files/files.module.ts`)
- Added `S3StorageService` as a provider

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the Cloud-Box root directory with the following:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Optional: S3-Compatible Services

For services like MinIO or LocalStack:

```env
AWS_S3_ENDPOINT=http://localhost:9000
```

## AWS S3 Setup

### 1. Create an S3 Bucket

```bash
# Using AWS CLI
aws s3 mb s3://your-bucket-name --region us-east-1
```

Or create via AWS Console:
1. Go to AWS S3 Console
2. Click "Create bucket"
3. Enter bucket name
4. Select region
5. Configure settings as needed
6. Create bucket

### 2. Create IAM User and Policy

Create an IAM user with programmatic access and attach this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name/*",
        "arn:aws:s3:::your-bucket-name"
      ]
    }
  ]
}
```

### 3. Configure CORS (if needed for direct uploads)

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["http://localhost:5173", "https://your-domain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Migration Path for Existing Data

If you have existing files in the local `uploads/` directory, you need to migrate them to S3:

### Option 1: Migration Script (Recommended)

Create a migration script to upload existing files:

```typescript
// scripts/migrate-to-s3.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

async function migrateFiles() {
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const uploadsDir = path.join(__dirname, '../uploads');
  
  // Recursively upload all files
  // ... implementation details
}
```

### Option 2: AWS CLI Sync

```bash
aws s3 sync ./uploads/ s3://your-bucket-name/migration/ --recursive
```

Then update database records to point to new S3 keys.

## Testing

### 1. Local Development with MinIO

For local testing without AWS costs:

```bash
# Start MinIO with Docker
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

Create bucket:
```bash
# Install mc (MinIO Client)
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/cloud-box
```

Update `.env`:
```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=cloud-box
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_S3_ENDPOINT=http://localhost:9000
```

### 2. Test File Operations

1. **Upload Test**: Upload a file via API
2. **Download Test**: Download the file and verify content
3. **Thumbnail Test**: Request thumbnail for an image
4. **Delete Test**: Soft delete a file (S3 file remains)

## Deployment Checklist

- [ ] Create S3 bucket in production region
- [ ] Create IAM user with appropriate permissions
- [ ] Configure bucket policies (private by default)
- [ ] Set environment variables on production server
- [ ] Test all file operations in staging
- [ ] Migrate existing files (if any)
- [ ] Update database storagePath fields to S3 keys
- [ ] Monitor S3 costs and usage
- [ ] Set up lifecycle policies for old versions/thumbnails (optional)

## Cost Considerations

### S3 Pricing (approximate, varies by region)
- **Storage**: ~$0.023 per GB/month
- **PUT requests**: ~$0.005 per 1,000 requests
- **GET requests**: ~$0.0004 per 1,000 requests
- **Data transfer out**: First 1GB free, then ~$0.09/GB

### Optimization Tips
1. Enable S3 Intelligent-Tiering for automatic cost optimization
2. Set lifecycle policies to delete old thumbnails after X days
3. Use CloudFront CDN for frequently accessed files
4. Compress images before upload
5. Implement file size limits

## Troubleshooting

### "Missing required S3 configuration" Error
- Check all AWS environment variables are set
- Verify `.env` file is loaded (install `@nestjs/config` if needed)

### "Access Denied" Errors
- Verify IAM user has correct permissions
- Check bucket policy allows access
- Ensure credentials are correct

### Slow Upload/Download
- Check network connectivity to S3 region
- Consider using S3 Transfer Acceleration
- Optimize file sizes before upload

### Thumbnail Generation Fails
- Ensure Sharp is installed: `npm install sharp`
- Check original file is valid image format
- Verify S3 permissions allow GetObject

## Rollback Plan

If you need to rollback to local storage:

1. Revert the following files:
   - `src/files/providers/files.service.ts`
   - `src/files/providers/preview.service.ts`
   - `src/files/files.module.ts`

2. Remove S3StorageService dependency

3. Restore local filesystem operations

4. Ensure `uploads/` directory exists

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)

## Support

For issues or questions:
1. Check error logs in NestJS console
2. Verify S3 bucket access via AWS CLI
3. Review IAM permissions
4. Check CloudWatch logs (if enabled)

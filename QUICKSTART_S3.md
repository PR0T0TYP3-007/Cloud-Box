# Quick Start: S3 Storage Setup

This guide will help you get up and running with AWS S3 storage in under 10 minutes.

## Step 1: Install Dependencies (Already Done ✅)

The required AWS SDK packages are already installed:
```bash
npm list | grep @aws-sdk
# Should show:
# @aws-sdk/client-s3@3.962.0
# @aws-sdk/lib-storage@3.962.0
```

## Step 2: Choose Your S3 Option

### Option A: AWS S3 (Production)

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://my-cloudbox-bucket --region us-east-1
   ```

2. **Create IAM User** (via AWS Console)
   - Go to IAM → Users → Add User
   - Enable "Programmatic access"
   - Attach policy (see below)
   - Save Access Key ID and Secret Access Key

3. **IAM Policy** (attach to user)
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:HeadObject"],
       "Resource": "arn:aws:s3:::my-cloudbox-bucket/*"
     }]
   }
   ```

### Option B: MinIO (Local Development)

1. **Start MinIO with Docker**
   ```bash
   docker run -d -p 9000:9000 -p 9001:9001 \
     --name minio \
     -e "MINIO_ROOT_USER=minioadmin" \
     -e "MINIO_ROOT_PASSWORD=minioadmin" \
     minio/minio server /data --console-address ":9001"
   ```

2. **Create Bucket**
   - Open http://localhost:9001
   - Login: minioadmin / minioadmin
   - Create bucket: "cloudbox"

   OR via CLI:
   ```bash
   # Install mc (MinIO Client)
   brew install minio/stable/mc  # macOS
   # OR download from: https://min.io/docs/minio/linux/reference/minio-mc.html

   mc alias set local http://localhost:9000 minioadmin minioadmin
   mc mb local/cloudbox
   ```

## Step 3: Configure Environment Variables

Copy the example file:
```bash
cd Cloud-Box
cp .env.example .env
```

Edit `.env`:

### For AWS S3:
```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-cloudbox-bucket
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### For MinIO:
```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=cloudbox
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_S3_ENDPOINT=http://localhost:9000
```

## Step 4: Test Connection

```bash
cd Cloud-Box
npx ts-node scripts/test-s3-connection.ts
```

You should see:
```
=== AWS S3 Connection Test ===
✅ Test file uploaded successfully
✅ Test file downloaded successfully
✅ Test file deleted successfully
=== All tests passed! ===
```

## Step 5: Start Application

```bash
npm run start:dev
```

## Step 6: Test File Upload

Using curl:
```bash
# Register a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  -c cookies.txt

# Upload a file
curl -X POST http://localhost:3000/files/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.txt" \
  -F "folderId=null" \
  -b cookies.txt
```

Or use the HTTP test files in `Cloud-Box/src/Http/`:
- Open `file-upload.endpoint.http`
- Update credentials
- Click "Send Request" in VS Code with REST Client extension

## Step 7: Verify in S3

### AWS S3:
```bash
aws s3 ls s3://my-cloudbox-bucket/users/ --recursive
```

### MinIO:
```bash
mc ls local/cloudbox/users/ --recursive
```

Or check MinIO console: http://localhost:9001

## Troubleshooting

### Error: "Missing required S3 configuration"
→ Check that .env file exists and has all AWS_* variables

### Error: "Access Denied"
→ Check IAM permissions or MinIO credentials

### Error: "NoSuchBucket"
→ Create the bucket first

### Error: "Network timeout"
→ Check AWS_S3_ENDPOINT is correct for MinIO

### Application starts but uploads fail
→ Run `npx ts-node scripts/test-s3-connection.ts` to diagnose

## Next Steps

- [ ] Migrate existing files (if any): `npx ts-node scripts/migrate-local-to-s3.ts`
- [ ] Set up bucket lifecycle policies (AWS)
- [ ] Enable versioning on bucket (optional)
- [ ] Configure CloudFront CDN (production)
- [ ] Set up monitoring and alerts

## Quick Reference

**Environment Variables:**
- `AWS_REGION` - AWS region (default: us-east-1)
- `AWS_S3_BUCKET` - Bucket name (required)
- `AWS_ACCESS_KEY_ID` - AWS credentials (required)
- `AWS_SECRET_ACCESS_KEY` - AWS credentials (required)
- `AWS_S3_ENDPOINT` - Custom endpoint (optional, for MinIO)

**File Locations:**
- S3 Service: `src/common/s3-storage.service.ts`
- Files Service: `src/files/providers/files.service.ts`
- Preview Service: `src/files/providers/preview.service.ts`

**S3 Key Patterns:**
- Files: `users/{userId}/files/{fileId}{ext}`
- Thumbnails: `thumbnails/{fileId}.webp`

## Getting Help

- Full migration guide: [S3_MIGRATION_GUIDE.md](S3_MIGRATION_GUIDE.md)
- Changes summary: [S3_MIGRATION_CHANGES.md](S3_MIGRATION_CHANGES.md)
- AWS S3 Docs: https://docs.aws.amazon.com/s3/
- MinIO Docs: https://min.io/docs/

---

**Estimated Setup Time**: 5-10 minutes
**Difficulty**: Easy

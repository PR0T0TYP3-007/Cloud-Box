# Deploy to Render with Supabase

Quick guide to deploy Cloud-Box on Render using Supabase.

## Prerequisites

1. **Supabase Account** - https://supabase.com (free tier)
2. **Render Account** - https://render.com (free tier)
3. **AWS S3** - For file storage
4. **GitHub** - Code repository

## Step 1: Supabase Setup (5 min)

1. Create new project at https://supabase.com
2. Go to **Settings** → **Database**
3. Copy **Connection string** (use Transaction Mode, port 6543)
4. Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

## Step 2: Push to GitHub

```bash
git add .
git commit -m "Add Render deployment config"
git push origin main
```

## Step 3: Deploy on Render

### Option A: Blueprint (Recommended)
1. Go to https://dashboard.render.com
2. Click **New** → **Blueprint**
3. Connect your GitHub repo
4. Render detects `render.yaml` automatically

### Option B: Manual
1. **New** → **Web Service**
2. Connect repository
3. **Build**: `npm install && npm run build`
4. **Start**: `npm run start:prod`

## Step 4: Environment Variables

Add these in Render dashboard:

```env
DATABASE_URL=<your-supabase-connection-string>
JWT_SECRET=<generate-random-32-char-string>
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=<your-aws-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret>
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

## Step 5: Deploy

Click **Create Web Service** or **Apply** (Blueprint)

Your API will be live at: `https://cloud-box-api.onrender.com`

## Verify Deployment

```bash
# Health check
curl https://your-service.onrender.com

# Test signup
curl -X POST https://your-service.onrender.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","username":"testuser"}'
```

## Troubleshooting

**Build fails**: Check logs in Render dashboard
**DB connection error**: Verify DATABASE_URL is correct
**CORS issues**: Add frontend URL to ALLOWED_ORIGINS

## Important Notes

- ⚠️ Free tier services sleep after 15 min of inactivity
- ⚠️ First request after sleep takes ~30 seconds
- ⚠️ Upgrade to paid tier ($7/mo) for always-on service
- ✅ Supabase provides 500MB free database
- ✅ SSL/HTTPS included automatically

## Support

- [Render Docs](https://render.com/docs)
- [Supabase Docs](https://supabase.com/docs)

# Deployment Guide

## 🚀 Vercel Deployment

### Step 1: Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository: `zionren/OJTblogsite`

### Step 2: Configure Environment Variables
In Vercel project settings, add these environment variables:

```
DATABASE_URL=your_supabase_postgresql_url
JWT_SECRET=your_jwt_secret_key
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password
```

### Step 3: Deploy
- Vercel will automatically deploy using the `vercel.json` configuration
- Your app will be available at `https://your-project.vercel.app`

## 🔧 Environment Variables Setup

### Database URL
Your PostgreSQL connection string from Supabase:
```
postgresql://username:password@host:port/database
```

### JWT Secret
Generate a secure random string:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Admin Credentials
Set your admin email and password for accessing `/admin`

## 📋 Pre-deployment Checklist

✅ **Repository Setup**
- [x] Git repository initialized
- [x] Files committed to GitHub
- [x] Remote origin set to: https://github.com/zionren/OJTblogsite.git

✅ **Vercel Configuration**
- [x] `vercel.json` created with proper routing
- [x] Package.json updated with deployment scripts
- [x] Server.js modified for Vercel compatibility

✅ **Environment Variables**
- [ ] Set DATABASE_URL in Vercel
- [ ] Set JWT_SECRET in Vercel  
- [ ] Set ADMIN_EMAIL in Vercel
- [ ] Set ADMIN_PASSWORD in Vercel

✅ **Database**
- [x] Supabase PostgreSQL configured
- [x] Database schema auto-creates on first run
- [x] Sample posts included

## 🔄 Continuous Deployment

Once connected to Vercel:
- Push to `main` branch to deploy automatically
- Preview deployments for pull requests
- Environment variables managed in Vercel dashboard

## 🌐 Custom Domain (Optional)

To use a custom domain:
1. Go to Vercel project settings
2. Add your domain in "Domains" section
3. Update DNS records as instructed

## 🐛 Troubleshooting

### Common Issues:
1. **Database Connection**: Ensure DATABASE_URL is properly encoded
2. **Environment Variables**: Check all required variables are set
3. **Build Errors**: Verify Node.js version compatibility (>=18.0.0)

### Logs Access:
- View deployment logs in Vercel dashboard
- Runtime logs available in Functions tab

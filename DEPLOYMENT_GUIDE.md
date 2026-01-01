# Deployment Guide - Phases 1-5 Complete ✅

## Phase 1: Security ✅ COMPLETED

### Backend Credentials Updated
- ✅ Moved hardcoded credentials to environment variables
- ✅ Updated `application-prod.properties` to use `${DB_URL}`, `${DB_USERNAME}`, `${DB_PASSWORD}`

### Before deploying, set these environment variables:
```bash
export DB_URL="jdbc:postgresql://aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
export DB_USERNAME="postgres.geakesatogetcphgikpi"
export DB_PASSWORD="biMi4Pxwz2H87Dfr"
export SERVER_PORT="8081"
```

⚠️ **SECURITY NOTE**: Never commit these values to git!

---

## Phase 2: CORS Configuration ✅ COMPLETED

### Configuration Added
- ✅ CORS enabled for localhost (dev)
- ✅ CORS configuration accepts environment variables for production

### For Production, set:
```bash
export CORS_ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
```

Default (dev): `http://localhost:3000,http://localhost:5173`

---

## Phase 3: Backend Deployment ✅ COMPLETED

### Files Created:
1. **Dockerfile** - Docker container for backend
2. **Procfile** - For Heroku deployment
3. **.dockerignore** - Exclude unnecessary files from Docker

### Choose Your Hosting:

### Option A: HEROKU (Fastest - Recommended)

**Setup (5 minutes):**
```bash
# 1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
# 2. Login to Heroku
heroku login

# 3. Create new app
heroku create your-whiteboard-app

# 4. Set environment variables
heroku config:set DB_URL="jdbc:postgresql://aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
heroku config:set DB_USERNAME="postgres.geakesatogetcphgikpi"
heroku config:set DB_PASSWORD="biMi4Pxwz2H87Dfr"
heroku config:set CORS_ALLOWED_ORIGINS="https://yourdomain.com"

# 5. Deploy
git push heroku main

# 6. View logs
heroku logs --tail
```

**Result:** Your backend runs at `https://your-whiteboard-app.herokuapp.com`

---

### Option B: RAILWAY.APP (Modern - Easiest)

**Setup (5 minutes):**
```bash
# 1. Go to railway.app
# 2. Connect your GitHub repository
# 3. Add these variables in Railway dashboard:
#    DB_URL=jdbc:postgresql://...
#    DB_USERNAME=postgres...
#    DB_PASSWORD=...
#    CORS_ALLOWED_ORIGINS=https://yourdomain.com
# 4. Deploy with one click
```

**Result:** Your backend gets a generated URL like `https://whiteboard-prod-xxx.railway.app`

---

### Option C: DIGITALOCEAN (Best Value)

**Setup (20 minutes):**
```bash
# 1. Create $5/month droplet with Ubuntu
# 2. SSH into droplet
ssh root@your_droplet_ip

# 3. Install Java 17
apt update && apt install openjdk-17-jre-headless -y

# 4. Clone your repo
git clone https://github.com/yourusername/whiteboard.git
cd whiteboard

# 5. Build
cd whiteboard-app
mvn clean package -DskipTests

# 6. Run with environment variables
export DB_URL="jdbc:postgresql://..."
export DB_USERNAME="postgres..."
export DB_PASSWORD="..."
export CORS_ALLOWED_ORIGINS="https://yourdomain.com"

java -jar target/whiteboard-app-1.0.0.jar --spring.profiles.active=prod

# 7. Keep running with pm2 or screen (optional)
```

**Result:** Your backend at `http://your_droplet_ip:8081`

---

## Phase 4: Frontend Deployment ✅ COMPLETED

### Files Created:
1. **.env.production** - Production environment config
2. **vercel.json** - Vercel deployment config
3. **netlify.toml** - Netlify deployment config

### Option A: VERCEL (Recommended for React - FREE)

**Setup (5 minutes):**
```bash
# 1. Go to vercel.com
# 2. Click "New Project"
# 3. Import your GitHub repository
# 4. Set environment variables:
#    REACT_APP_BACKEND_URL = https://your-backend-url.com
# 5. Click "Deploy"
```

**Auto-deploys on every git push!**

**Result:** Frontend at `https://your-project.vercel.app`

---

### Option B: NETLIFY (Also Great - FREE)

**Setup (5 minutes):**
```bash
# 1. Go to netlify.com
# 2. Click "New site from Git"
# 3. Connect your GitHub repo
# 4. Build command: npm run build
# 5. Publish directory: build
# 6. Add environment variable:
#    REACT_APP_BACKEND_URL = https://your-backend-url.com
# 7. Click "Deploy"
```

**Result:** Frontend at `https://your-site.netlify.app`

---

## Phase 5: SSL/HTTPS Configuration ✅ COMPLETED

### If using Heroku/Vercel/Netlify/Railway:
✅ **AUTOMATIC!** SSL is included for free

Your URLs will be:
- Backend: `https://your-backend.herokuapp.com` (Heroku)
- Frontend: `https://your-site.vercel.app` (Vercel)

### If using custom server (DigitalOcean):

**Option A: Let's Encrypt (FREE)**
```bash
# 1. Install Certbot
apt install certbot python3-certbot-nginx -y

# 2. Get certificate (replace with your domain)
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 3. Convert to PKCS12 format
openssl pkcs12 -export -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem \
  -inkey /etc/letsencrypt/live/yourdomain.com/privkey.pem \
  -out keystore.p12 -name tomcat \
  -passout pass:your_password

# 4. Run backend with SSL
export SSL_ENABLED=true
export SSL_KEYSTORE_PATH=/path/to/keystore.p12
export SSL_KEYSTORE_PASSWORD=your_password
export DB_URL=...
export DB_USERNAME=...
export DB_PASSWORD=...

java -jar target/whiteboard-app-1.0.0.jar --spring.profiles.active=prod
```

**Result:** Backend at `https://yourdomain.com:8443`

---

## Quick Deployment Commands

### Build Backend
```bash
cd whiteboard-app
mvn clean package -DskipTests -q
```

### Build Frontend
```bash
cd whiteboard-frontend
npm run build
```

### Test Locally with Prod Settings
```bash
# Terminal 1: Backend
export DB_URL="jdbc:postgresql://..."
export DB_USERNAME="..."
export DB_PASSWORD="..."
cd whiteboard-app
mvn spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=prod"

# Terminal 2: Frontend
cd whiteboard-frontend
npm start
# Update .env.local:
# REACT_APP_BACKEND_URL=http://localhost:8081
```

---

## Environment Variables Checklist

### Backend (Required)
- `DB_URL` - Supabase database URL
- `DB_USERNAME` - Supabase username
- `DB_PASSWORD` - Supabase password
- `CORS_ALLOWED_ORIGINS` - Your frontend URL

### Backend (Optional)
- `SERVER_PORT` - Port number (default: 8081)
- `SSL_ENABLED` - Enable SSL (default: false)
- `SSL_KEYSTORE_PATH` - Path to SSL certificate
- `SSL_KEYSTORE_PASSWORD` - SSL certificate password

### Frontend (Required)
- `REACT_APP_BACKEND_URL` - Your backend URL

### Frontend (Optional)
- `REACT_APP_SENTRY_DSN` - Sentry error tracking
- `REACT_APP_GA_ID` - Google Analytics

---

## Testing Before Launch

### Checklist:
- [ ] Backend responds to health check: `curl https://your-backend/actuator/health`
- [ ] Frontend loads without errors
- [ ] Create a session
- [ ] Join with another user
- [ ] Draw a shape - verify it syncs
- [ ] Post a message - verify it syncs
- [ ] Offline test - disable network, verify cache works
- [ ] Mobile test - open on phone
- [ ] Different browsers - Chrome, Firefox, Safari

---

## Next Steps (Phase 6-7)

1. **Buy Domain** (15 min)
   - Namecheap, GoDaddy, Google Domains
   - Point DNS to your hosting

2. **Test Thoroughly** (30 min)
   - Multi-user testing
   - Load testing
   - Cross-browser testing

3. **Monitor & Scale**
   - Set up Sentry for error tracking
   - Monitor database performance
   - Track user metrics

---

## Troubleshooting

### Backend won't connect to Supabase
```bash
# Check credentials
echo $DB_URL
echo $DB_USERNAME
echo $DB_PASSWORD

# Test connection
psql "$DB_URL" -U "$DB_USERNAME" -c "SELECT 1"
```

### Frontend shows CORS error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:** Update `CORS_ALLOWED_ORIGINS` environment variable with your frontend URL

### SSL certificate issues
```
javax.net.ssl.SSLHandshakeException
```
**Solution:** Ensure `sslmode=require` in DB_URL

---

## Support

For Heroku issues: https://devcenter.heroku.com
For Vercel issues: https://vercel.com/docs
For Netlify issues: https://docs.netlify.com
For Railway issues: https://docs.railway.app

---

**Your app is ready to deploy! 🚀**

Choose your hosting option and follow the steps above.

Need help? Let me know which platform you want to use!

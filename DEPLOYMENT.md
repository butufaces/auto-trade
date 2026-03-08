## Deployment Guide

### 🐳 Docker Deployment (Recommended)

1. **Build Docker Image:**
```bash
docker build -t invest-bot:latest .
```

2. **Using docker-compose (includes PostgreSQL):**
```bash
docker-compose up -d
```

3. **View Logs:**
```bash
docker-compose logs -f bot
```

4. **Stop Services:**
```bash
docker-compose down
```

### 🖥️ Local Deployment

#### Prerequisites:
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

#### Installation:

1. **Install Dependencies:**
```bash
npm install --legacy-peer-deps
```

2. **Generate Prisma Client:**
```bash
npm run prisma:generate
```

3. **Configure Environment:**
```bash
cp .env.example .env
# Edit .env with your values
```

4. **Database Setup:**
```bash
# Create database and run migrations
npm run prisma:push

# (Optional) Seed with sample data
npm run db:seed
```

5. **Build:**
```bash
npm run build
```

6. **Start Bot:**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### ☁️ VPS/Cloud Deployment (Ubuntu/Debian)

1. **SSH into your server:**
```bash
ssh user@your.vps.ip
```

2. **Install Node.js:**
```bash
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install PostgreSQL:**
```bash
sudo apt-get install -y postgresql postgresql-contrib
```

4. **Clone Repository:**
```bash
git clone your-repo-url
cd telegram-investment-bot
```

5. **Setup:**
```bash
npm install --legacy-peer-deps
npm run prisma:generate
cp .env.example .env
# Edit .env
npm run prisma:push
npm run build
```

6. **Create PM2 Ecosystem File** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'invest-bot',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log'
  }]
};
```

7. **Start with PM2:**
```bash
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 🔧 Environment Variables

Create `.env` file based on `.env.example`:

```env
# Bot Configuration
BOT_TOKEN=your_bot_token_here
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/invest_bot_db

# Admin Configuration
ADMIN_IDS=123456789,987654321

# ... other variables
```

### 📊 Database Backups

1. **Backup:**
```bash
pg_dump your_db_name > backup.sql
```

2. **Restore:**
```bash
psql your_db_name < backup.sql
```

3. **Scheduled Backups (cron):**
```bash
# Add to crontab (daily at 2 AM)
0 2 * * * pg_dump invest_bot_db > /backups/backup-$(date +\%Y\%m\%d).sql
```

### 🔒 Security Checklist

- [ ] Use strong PostgreSQL password
- [ ] Enable SSL for bot token environment variable
- [ ] Use HTTPS for webhooks
- [ ] Keep bot token secret (use environment variables)
- [ ] Regularly update dependencies: `npm update`
- [ ] Set up automated backups
- [ ] Monitor logs for errors
- [ ] Use rate limiting (already configured)
- [ ] Enable maintenance mode when deploying

### 🚨 Monitoring & Logs

1. **View Logs:**
```bash
tail -f logs/combined.log
tail -f logs/error.log
```

2. **Log Rotation:**
Configured in `src/config/logger.ts`:
- Max file size: 10MB
- Max files: 14 days

### 🔄 Updating

1. **Pull Latest Changes:**
```bash
git pull origin main
```

2. **Install New Dependencies:**
```bash
npm install
```

3. **Run Migrations:**
```bash
npm run prisma:migrate
```

4. **Rebuild & Restart:**
```bash
npm run build
pm2 restart invest-bot
```

### ❓ Troubleshooting

#### Bot not responding:
- Check `BOT_TOKEN` in .env
- Verify internet connection
- Check logs: `tail -f logs/error.log`

#### Database connection error:
- Verify `DATABASE_URL` format
- Ensure PostgreSQL is running
- Check database credentials

#### Port already in use:
- Change `BOT_WEBHOOK_PORT` in .env
- Or kill process: `lsof -ti:3000 | xargs kill -9`

#### Out of memory:
- Increase swap on VPS
- Optimize Node.js memory with `--max-old-space-size=2048`

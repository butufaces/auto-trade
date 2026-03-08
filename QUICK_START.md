# Quick Start Guide 🚀

## 5-Minute Quick Start

### 1. Get Your Bot Token

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow instructions to create a new bot
4. Copy your **BOT_TOKEN**

### 2. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit with your values
# macOS/Linux:
nano .env

# Windows (PowerShell):
notepad .env
```

**Essential variables to set:**
```env
BOT_TOKEN=your_token_from_botfather
DATABASE_URL=postgresql://user:password@localhost:5432/invest_bot_db
ADMIN_IDS=your_telegram_id
```

### 3. Get Your Telegram ID

1. Search `@userinfobot` on Telegram
2. Send `/start`
3. Copy your ID and add to `ADMIN_IDS` in `.env`

### 4. Setup PostgreSQL

**Option A: Using Docker (Easiest)**
```bash
docker-compose up -d postgres
# Wait 10 seconds for PostgreSQL to start
```

**Option B: Local PostgreSQL**
```bash
# Make sure PostgreSQL is running
# Update DATABASE_URL in .env accordingly
```

### 5. Initialize Database

```bash
npm run prisma:push
npm run db:seed
```

### 6. Start the Bot

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm run build && npm start
```

### 7. Test Your Bot

1. Open Telegram
2. Search for your bot name
3. Send `/start`
4. Use the button menu

## 📋 Default User Packages

When you seed the database, these packages are created:

| Package | Min | Max | Duration | ROI | Risk |
|---------|-----|-----|----------|-----|------|
| Starter 💰 | $100 | $500 | 30 days | 10% | LOW |
| Growth 📈 | $500 | $2K | 60 days | 18% | LOW_MEDIUM |
| Premium 👑 | $2K | $10K | 90 days | 25% | MEDIUM |
| Elite 🌟 | $10K | $50K | 180 days | 35% | MEDIUM_HIGH |

## 👨‍💻 Admin Commands

Once your Telegram ID is in ADMIN_IDS, send:

- `/admin` - Open admin dashboard
- `/logs` - View admin activity logs

## 🔧 Useful Commands

```bash
# Rebuild project
npm run build

# Check for errors
npm run typecheck

# Format code
npm run format

# Kill bot process (if stuck)
# Linux/macOS:
pkill -f "node dist/index.js"

# Windows:
taskkill /F /IM node.exe
```

## 🐛 Common Issues

### "ECONNREFUSED" - Database not running
```bash
# Start PostgreSQL
docker-compose up -d postgres
# Or start PostgreSQL service locally
```

### "Bot not responding"
- Check BOT_TOKEN is correct
- Check internet connection
- Restart bot: `npm run dev`

### "Port 3000 already in use"
- Change `BOT_WEBHOOK_PORT` in .env
- Or kill the process using that port

## 📊 Admin Dashboard Features

✅ View platform stats
✅ Approve/Reject pending investments
✅ Manage users (suspend, delete)
✅ Send announcements
✅ View activity logs

## 🎯 Next Steps

1. **Verify bot is working** - Test with `/start` command
2. **Customize packages** - Edit `PACKAGES` in `.env`
3. **Add support contact** - Set `SUPPORT_USERNAME` in `.env`
4. **Deploy to production** - See [DEPLOYMENT.md](DEPLOYMENT.md)

## 📚 Documentation

- **Full Documentation**: See [README.md](README.md)
- **API Reference**: See inline comments in `src/` files
- **Database Schema**: See [prisma/schema.prisma](prisma/schema.prisma)
- **Configuration**: See [.env.example](.env.example)

## 🆘 Need Help?

- Check [README.md](README.md) for comprehensive documentation
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Check logs in `./logs/` directory
- Review error messages carefully

---

**Ready? Start with:**
```bash
npm run dev
```

Then open Telegram and start investing! 🚀

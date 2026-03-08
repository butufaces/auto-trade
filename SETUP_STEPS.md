# 🚀 Bot Setup Instructions

## ✅ Your Configuration Status

```
BOT_TOKEN:      8308497995:AAGMfvpRuBYtyu_hBLd2omfobmYHU8Ip5BQ ✅
DATABASE_URL:   postgresql://postgres:331061@localhost:5432/investbot ✅
ADMIN_ID:       6016038042 ✅
```

## 🔧 Step 1: Start PostgreSQL

### **Option A: Using Docker (Recommended - One Command)**

```bash
docker-compose up -d postgres
```

This will:
- Download PostgreSQL 16 image (first run only)
- Create container named `invest-postgres`
- Automatically create the database `investbot`
- Run in background with auto-restart

### **Option B: Local PostgreSQL Server**

If you have PostgreSQL installed locally:

```bash
# Windows: Start PostgreSQL service
net start postgresql-x64-16

# macOS: Using Homebrew
brew services start postgresql

# Linux:
sudo systemctl start postgresql
```

Then create the database:

```bash
// Open PowerShell and run:
psql -U postgres -c "CREATE DATABASE investbot;" -w

// Or run these commands:
psql -U postgres
postgres=# CREATE DATABASE investbot;
postgres=# \q
```

---

## 🗄️ Step 2: Initialize Database Schema

```bash
# Generate Prisma client (if not already done)
npm run prisma:generate

# Push schema to database and create all tables
npm run prisma:push

# (Optional) Seed sample data
npm run db:seed
```

**What this does:**
- Creates 8 tables (User, Package, Investment, Review, Announcement, AdminLog, WithdrawalRequest, Settings)
- Sets up indexes and relationships
- Seeds 4 default packages (Starter, Growth, Premium, Elite)

---

## 🤖 Step 3: Start the Bot

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

**Expected Output:**
```
🚀 Bot starting...
✅ Database connected
✅ Packages initialized
✅ Scheduled tasks started
✅ Bot is polling...
```

---

## ✅ Testing the Bot

1. Open Telegram
2. Search for your bot (created via @BotFather)
3. Send `/start`
4. You should see the main menu with buttons:
   - 💼 Invest
   - 📊 Portfolio
   - 📦 Packages
   - ⭐ Reviews
   - ❓ Help
   - ⚙️ Settings

---

## 🔐 Admin Access

Send `/admin` from your Telegram account (ID: 6016038042)

You should see:
- 📊 Admin Dashboard
- 💰 Manage Investments
- 👥 Manage Users
- 📣 Send Announcements
- 📋 Activity Logs

---

## ❌ Troubleshooting

### **Error: "connect ECONNREFUSED"**
- PostgreSQL is not running
- **Fix:** Start PostgreSQL with docker-compose or local service

### **Error: "password authentication failed"**
- Wrong credentials in DATABASE_URL
- **Check:** Password is `331061` and user is `postgres`
- Current URL: `postgresql://postgres:331061@localhost:5432/investbot`

### **Error: "database 'investbot' does not exist"**
- Database hasn't been created
- **Fix:** Run `npm run prisma:push`

### **Bot not responding in Telegram**
- BOT_TOKEN might be invalid
- **Fix:** Get new token from @BotFather and update .env

### **Stuck on startup / "tsx watch" waiting**
- Possible database connection hang
- **Fix:** Kill process and restart: `npm run dev`

---

## 📋 Full Setup Checklist

- [ ] .env file has valid BOT_TOKEN
- [ ] .env file has valid DATABASE_URL
- [ ] PostgreSQL is running (Docker or local)
- [ ] `npm install` completed successfully
- [ ] `npm run prisma:push` completed (tables created)
- [ ] `npm run dev` shows "Bot is polling..."
- [ ] Bot responds to /start in Telegram
- [ ] Admin can access /admin

---

## 🎯 Next Steps

Once bot is running:

1. **Test User Flow:**
   - Tap 💼 Invest
   - Select a package
   - Create test investment

2. **Test Admin Flow:**
   - Send /admin
   - Approve pending investment
   - View dashboard

3. **Customize Configuration:**
   - Adjust package details in .env
   - Change approval requirements
   - Configure notifications

---

## 📞 Quick Commands

```bash
# View logs
npm run logs

# Check TypeScript errors
npm run typecheck

# Format code
npm run format

# Kill stuck process
taskkill /F /IM node.exe  # Windows
pkill -f "node"           # macOS/Linux

# Rebuild everything
npm run build

# Check database status
docker-compose logs postgres
```

---

## 🐳 Docker Compose Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f postgres

# Reset everything (WARNING: Deletes data)
docker-compose down -v

# Rebuild images
docker-compose up -d --build
```

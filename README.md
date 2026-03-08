# 🎯 Telegram Investment Bot

**Production-ready Investment Bot** built with **grammY** and **Prisma ORM** for managing real investment operations with full admin controls.

## ✨ Features

### User Features
- 💼 **Multiple Investment Packages** with configurable ROI and duration
- 📊 **Portfolio Management** - track all investments in real-time
- 💰 **Automated ROI Calculation** and expected returns
- ⭐ **Investment Reviews** - rate and review packages
- 🏦 **Withdrawal Requests** with admin approval
- 👤 **User Profile** with statistics
- 💬 **Help & Support** integration

### Admin Features
- 👥 **User Management** - suspend, activate, delete users
- 💰 **Investment Approval** - review and approve with proof
- 📊 **Investment Analytics** - real-time stats and reports
- 📢 **Mass Announcements** - targeted to user segments
- 📋 **Audit Logs** - track all admin actions
- 🔧 **Platform Management** - configure via .env

### Technical Features
- ✅ **Type-Safe** - Full TypeScript support
- 🗄️ **PostgreSQL** - ACID-compliant database
- 🔐 **Role-Based** - Distinct user and admin roles
- ⏰ **Scheduled Jobs** - Auto-maturity checks, ROI distribution
- 🚦 **Rate Limiting** - Prevent abuse
- 📝 **Comprehensive Logging** - Winston with file rotation
- 🔘 **Button-Based UI** - Telegram inline and reply keyboards only
- ⚙️ **Fully Configurable** - Everything via .env

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Telegram Bot Token (from @BotFather)

### Setup

1. **Clone & Install**
```bash
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your values
```

3. **Database Setup**
```bash
# Generate Prisma client
npm run prisma:generate

# Create database and run migrations
npm run prisma:push
```

4. **Initialize Packages**
```bash
npm run db:seed
```

5. **Start Bot**
```bash
npm run dev      # Development
npm start        # Production
```

## 🔧 Configuration (.env)

### Bot Configuration
```env
BOT_TOKEN=your_telegram_bot_token
BOT_WEBHOOK_URL=https://yourdomain.com/webhook  # Optional
NODE_ENV=production
```

### Database
```env
DATABASE_URL=postgresql://user:password@localhost:5432/db
```

### Admin Setup
```env
ADMIN_IDS=123456789,987654321
ADMIN_CHAT_ID=123456789
```

### Investment Packages
```env
# Format: name|icon|min_amount|max_amount|duration_days|roi_percentage|risk_level|description
PACKAGES=Starter|💰|100|500|30|10|LOW|For beginners,Growth|📈|500|2000|60|18|LOW_MEDIUM|Standard package
```

### Features
```env
ENABLE_USER_REVIEWS=true
ENABLE_WITHDRAWAL=true
ENABLE_AUTO_ROI_DISTRIBUTION=true
FEATURE_REFERRAL_PROGRAM=false
ENABLE_MAINTENANCE_MODE=false
```

## 📊 Database Schema

### Core Models (7 tables)
- **User** - User accounts with profile and stats
- **Package** - Investment packages with ROI settings
- **Investment** - User investments with status tracking
- **Review** - Package and investment reviews
- **Announcement** - Admin announcements with delivery stats
- **AdminLog** - Audit trail for all admin actions
- **WithdrawalRequest** - Withdrawal requests with approval workflow
- **Settings** - Platform configuration key-value store

## 🎮 User Commands

### Main Menu
- `/start` - Start bot and show main menu
- `/help` - Help and FAQ
- `💼 Invest` - Browse and invest in packages
- `📊 My Portfolio` - View investments
- `📚 Packages` - View all packages
- `⭐ Reviews` - Leave reviews
- `⚙️ Settings` - User settings

### Admin Commands
- `/admin` - Open admin dashboard
- `/logs` - View admin activity logs
- `👥 Manage Users` - Manage users
- `💰 Manage Investments` - Review pending investments
- `📢 Announcements` - Send announcements

## 🔐 Admin Features

### Investment Approval
1. View pending investments
2. Upload approval proof (document, image, etc.)
3. Investment becomes ACTIVE
4. User receives notification

### User Management
- View all users and statistics
- Suspend/Activate/Delete users
- Check user investment history

### Announcements
- Create targeted announcements
- Send to: All users, Active investors, Completed investors
- Track delivery stats

## 📈 Investment Lifecycle

1. **PENDING** - User submits investment, awaits admin approval
2. **ACTIVE** - Admin approves with proof, investment starts earning
3. **MATURED** - Investment duration ends (automatic)
4. **PAYOUT_REQUESTED** - User requests funds
5. **COMPLETED** - Admin completes payout

## ⏰ Scheduled Tasks

- **Investment Maturity Check** - Every 24 hours (configurable)
- **ROI Distribution** - Monthly on configured day (optional)
- **Announcement Status** - Batch processing with delays

## 📝 Middleware & Safety

- ✅ User authentication & authorization
- 🚦 Rate limiting (100 requests/min per user)
- 🔒 Active user verification
- 📋 Request logging
- 🔧 Maintenance mode support

## 📁 Project Structure

```
src/
├── config/          # Environment & logging config
├── db/              # Prisma client
├── handlers/        # Bot command handlers
├── middleware/      # Auth, logging, rate limiting
├── services/        # Business logic
├── lib/             # Utilities & validators
├── tasks/           # Scheduled jobs
├── utils/           # Keyboard builders
└── index.ts         # Main bot entry
prisma/
└── schema.prisma    # Database schema
```

## 🚀 Deployment

### Docker
```bash
docker build -t invest-bot .
docker run --env-file .env invest-bot
```

### Environment Variables (Production)
```env
NODE_ENV=production
BOT_WEBHOOK_URL=https://yourdomain.com/webhook
ENABLE_MAINTENANCE_MODE=false
LOG_LEVEL=info
```

## 🔄 Database Migrations

```bash
# Create new migration
npm run prisma:migrate

# Push schema to database
npm run prisma:push

# Generate Prisma client
npm run prisma:generate
```

## 🧪 Type Checking

```bash
npm run typecheck
```

## 📊 Admin Dashboard Stats

- Total users and investments
- Total amount and expected ROI
- Investment status breakdown
- Pending approvals count

## 🔔 Notifications

Configured via .env:
- User investment approval
- Investment maturity
- Withdrawal status
- Admin new investments
- Admin withdrawal requests

## 🛡️ Security Features

- ✅ Role-based access control
- 🔐 Admin ID whitelisting
- 🚦 Rate limiting
- 📋 Audit logging
- 🔒 User status verification
- 🔐 Bank details encrypted (placeholder)

## 📞 Support

For issues or questions:
1. Check `.env` configuration
2. Review logs in `./logs/`
3. Check database connection
4. Verify Telegram bot token

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Create issues and pull requests on GitHub.

---

**Built with ❤️ using grammY, Prisma, and TypeScript**

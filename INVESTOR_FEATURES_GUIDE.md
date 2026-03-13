# 📚 Telegram Investment Bot - Complete Investor Features Guide

## 🎯 Overview
Production-ready investment bot built with **grammY** and **Prisma ORM** for comprehensive investment management, crypto payments, and real-time growth tracking.

---

## 💼 INVESTMENT FEATURES

### 1. **Multiple Investment Packages**
- ✅ Configurable investment packages with different ROI rates and durations
- ✅ Risk levels: NO_RISK, LOW, LOW_MEDIUM, MEDIUM, MEDIUM_HIGH, HIGH
- ✅ Min/Max investment amounts per package (configurable)
- ✅ Package descriptions and icons for easy identification
- ✅ Admin can add/edit/delete packages anytime
- ✅ Default packages available:
  - **Starter**: $100-$500, 30 days, 10% ROI
  - **Growth**: $500-$2000, 60 days, 18% ROI
  - **Premium**: $2000-$5000, 90 days, 25% ROI
  - (Fully customizable via admin panel)

### 2. **Investment Lifecycle**
**Status Progression:**
1. **PENDING** - Investment created, awaiting payment
2. **AWAITING_PAYMENT** - Payment method selected, user sent invoice
3. **ACTIVE** - Payment verified, investment earning returns
4. **MATURED** - Duration complete, ready for withdrawal or payout request
5. **PAYOUT_REQUESTED** - User requested withdrawal (approval pending)
6. **COMPLETED** - Full withdrawal completed, investment closed
7. **REJECTED** - Admin rejected investment (refund issued)

### 3. **Real-Time Expected Returns**
- ✅ **Expected Return** = Principal + (Principal × ROI%)
- ✅ Calculated instantly upon investment creation
- ✅ Example: $1000 at 18% ROI = $1180 total
- ✅ Displayed in portfolio with breakdown

### 4. **Investment Approval Process**
- ✅ Users submit payment proof (screenshot/file)
- ✅ Admin reviews and approves with verification
- ✅ Investment status updates to ACTIVE upon approval
- ✅ Maturity date calculated from exact activation time
- ✅ Admin can reject with refund notes
- ✅ Optional: Auto-approval after payment verification

---

## 💰 EARNING & PROFIT FEATURES

### 1. **Daily Accrual System**
- ✅ Profits distributed **daily automatically**
- ✅ Daily profit = Total profit ÷ Duration days
- ✅ Accrual tracked in `totalAccruedProfit` field
- ✅ **Scheduled daily accrual task** (configurable time, default 00:00 UTC)
- ✅ Automatically processes all ACTIVE investments
- ✅ Can accumulate to 100% of expected profit by maturity

**Example (30-day 10% ROI on $1000):**
- Total profit: $100
- Daily accrual: $100 ÷ 30 = $3.33/day
- After 10 days: Accrued = $33.30

### 2. **Daily Profit Splitting**
- ✅ 80% of daily profit **REINVESTED** (locked, adds to portfolio value)
- ✅ 20% of daily profit **WITHDRAWABLE** (available immediately)
- **Configurable percentages:**
  - `DAILY_PROFIT_REINVEST_PERCENTAGE` (default: 80%)
  - `DAILY_PROFIT_WITHDRAWABLE_PERCENTAGE` (default: 20%)

**Example (Daily accrual $3.33):**
- Reinvested: $2.66 (grows your portfolio)
- Withdrawable: $0.67 (cash out anytime)

### 3. **Multiple Withdrawal Types**

#### A. **Daily Profit Withdrawal**
- ✅ Withdraw only the daily withdrawable portion
- ✅ Does NOT affect investment maturity date
- ✅ Investment stays MATURED after withdrawal
- ✅ Can withdraw multiple times as profit accrues
- ✅ Requires wallet selection
- ✅ Email verification required (configurable)

#### B. **Partial Investment Withdrawal**
- ✅ Withdraw portion of investment + accrued profit
- ✅ Reduces `availableWithdrawable` amount
- ✅ Investment remains MATURED (can withdraw more later)
- ✅ Example: $1180 investment → withdraw $500 → leaves $680 withdrawable

#### C. **Full Investment Withdrawal**
- ✅ Withdraw entire investment + all profits
- ✅ Marks investment as COMPLETED
- ✅ Investment removed from active portfolio
- ✅ Triggers "Already Withdrawn" button state

### 4. **Withdrawal Process (Complete Flow)**
**Step 1: Initiate**
- User clicks "🏦 Withdraw Investment" on investment
- Bot shows options: Daily Profit or Full Investment

**Step 2: Wallet Selection**
- User selects cryptocurrency wallet from saved list
- Shows wallet blockchain and saved address
- "Add Wallet" button if no wallets exist

**Step 3: Confirmation**
- User confirms withdrawal amount
- Bot shows total available to withdraw

**Step 4: Email Verification** (if enabled)
- Bot sends verification link to user email
- User clicks link to verify withdrawal
- 10-minute expiry on verification token
- Configurable via `WITHDRAWAL_EMAIL_VERIFICATION_REQUIRED`

**Step 5: Admin Approval** (if required)
- Admin reviews withdrawal request
- Views wallet address and amount
- **APPROVES** → Status: APPROVED
- **REJECTS** → Investment status reverts to MATURED (can retry)

**Step 6: Payment Processing**
- After approval, amount transferred to wallet
- Admin marks as PAID
- Amounts deducted: `availableWithdrawable` and `totalWithdrawn` incremented
- User stats updated automatically
- Investment status updated (COMPLETED or MATURED)

### 5. **Withdrawal Limits**
- **Min Withdrawal**: $50 (configurable: `MIN_WITHDRAWAL_AMOUNT`)
- **Max Withdrawal**: $50K (configurable: `MAX_WITHDRAWAL_AMOUNT`)
- **Approval Required**: Yes (configurable: `WITHDRAWAL_APPROVAL_REQUIRED`)
- **Process Timeout**: 48 hours (configurable: `WITHDRAWAL_PROCESS_TIMEOUT_HOURS`)

### 6. **Investment Amount Constraints**
- **Min Investment**: $100 (configurable: `INVESTMENT_MIN_AMOUNT`)
- **Max Investment**: $50K (configurable: `INVESTMENT_MAX_AMOUNT`)
- **Max Concurrent**: 10 per user (configurable: `MAX_INVESTMENTS_PER_USER`)

---

## 🔴 PORTFOLIO & TRACKING FEATURES

### 1. **Portfolio Dashboard**
- ✅ **Portfolio Overview:** All investments at a glance
- ✅ **Current Value:** Principal + Accrued Profit
- ✅ **ROI Rate:** Investment's annual return percentage
- ✅ **Status:** PENDING, ACTIVE, MATURED, COMPLETED (color-coded)
- ✅ **Days Remaining:** Time until maturity (for ACTIVE investments)
- ✅ **Profit Summary:** Total accrued + withdrawable breakdown

### 2. **Investment Details View**
For each investment, users see:
- 💼 Package name and icon
- 💵 Principal amount (locked)
- 📊 ROI percentage
- 💰 Expected total return
- 📈 Current value (real-time)
- 📈 Accrued profit to date
- 🔒 Locked/Reinvested profit
- 💸 Daily withdrawable profit
- 📅 Duration and days remaining
- ✅ Investment status
- 🗓️ Maturity date/time
- 📝 Created date

### 3. **LIVE Growth Viewer** ⭐ (Premium Feature)
- ✅ **Real-time value updates** every 4 seconds
- ✅ **Animated progress**:
  - Maturity progress bar (0-100%)
  - Update cycle progress (0-4 seconds)
- ✅ **Display includes:**
  - Current value with animation indicator (✨)
  - Profit added this update
  - Daily/Hourly rates
  - Profit accumulated today
- ✅ **Updates every 4 seconds**
- ✅ **Stops on close** - cleans up intervals automatically
- ✅ **Fixed startup values** - prevents jumping between updates

**Calculation Details:**
- Updates display: `displayValue = initialValue + (updateCount × profitPerUpdate)`
- `profitPerUpdate = secondlyRate × 4 seconds`
- Capped at `totalProfit` to prevent exceeding expectedReturn
- Fractional days preserved for accurate rates

### 4. **Investment Statistics**
Dashboard shows:
- 💰 Total Invested (all time)
- 💹 Avg ROI%
- 📊 Best Performing Package
- 🎯 Active Investments Count
- 📈 Matured Investments Count
- 💸 Total Earned (from all investments)
- 🏦 Total Withdrawn (cashed out)
- 📝 Pending Withdrawal Requests

---

## 🪙 CRYPTOCURRENCY & PAYMENT FEATURES

### 1. **Crypto Payment Gateway Integration** (NOWPayments)
- ✅ Accept **BTC, ETH, USDT, LTC** (configurable)
- ✅ Instant payment verification via blockchain
- ✅ **Auto-approval** after payment received
- ✅ Multi-blockchain support: ERC-20, TRC-20, BEP-20, Polygon
- ✅ Real-time exchange rate conversion
- ✅ Payment timeout: 15 minutes (configurable)

### 2. **Crypto Wallet Management**
- ✅ **Save multiple wallets** (different cryptocurrencies/blockchains)
- ✅ **Wallet properties:**
  - Blockchain type (ERC-20, TRC-20, BEP-20, Polygon)
  - Cryptocurrency (BTC, ETH, USDT, etc.)
  - Wallet address (fully visible to user and admin)
  - Custom label (e.g., "Main ETH Wallet")
  - Marked as default
- ✅ **Set default wallet** for faster withdrawals
- ✅ **Edit wallet details** (label, blockchain)
- ✅ **Delete wallets** (with confirmation)
- ✅ **View all wallets** with blockchain info
- ✅ Wallets used **automatically** in final withdrawal step

### 3. **Payment Methods Available**
- ✅ **Crypto Payment**: Direct blockchain transfer
- ✅ **Bank Transfer**: Admin-configured accounts
- ✅ **Multiple Currencies**: USD, EUR, GBP (configurable)

### 4. **Payment Status Tracking**
- ✅ **Check Payment Status** button in payment flow
- ✅ Shows real-time blockchain confirmation
- ✅ **Cancel Payment** option if not yet confirmed
- ✅ **Retry Payment** if initial attempt fails
- ✅ **Copy Payment Address** for easy sending

### 5. **Payment Security**
- ✅ **Email verification** required before withdrawal
- ✅ **Wallet address displayed** to admin for verification
- ✅ **Manual approval** required by admin
- ✅ **Payment proof tracking** with file storage
- ✅ **IPN (Instant Payment Notification)** webhook verification

---

## 👥 REFERRAL & BONUS FEATURES

### 1. **Referral Program**
- ✅ **Unique referral code** auto-generated for each user
- ✅ **Share referral code** with friends
- ✅ **Earn commission** when referrals invest
- ✅ **Bonus percentage**: 5% (configurable: `REFERRAL_BONUS_PERCENTAGE`)
- ✅ **Minimum payout**: $1000 (configurable: `MINIMUM_REFERRAL_PAYOUT`)
- ✅ **Tracked referrals**:
  - Referral count
  - Total referral earnings
  - List of referred users with investment amounts

### 2. **Referral Bonus System**
- ✅ **Automatic bonus on referral investment**
- ✅ Bonus tracked separately from investment earnings
- ✅ **Bonuses "locked" initially** (optional approval phase)
- ✅ **Withdraw referral bonus** anytime after minimum reached
- ✅ **Same withdrawal process** as investment withdrawal
- ✅ **Bonus tracking:**
  - Status: PENDING, APPROVED, WITHDRAWN
  - Referrer info
  - Amount earned
  - Referral investment amount
  - Approval notes

### 3. **View My Referrals**
Dashboard shows:
- 🔗 Your Referral Code
- 👥 Number of Referrals
- 💰 Total Referral Earnings
- 📋 List of each referral:
  - User name
  - Investment amount
  - ROI they received
  - When they invested
- 💸 Available to Withdraw
- 🏦 Already Withdrawn

---

## 🔔 NOTIFICATIONS & COMMUNICATION

### 1. **Notification Types**
Bot sends notifications for:
- ✅ **Investment Approvals** - When admin approves investment
- ✅ **Investment Maturity** - When investment reaches maturity date
- ✅ **Withdrawal Status Updates** - When withdrawal approved/rejected/paid
- ✅ **Daily Accrual Updates** - (Optional) When daily profit added
- ✅ **Announcements** - Global platform announcements
- ✅ **Support Responses** - When admin replies to support tickets
- ✅ **Account Alerts** - Security changes, email verifications, etc.

### 2. **Notification History**
- ✅ **View all notifications** in notification center
- ✅ **Mark as read** individually or all at once
- ✅ **Notification types**: INFO, SUCCESS, WARNING, ERROR, INVESTMENT, WITHDRAWAL, SUPPORT
- ✅ **Notification details** - tap to view full message
- ✅ **Persistent storage** - notifications stay in history

### 3. **Notification Preferences** (configurable by admin)
- `NOTIFY_USER_ON_INVESTMENT_APPROVAL` (default: true)
- `NOTIFY_USER_ON_MATURITY` (default: true)
- `NOTIFY_USER_ON_WITHDRAWAL_STATUS` (default: true)
- `NOTIFY_ADMIN_ON_NEW_INVESTMENT` (default: true)
- `NOTIFY_ADMIN_ON_WITHDRAWAL_REQUEST` (default: true)

---

## 💬 SUPPORT SYSTEM

### 1. **Create Support Ticket**
- ✅ **User-initiated support** for any issue
- ✅ **Categories**: Investment, Withdrawal, Payment, Account, Other
- ✅ **Subject and detailed message**
- ✅ **Ticket automatically created** with unique ID
- ✅ **Status tracking**: OPEN, IN_PROGRESS, RESOLVED, CLOSED

### 2. **Support Chat**
- ✅ **Back-and-forth messaging** with support admin
- ✅ **Real-time conversation** in Telegram
- ✅ **Message timestamps** and sender info
- ✅ **Notification when admin replies** (instant alert)
- ✅ **Multi-ticket support** - multiple conversations
- ✅ **Admin can close tickets** when resolved

### 3. **Support Management** (Admin)
- ✅ **View all support tickets**
- ✅ **Filter by status** (Open, In Progress, Resolved)
- ✅ **Respond to users** via Telegram
- ✅ **Mark tickets as resolved**
- ✅ **Track resolution time**
- ✅ **Support team chatroom** - admin alerts for new tickets

---

## 📢 ANNOUNCEMENTS & BROADCASTS

### 1. **Receive Announcements**
- ✅ **Global platform announcements** to all users or targeted groups
- ✅ **Targeted broadcasts**:
  - All users
  - Active investors only
  - Completed investors only
  - Non-investors (marketing)
  - Specific users
- ✅ **Announcement content**:
  - Title
  - Message
  - Optional media (images)
  - Link (optional)
- ✅ **Real-time delivery** with batch processing
- ✅ **Notification saved** in user history

### 2. **Admin Announcement Features**
- ✅ **Create announcement** with target audience
- ✅ **Schedule broadcasts** (or send immediately)
- ✅ **Batch processing** (don't spam servers)
- ✅ **Track delivery** - which users received
- ✅ **Retry failed sends**
- ✅ **Media attachments** (images with announcements)

---

## 👤 ACCOUNT & PROFILE FEATURES

### 1. **User Profile**
Shows:
- 👤 Name and username
- 🆔 Telegram ID
- 📱 Phone number
- 📧 Email address
- ✅ Email verification status
- 🔐 KYC verification status (if enabled)
- 💰 Total invested (all time)
- 💹 Total earned (all investments)
- 🏦 Total withdrawn (cashed out)
- 🔗 Referral code
- 👥 Number of referrals
- 💸 Referral earnings
- 📚 Account creation date
- ⏰ Last active time

### 2. **Settings**
- ✅ **Edit profile information**
- ✅ **View username** (unique identifier)
- ✅ **Email management**:
  - Add/update email
  - Verify email
  - Request resend verification (rate-limited)
- ✅ **Phone number**
- ✅ **Timezone selection** (for notifications)
- ✅ **Language preference** (if multi-language enabled)

### 3. **Security Settings**
- ✅ **View saved wallets count**
- ✅ **View active sessions**
- ✅ **Account activity log**:
  - Login dates/times
  - Investment approvals
  - Withdrawals requested
  - Settings changes
- ✅ **Export personal data** (GDPR compliance)
  - Download all user information
  - All investments
  - All withdrawals
  - All transactions

### 4. **KYC (Know Your Customer)**
- ✅ **Optional KYC verification** (configurable)
- ✅ **Document upload**:
  - ID card/Passport
  - Proof of address
- ✅ **Verification status**: PENDING, VERIFIED, REJECTED
- ✅ **Verified badge** on profile

### 5. **Email Verification**
- ✅ **Required for withdrawal** (configurable)
- ✅ **Auto-sent verification email** when withdrawing
- ✅ **Configurable expiry**: 10 minutes (default)
- ✅ **Click-to-verify** link in email
- ✅ **Resend option** with rate limiting (prevent abuse)

---

## 📊 INVESTMENT REVIEWS & RATINGS

### 1. **Rate Investments**
- ✅ **Review packages** after investment matures
- ✅ **5-star rating system**
- ✅ **Written review/comment**
- ✅ **Anonymous or identified** (user choice)
- ✅ **Reviews stored** with investment reference

### 2. **View Package Reviews**
- ✅ **See all reviews** for a package
- ✅ **Average rating** displayed
- ✅ **Review count** shown
- ✅ **Helpful/unhelpful voting** (optional)
- ✅ **Filter by rating** (5-star only, 4+ stars, etc.)

---

## 🛡️ SECURITY & COMPLIANCE

### 1. **Role-Based Access**
- ✅ **User role** - Limited to own portfolio
- ✅ **Admin role** - Full platform control
- ✅ **Admin IDs** from environment (configurable)
- ✅ **Session timeout** - 30 minutes (configurable)

### 2. **Data Protection**
- ✅ **PostgreSQL database** - ACID-compliant, encrypted
- ✅ **Wallet address display** - Full address visible (not truncated)
- ✅ **No sensitive data** - In notifications (only summary shown)
- ✅ **User authentication** - Via Telegram (secure)
- ✅ **Admin verification** - Multiple approval steps

### 3. **Email Security**
- ✅ **Email verification tokens** - Secure, time-limited
- ✅ **Token expiry** - 30 minutes (configurable)
- ✅ **Resend rate limiting** - Prevent brute force
- ✅ **Email provider**: Brevo API (professional service)

### 4. **Withdrawal Security**
- ✅ **Email verification** required
- ✅ **Wallet address verification** by admin
- ✅ **Manual approval** before payment
- ✅ **Payment proof tracking**
- ✅ **Transaction logging** - All withdrawals recorded

### 5. **Audit & Compliance**
- ✅ **Comprehensive logging** - All admin actions tracked
- ✅ **User activity tracking**:
  - Investment approvals
  - Withdrawals
  - Settings changes
  - Support interactions
- ✅ **Export user data** - GDPR data subject request
- ✅ **User deletion** - Full account removal (configurable)
- ✅ **Suspension** - Temporarily freeze account

---

## ⚙️ PLATFORM CONFIGURATION

### 1. **Customizable Platform Info**
- Platform name (default: Investment Bot)
- About section (platform description)
- Website URL
- Support email
- Mission statement
- Vision statement
- Terms of Service URL
- Privacy Policy URL

### 2. **Investment Settings**
- Min/Max investment amounts
- Auto-maturity check interval (every 24 hours)
- ROI distribution settings
- Daily accrual schedule (default: 00:00 UTC)
- Profit splitting percentages

### 3. **Withdrawal Settings**
- Min/Max withdrawal amounts
- Approval required (yes/no)
- Email verification required
- Process timeout (default 48 hours)
- Token expiry (default 10 minutes)

### 4. **Feature Flags**
- Enable/disable user reviews
- Enable/disable KYC
- Enable/disable referral program
- Enable/disable announcements
- Enable/disable withdrawal
- Enable/disable user profiles
- Maintenance mode (pause bot)

### 5. **Notification Settings**
- Enable investment approval notifications
- Enable maturity notifications
- Enable withdrawal status notifications
- Enable admin notifications
- Batch announcement settings (size, delay)

---

## 🚀 GETTING STARTED FOR INVESTORS

### Before Starting
1. ✅ Have Telegram account ready
2. ✅ Have email verified
3. ✅ Have cryptocurrency wallet address (for withdrawals)
4. ✅ Choose investment package
5. ✅ Have funds ready (fiat or crypto)

### Step 1: Find & Start Bot
- Search for bot on Telegram or use link
- Click `/start`
- Bot sends welcome message

### Step 2: Browse Packages
- Click "📦 View Packages"
- See all available packages with ROI, duration, limits
- Read descriptions to choose best fit

### Step 3: Create Investment
- Click on desired package
- Enter investment amount ($100-$50K)
- Bot shows expected return calculation
- Confirm to create investment

### Step 4: Pay for Investment
- Bot shows payment method options
- Choose crypto or bank transfer
- For crypto: Scan QR code or copy address
- Send payment from your wallet
- Payment auto-verified by blockchain (15 min timeout)

### Step 5: Trade Activates
- Admin approves trade
- Bot notifies you "✅ Trade Approved!"
- Trade status changes to ACTIVE
- Maturity date shown (duration days from now)
- Daily accrual begins immediately

### Step 6: Watch Growth
- Click "📈 View Trade Details" to see:
  - Current value (updates daily)
  - Accrued profit
  - Days remaining
  - Daily rates (hourly, per-second rates)
- Click "📊 Live Growth" for real-time updates (updates every 4 seconds)

### Step 7: Withdraw Profits
- Once matured, click "🏦 Withdraw Investment"
- Choose how much to withdraw
- Select cryptocurrency wallet
- Confirm and verify email
- Admin approves withdrawal
- Get funds in your wallet

---

## 📈 EXAMPLE INVESTMENT SCENARIO

**Scenario:** Invest $1,000 in Growth package (60 days, 18% ROI)

| Day | Status | Accrued | Withdrawable | Locked | Current Value | Notes |
|-----|--------|---------|---|---|---|---|
| 0 | PENDING | $0 | $0 | $0 | $1,000 | Investment created, awaiting payment |
| 1 | AWAITING_PAYMENT | $0 | $0 | $0 | $1,000 | Payment link sent |
| 2 | ACTIVE | $3 | $0.60 | $2.40 | $1,003 | Payment verified, daily accrual starts |
| 10 | ACTIVE | $30 | $6 | $24 | $1,030 | 10 days of profit accumulated |
| 30 | ACTIVE | $90 | $18 | $72 | $1,090 | Halfway through investment |
| 60 | MATURED | $180 | $36 | $144 | $1,180 | Investment matured, ready to withdraw |

**Withdrawal Options at Day 60:**
1. **Withdraw Daily Profit Only** - Take $36, investment stays MATURED
2. **Partial Withdrawal** - Take $500 (profit + principal), still $680 available
3. **Full Withdrawal** - Take entire $1,180, investment marked COMPLETED

---

## 💡 KEY INVESTOR TIPS

1. **Compounding Growth** - Reinvested profit (80%) stays in account and earns returns
2. **Diversification** - Can have up to 10 concurrent investments
3. **Flexible Withdrawal** - Can withdraw profits before maturity in some cases
4. **Referral Income** - Even non-investors gain from referrals
5. **Real-Time Tracking** - Live growth view shows money literally growing
6. **Secure Withdrawals** - Multi-step verification prevents fraud
7. **Multiple Wallets** - Save different crypto wallets for convenience
8. **Tax Friendly** - Export data for tax reporting (GDPR data export)
9. **24/7 Support** - Support tickets for any questions
10. **Email Backup** - All important updates sent to email too

---

## 🔄 COMPARISON: BEFORE & AFTER WITHDRAWAL

### Before Withdrawal Bug Fix
- ❌ Profit NOT deducted from balance
- ❌ Could withdraw same amount multiple times
- ❌ Partial withdrawals marked investment COMPLETED
- ❌ Wallet address truncated in admin view
- ❌ Completed investment button confusing UI

### After Withdrawal Bug Fixes
- ✅ Amount properly deducted from `availableWithdrawable`
- ✅ `totalWithdrawn` incremented (tracks total cash out)
- ✅ Paid duplicate check prevents double deduction
- ✅ Full vs partial withdrawal distinction:
  - **Full withdrawal** (amount ≥ available) → COMPLETED
  - **Partial withdrawal** (amount < available) → MATURED
- ✅ Full wallet address shown to admin for verification
- ✅ Completed investments show "✅ Already Withdrawn" button
- ✅ Live growth profit capped at expectedReturn (never exceeds)

---

## 📊 BOT STATISTICS

The bot tracks for each user:
- Total Invested (all time)
- Total Earned (all investments + referrals)
- Total Withdrawn (cashed out)
- Active Investments Count
- Matured Investments Count
- Pending Withdrawals
- Referral Count
- Referral Earnings

And for the platform admin:
- Total investments in system
- Total amount invested
- Total earnings distributed
- Pending approvals count
- Pending withdrawals count
- User growth rate
- Monthly earnings distribution
- Daily accrual totals

---

## ✅ VERIFICATION CHECKLIST

For investors starting:
- [ ] Email verified
- [ ] Profile complete (name, phone, etc.)
- [ ] Wallet address saved (for withdrawals)
- [ ] KYC verified (if required)
- [ ] Understood investment duration and ROI
- [ ] Selected appropriate risk level
- [ ] Confirmed investment amount
- [ ] Payment received and processing

---

## 🆘 COMMON QUESTIONS

**Q: How is profit calculated?**
A: Total profit = Principal × (ROI% ÷ 100). Daily profit = Total profit ÷ Duration days. Both calculated on Day 1 and locked in.

**Q: Can I withdraw before maturity?**
A: Partially for daily profit (20% of accrual), but full investment requires maturity. Daily profit withdrawals don't affect maturity date.

**Q: What if payment fails?**
A: You have 15 minutes to send payment. If timeout expires, investment is rejected. Create new investment to retry.

**Q: Are my funds secure?**
A: Yes. Multi-step verification, email confirmation, admin approval, and wallet address verification all required before payment.

**Q: Can I have multiple investments?**
A: Yes, up to 10 concurrent investments (configurable). Each has its own ROI, duration, and maturity date.

**Q: What's a referral bonus?**
A: When someone invests using your referral code, you earn 5% of their investment amount (configurable percentage).

**Q: How long is withdrawal approval?**
A: Typically within 48 hours. Ask support if delayed. All withdrawals logged for transparency.

---

## 🎯 NEXT STEPS

1. Open Telegram
2. Find the investment bot
3. Click `/start`
4. Click "📦 View Packages"
5. Choose a package and amount
6. Complete payment
7. Watch your investment grow!

---

**Bot Version:** 1.0.0  
**Last Updated:** March 12, 2026  
**Built with:** TypeScript, grammY, Prisma ORM, PostgreSQL  
**Status:** Production Ready ✅

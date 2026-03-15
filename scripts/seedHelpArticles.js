import prisma from "../src/db/client.js";
import logger from "../src/config/logger.js";
const HELP_ARTICLES = [
    {
        order: 1,
        icon: "👋",
        title: "Welcome to Our Platform",
        category: "Getting Started",
        content: `Welcome to our investment platform!

We help you grow your money through simple growth plans. Here's what you need to know:

💡 How It Works:
• Choose a growth plan (like a savings account but with better returns)
• Add your money securely
• Watch your money grow day by day
• Withdraw anytime once your plan matures

🎯 What Makes Us Different:
• Simple and transparent - no hidden fees
• Daily growth updates so you see progress
• Secure payment options
• Always available 24/7

✅ What You Need:
• A valid email address
• A crypto wallet (we'll show you how)
• Money ready to invest
• Just 5-10 minutes to get started

Next: Learn how to start your first plan!`,
    },
    {
        order: 2,
        icon: "📦",
        title: "Growth Plans Explained",
        category: "Getting Started",
        content: `Understanding Our Growth Plans

Each plan is like a container for your money. Here's how to pick one:

📊 What's in Each Plan:
• Duration: How long your money grows (30, 60, or 90 days)
• Growth Rate: How much profit you get (10% to 25%)
• Min/Max: Minimum and maximum money you can add
• Risk Level: How safe your money is

💰 Example Plan:
Plan Name: Basic Growth
━━━━━━━━━━━━━━━━━━━━
Duration: 30 days
Growth Rate: 10%
Range: $100 - $500
Risk: Very Low

If you invest $300, after 30 days you get:
Your money back: $300
Your profit: $30
Total: $330 ✅

🎯 Choosing Your First Plan:
Beginners → Start Small:
• Pick "Basic Growth" plan
• Start with $100-$200
• 30 days is quick

Has Some Experience → Pick Any:
• Try different plans
• Mix small and big amounts
• Learn the system

💡 Tip: You can have multiple plans at the same time!`,
    },
    {
        order: 3,
        icon: "🚀",
        title: "How to Start Your First Plan",
        category: "Getting Started",
        content: `Your First Investment - Step by Step

Follow these simple steps:

STEP 1️⃣ - Pick a Plan
━━━━━━━━━━━━━━━━━━
• Click "View Plans"
• Read each plan carefully
• Click the one you like
• Amount pops up

STEP 2️⃣ - Enter Your Amount
━━━━━━━━━━━━━━━━━━━━━━━━
• Make sure it's between Min and Max
• Check the numbers twice
• Click "Next"

STEP 3️⃣ - Select Payment Method
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Options:
📱 Bank Transfer
💳 Card Payment
💰 Crypto (USDT)

STEP 4️⃣ - Send Your Money
━━━━━━━━━━━━━━━━━━━━
We'll give you details of where to send money
Follow the instructions carefully
Keep your receipt!

STEP 5️⃣ - Proof of Payment
━━━━━━━━━━━━━━━━━━━━━━
Send us a screenshot of:
• Your transaction
• Amount sent
• Date of transfer

STEP 6️⃣ - Admin Approval
━━━━━━━━━━━━━━━━━━
We review your proof
Usually takes 1-2 hours
We'll notify you when approved

STEP 7️⃣ - Your Plan Starts! ✅
━━━━━━━━━━━━━━━━━━
Your money starts growing immediately
Watch your balance in "My Account"

⏱️ How long does this take?
Usually 1-2 hours from start to finish.`,
    },
    {
        order: 4,
        icon: "💳",
        title: "Payment Methods",
        category: "Payments",
        content: `Different Ways to Pay Us

We accept 3 payment methods:

METHOD 1️⃣: Bank Transfer
━━━━━━━━━━━━━━━━━━━
✅ How it works:
• We give you bank details
• You send money from your bank
• Same process as paying a friend
• Free or cheap fees

✅ Best for:
• Large amounts ($500+)
• People who prefer banks
• International users

⏱️ Speed: 1-24 hours depending on your bank

💡 Tip: Keep your receipt - you'll need to show it to us!


METHOD 2️⃣: Card Payment
━━━━━━━━━━━━━━━━━
✅ How it works:
• Click "Pay with Card"
• Enter your card details
• Instant payment
• Very secure

✅ Best for:
• Quick payments
• Small amounts
• People who prefer cards

💳 What cards work:
• Visa
• Mastercard
• Most debit cards

⏱️ Speed: Instant to 1 hour


METHOD 3️⃣: Crypto Payment
━━━━━━━━━━━━━━━━━
✅ How it works:
• We give you wallet address
• You send USDT (or other crypto)
• Direct transfer
• Very secure

✅ Best for:
• People with crypto
• Large amounts
• Fastest option

💰 What we accept:
• USDT (recommended)
• Bitcoin
• Ethereum

⏱️ Speed: Minutes (usually)


❓ Which one should I pick?
If unsure → Bank Transfer (safest)
If you have crypto → Crypto (fastest)
If you want quick → Card Payment`,
    },
    {
        order: 5,
        icon: "📈",
        title: "Daily Growth & How You Earn",
        category: "Earnings",
        content: `How Your Money Grows Every Day

Your money doesn't just sit there - it grows automatically. Here's how:

📊 The Basic Idea:
Your total profit ÷ Number of days = Daily growth

🔢 Example:
Plan: Basic Growth ($1,000 at 10% growth)
━━━━━━━━━━━━━━━━━━━━━━━━
Your money: $1,000
Your profit will be: $100
Duration: 30 days

Daily growth: $100 ÷ 30 = $3.33/day

Day 1: You have $3.33 new profit
Day 2: You have $6.66 new profit
Day 3: You have $9.99 new profit
...
Day 30: You have $100 in total profit ✅


💹 What Happens to Daily Profit?
━━━━━━━━━━━━━━━━━

Your daily $3.33 splits into:
• $2.66 (80%) → Locked in your account (adds to your balance)
• $0.67 (20%) → Ready to withdraw anytime

💡 This means:
✅ Your account grows bigger every day
✅ You can also take out money without waiting
✅ Your profit compounds (gets bigger!)


📋 Tracking Your Growth:
Check "My Account" to see:
• Your original amount
• Total profit so far
• How much you can withdraw
• Days remaining


💰 After 30 Days:
Your plan matures (grows up!)
You now have:
• Your original $1,000
• Your $100 profit
• Total: $1,100 ✅
• 100% available to withdraw`,
    },
    {
        order: 6,
        icon: "💰",
        title: "How to Withdraw Your Money",
        category: "Withdrawals",
        content: `Getting Your Money Back - The Complete Guide

There are 2 ways to get your money:

OPTION 1️⃣: Take Daily Profit
━━━━━━━━━━━━━━━━━━━
✅ When: Anytime
✅ How much: Only the "ready" profit (20% of daily)
✅ Your plan: Stays active, keeps growing

Example:
Plan has daily profit of $3.33
Ready to take: $0.67 every day
Your plan: Keeps growing normally
Your original money: Safe in plan

❓ When to use: If you need cash now but want your money to keep growing

OPTION 2️⃣: Withdraw Your Plan (When Ready)
━━━━━━━━━━━━━━━━━━━━━━━━━
✅ When: After plan matures (30/60/90 days)
✅ How much: Everything (all original + all profit)
✅ Your plan: Closes, no more growth

Example:
After 30 days:
Original: $1,000
Profit: $100
Total to withdraw: $1,100 ✅


📝 Step-by-Step Withdrawal:

STEP 1: Click "Ready to Withdraw"
STEP 2: Choose withdrawal amount
STEP 3: Add your crypto wallet
  (We show you where to do this)
STEP 4: Confirm withdrawal
STEP 5: Verify your email
  (We send you a link)
STEP 6: Admin approves
  (Usually 1-2 hours)
STEP 7: Money sent! ✅
  (Usually within 24 hours)


❓ Questions?

Q: Can I take profit before my plan ends?
A: Yes! Take up to 20% as you go, no problem.

Q: What if I change my mind?
A: Contact support right away, we can help.

Q: Are there fees?
A: Small network fees only (1-2%), no hidden fees.

Q: How long does withdrawal take?
A: Usually 1-24 hours total.`,
    },
    {
        order: 7,
        icon: "💬",
        title: "How to Get Help",
        category: "Support",
        content: `We're Here to Help!

Need something? Here are your options:

OPTION 1️⃣: Help Articles (You Are Here!)
━━━━━━━━━━━━━━━━━━━
✅ Check common questions
✅ Find how-to guides
✅ No waiting!
✅ Search anytime

Tap the Help button in menu
Look for your topic
Learn step by step


OPTION 2️⃣: Support Chat
━━━━━━━━
✅ Real person helps you
✅ Fast responses
✅ Usually under 1 hour
✅ Open 24/7

How to use:
• Click "Open Support Chat"
• Describe your issue
• Attach screenshots if needed
• Wait for our reply
• We'll solve it together


OPTION 3️⃣: Frequently Asked Questions
━━━━━━━━━━
✅ Most common issues answered
✅ Quick solutions
✅ No waiting

Click "FAQ" for instant answers


COMMON ISSUES & QUICK FIXES:

❌ "My payment was not approved"
✅ Check if proof is clear
✅ Resubmit with better screenshot
✅ Or contact support

❌ "I haven't received my withdrawal"
✅ Check email for updates
✅ Contact support with transaction ID
✅ We'll investigate

❌ "I forgot my email"
✅ Tap "Can't access account?"
✅ Follow recovery steps
✅ Or contact support

❌ "How do I set up my wallet?"
✅ Click "Setup Crypto Wallet"
✅ Follow the guide step by step
✅ It's easy!


📞 How to Contact:
Open Support Chat → Describe issue → Tell us what's wrong
Email: support@growmore.com
Telegram: @support_team

We typically respond within 1 hour during business hours.

✅ We promise: You're not alone, we'll help!`,
    },
    {
        order: 8,
        icon: "❓",
        title: "Frequently Asked Questions",
        category: "FAQ",
        content: `Common Questions About Our Platform

Q: Is this safe?
A: Yes! We use bank-level security. Your money is protected with:
   • Encrypted payments
   • Verified admin review
   • Transparent records
   • Professional team

Q: How does the profit work?
A: Your profit is calculated and added daily. You can see it growing in real-time in "My Account".

Q: Can I have multiple plans?
A: Yes! You can have as many plans as you want. Each grows separately.

Q: What if my payment fails?
A: No problem. You can retry immediately or use a different payment method. Your money won't be charged until it's approved.

Q: Can I cancel my plan?
A: You can take your profit anytime. After maturity, you can withdraw everything. Early withdrawal may have fees (check details per plan).

Q: How long does admin approval take?
A: Usually 1-2 hours. We work fast! Check your notifications for updates.

Q: What's the minimum investment?
A: Each plan has different minimums, usually $100 for starters. Check each plan details.

Q: Can I invite friends?
A: Yes! We have a referral program. Invite friends and earn bonus. Click "My Referrals" for your code.

Q: Is there an app?
A: You use our bot on Telegram. No separate app needed. Just chat with us!

Q: What if I have technical issues?
A: Contact our support team right away. We're available 24/7 on Telegram chat.

Q: Can I change my withdrawal amount?
A: Yes, before you confirm. After confirmation, contact support to modify.

Q: How safe is my crypto wallet?
A: You provide your own wallet. We never control it. You stay in charge.

Q: What payment methods work internationally?
A: All three methods work worldwide! Bank transfer and card payment depend on your bank. Crypto works everywhere.

Still have questions?
👉 Open support chat and ask us directly! We're here to help.`,
    },
];
export async function seedHelpArticles() {
    try {
        logger.info("🌱 Starting help articles seed...");
        // Check if articles already exist
        const existingCount = await prisma.helpArticle.count();
        if (existingCount > 0) {
            logger.info(`📚 Help articles already exist (${existingCount} articles). Skipping seed.`);
            return;
        }
        // Create all articles
        for (const article of HELP_ARTICLES) {
            await prisma.helpArticle.create({
                data: {
                    title: article.title,
                    icon: article.icon,
                    content: article.content,
                    category: article.category,
                    order: article.order,
                    isActive: true,
                },
            });
            logger.info(`✅ Created: ${article.title}`);
        }
        logger.info(`🎉 Successfully seeded ${HELP_ARTICLES.length} help articles!`);
    }
    catch (error) {
        logger.error("Error seeding help articles:", error);
        throw error;
    }
}
// Allow script to be run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    await seedHelpArticles();
    process.exit(0);
}
//# sourceMappingURL=seedHelpArticles.js.map
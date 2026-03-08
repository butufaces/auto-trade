# Withdrawal Flow Implementation - Complete Summary

## 🎯 Overview
Implemented a complete automated withdrawal flow with admin approval and NOWPayments integration:
- Users request withdrawals with wallet selection
- Admin receives notifications and approves/rejects withdrawals
- System automatically processes payment via NOWPayments
- User notified on completion, balance updated accordingly
- Pending withdrawals show in separate "pending" amount

---

## 📋 Files Created/Modified

### 1. **Database Schema & Migration**

#### Modified: `prisma/schema.prisma`
- Updated `WithdrawalRequest` model with new fields:
  - `walletId`, `walletAddress` - Crypto wallet details
  - `cryptocurrency`, `blockchain` - USDT and network selection
  - `nowpaymentsPaymentId` - Payment tracking
  - `paymentStatus` - Payment state (PENDING, CONFIRMING, CONFIRMED, SENDING, FINISHED, FAILED, EXPIRED)
  - `approvedBy` - Admin who approved
  - `paymentUrl` - Payment link from NOWPayments
- Updated status flow: `PENDING` → `PROCESSING` → `COMPLETED` (or `REJECTED`)

#### Created: `prisma/migrations/20260226_update_withdrawal_request/migration.sql`
- Adds all new columns to `WithdrawalRequest` table
- Creates indexes on NOWPayments lookup fields

---

### 2. **User Withdrawal Handlers**

#### Created: `src/handlers/withdrawalUser.ts`
Functions for users to request crypto withdrawals:

1. **`handleSelectWalletForWithdrawal(ctx, investmentId)`**
   - Shows list of user's saved USDT wallets
   - Stores investment ID in session
   - Allows adding new wallet if needed

2. **`handleConfirmWalletForWithdrawal(ctx, walletId)`**
   - User confirms wallet selection
   - Stores wallet details in session
   - Asks for withdrawal amount

3. **`handleProcessCryptoWithdrawal(ctx)`**
   - User enters withdrawal amount
   - Validates amount against available balance
   - Shows confirmation screen with all details

4. **`handleConfirmCryptoWithdrawal(ctx)`**
   - Creates `WithdrawalRequest` record
   - Sends email verification link
   - Notifies admin of new withdrawal
   - Status: `PENDING` awaiting email verification

---

### 3. **Admin Withdrawal Handlers**

#### Created: `src/handlers/withdrawalAdmin.ts`
Functions for admins to manage withdrawal requests:

1. **`handleAdminViewWithdrawals(ctx)`**
   - Lists all `PENDING` withdrawal requests
   - Shows user info, amount, blockchain, verification status
   - Let's admin select a withdrawal to review

2. **`handleAdminViewWithdrawalDetails(ctx, withdrawalId)`**
   - Shows full withdrawal details:
     - User information (name, email, username)
     - Withdrawal amount and destination
     - Wallet address and blockchain
     - Verification status
   - Buttons: Approve & Process, Reject, Back

3. **`handleAdminApproveWithdrawal(ctx, withdrawalId)`**
   - Updates status to `PROCESSING`
   - Records admin approval and timestamp
   - Sets `paymentStatus: "PENDING"`
   - Triggers NOWPayments payout service
   - Confirms to admin

4. **`handleAdminRejectWithdrawal(ctx, withdrawalId)`**
   - Asks admin for rejection reason

5. **`handleAdminRejectWithdrawalReason(ctx)`**
   - AdminSubmits rejection reason
   - Updates withdrawal to `REJECTED`
   - Notifies user of rejection with reason

---

### 4. **NOWPayments Payout Service**

#### Created: `src/services/payoutService.ts`
`CryptoPayoutService` class handling crypto payouts:

1. **`processPayout(withdrawalId)`**
   - Validates withdrawal data
   - Validates wallet address format (ERC-20, TRC-20, BEP-20, Polygon)
   - Sends payout request to NOWPayments API
   - Stores NOWPayments payment ID and URL
   - Status: `PENDING`

2. **`validateWalletAddress(address, blockchain)`**
   - Validates wallet format based on blockchain type:
     - ERC-20/Polygon/BEP-20: Ethereum format (0x...)
     - TRC-20: TRON format (T...)

3. **`getPayoutStatus(payoutId)`**
   - Fetches current payout status from NOWPayments

4. **`handlePayoutWebhook(data)`**
   - Receives status updates from NOWPayments
   - Maps statuses: `FINISHED` → `COMPLETED`, `FAILED` → `REJECTED`
   - Updates investment balance on completion
   - Updates user `totalWithdrawn`
   - Notifies user of results

---

### 5. **Withdrawal Webhook Handler**

#### Modified: `src/handlers/paymentWebhook.ts`
Added new function:

**`handleWithdrawalWebhook(req, res)`**
- Receives NOWPayments payout webhook callbacks
- Verifies webhook signature
- Maps payment status to withdrawal status
- On **COMPLETED**:
  - Deducts amount from investment `availableWithdrawable`
  - Increments investment `totalWithdrawn`
  - Increments user `totalWithdrawn`
  - Sends success notification to user
- On **FAILED**:
  - Status set to `REJECTED`
  - Notifies user of failure
  - Balance remains unchanged (pending amount released)

---

### 6. **Investment Service Helpers**

#### Modified: `src/services/investment.ts`
Added new methods:

1. **`calculateAvailableBalance(investmentId)`**
   - Calculates available withdrawal balance
   - Formula: `availableWithdrawable - pendingWithdrawalAmount`
   - Returns amount user can actually withdraw now

2. **`getPendingWithdrawalAmount(investmentId)`**
   - Sums all `PENDING` or `PROCESSING` withdrawal amounts
   - Shows how much is currently pending

3. **`getUserWithdrawalRequests(userId)`**
   - Gets all withdrawal requests for user
   - Includes investment and user details

---

## 🔄 Withdrawal Flow Diagram

```
1. USER REQUESTS WITHDRAWAL
   ├─ Selects wallet from saved list
   ├─ Enters withdrawal amount
   ├─ Confirms details
   └─ Email verification link sent
      Status: PENDING

2. USER VERIFIES EMAIL
   ├─ Clicks email verification link
   └─ Admin notified of new withdrawal request
      Status: PENDING (verified)

3. ADMIN REVIEWS & APPROVES
   ├─ Sees all pending withdrawals
   ├─ Views withdrawal details
   ├─ Clicks "Approve & Process"
   └─ System triggers NOWPayments payout
      Status: PROCESSING

4. NOWPAYMENTS PROCESSES PAYMENT
   ├─ Sends funds to user's wallet
   ├─ Updates status via webhook
   └─ On completion:
      ├─ Deducts from availableWithdrawable
      ├─ Updates totalWithdrawn
      └─ Status: COMPLETED

5. USER NOTIFIED
   ├─ Receives Telegram notification
   ├─ Updated portfolio shows new balance
   └─ Funds arrive at wallet
```

---

## 💾 Database Changes

### WithdrawalRequest Model
```prisma
model WithdrawalRequest {
  // Existing fields
  id, userId, investmentId, amount, status
  
  // NEW: Crypto/Wallet details
  walletId              String?
  walletAddress         String?
  cryptocurrency        String?          // USDT
  blockchain            String?          // ERC-20, TRC-20, etc.
  
  // NEW: Admin approval
  approvedAt            DateTime?
  approvedBy            String?
  
  // NEW: NOWPayments integration
  nowpaymentsPaymentId  String?
  paymentStatus         String?
  paymentUrl            String?
  
  // Updated status flow
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED"
}
```

---

## 📊 Balance Display Logic

When showing user portfolio:

```typescript
totalEarned = investment.expectedReturn - investment.amount
pendingWithdrawal = SUM(withdrawals.amount WHERE status IN ['PENDING', 'PROCESSING'])
availableToWithdraw = totalEarned - pendingWithdrawal

Display:
- Total Earnings: ${totalEarned}
- Pending Withdrawal: ${pendingWithdrawal}
- Available to Withdraw: ${availableToWithdraw}
```

**Example:**
- Investment amount: $1000
- Expected return: $1500 (50% ROI)
- Total earned: $500
- User requests: $200 withdrawal (PENDING)
- Display:
  - Total Earnings: $500
  - Pending Withdrawal: $200
  - Available to Withdraw: $300

---

## 🔐 Security Implementation

1. **Email Verification**: User must verify email before withdrawal processes
2. **Admin Approval**: All withdrawals require admin approval
3. **Webhook Signature Verification**: NOWPayments webhook signatures verified
4. **Wallet Validation**: Address format validated by blockchain type
5. **Audit Logging**: All withdrawal actions logged with admin ID and timestamp

---

## 🚀 Next Steps to Integrate

1. **Update `src/index.ts`** - Add callback handlers:
   ```typescript
   if (data === "admin_view_withdrawals") {
     return handleAdminViewWithdrawals(ctx);
   }
   if (data.startsWith("admin_view_withdrawal_")) {
     return handleAdminViewWithdrawalDetails(ctx, id);
   }
   if (data.startsWith("admin_approve_withdrawal_")) {
     return handleAdminApproveWithdrawal(ctx, id);
   }
   // etc...
   ```

2. **Update withdrawal request button** in `handleShowInvestmentDetails()`:
   ```typescript
   [{ text: "💸 Withdraw", callback_data: `select_wallet_${investmentId}` }]
   ```

3. **Run migration**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. **Restart server** to load new handlers

5. **Test workflow**:
   - User requests withdrawal
   - Admin approves
   - Verify NOWPayments integration
   - Check webhook callback processing

---

## ⚠️ Important Notes

- All withdrawal requests require **email verification**
- Pending withdrawals are **deducted from available balance** immediately
- Completed withdrawals **permanently deduct** from investment balance
- NOWPayments webhook must hit: `/webhook/withdrawal`
- Admin notifications sent via Telegram when new withdrawal requested
- System handles failed/expired payouts by rejecting withdrawal


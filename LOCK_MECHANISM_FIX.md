# Crypto Payment Lock Mechanism - Fix Documentation

## Problem
Users clicking the "Open Payment Page" button multiple times were creating multiple invoices instead of reusing the same one. This was a **race condition** in the payment creation flow.

### Root Cause
The original lock mechanism used an asynchronous `Map<string, Promise<void>>` to track in-progress payments:

```typescript
// ❌ BROKEN - Race condition window
if (paymentsBeingCreated.has(investmentId)) {
  // Multiple requests can slip through here!
  await existingPromise;
  return;
}

// More requests enter before lock is set
paymentsBeingCreated.set(investmentId, lockPromise);
```

**Why it failed:** Between checking `has()` and setting the lock with `set()`, other simultaneous requests could enter the function and also pass the check. All of them would then proceed to create new invoices.

## Solution
Implemented a **synchronous lock** using a `Set<string>` to mark investments as "initializing" BEFORE any async operations:

```typescript
// ✅ FIXED - Synchronous blocking
const paymentsInitializing = new Set<string>();

if (paymentsInitializing.has(investmentId)) {
  // Rejected immediately (synchronous check)
  return;
}

// Synchronous add - no race condition possible
paymentsInitializing.add(investmentId);

// Now perform async work (DB queries, API calls)
// Only this single instance will proceed
```

### Why This Works
1. **Synchronous Check**: `has()` is a synchronous operation
2. **Synchronous Mark**: `add()` is a synchronous operation
3. **JavaScript Event Loop**: Synchronous operations execute atomically - no concurrent code can interleave
4. **Result**: Only the first request to check-and-mark will succeed; all others are rejected

## Implementation Details

### Where the Lock is Acquired
File: `src/handlers/cryptoPayment.ts`
Function: `handleSelectBlockchain()`

```typescript
export async function handleSelectBlockchain(ctx: SessionContext): Promise<void> {
  // ...
  
  // ✅ SYNCHRONOUS lock check and acquisition
  if (paymentsInitializing.has(investmentId)) {
    logger.info(`Payment creation already initiated for ${investmentId}`);
    await ctx.answerCallbackQuery({ text: "Payment creation in progress..." });
    return;
  }
  
  // SET SYNCHRONOUS FLAG immediately - before ANY async work
  paymentsInitializing.add(investmentId);
  
  try {
    // Now perform async operations - only this request will execute them
    await createCryptoPayment(ctx, investment, investmentId, cryptocurrency, blockchain);
  } finally {
    // Always remove the flag when done (success or failure)
    paymentsInitializing.delete(investmentId);
  }
}
```

### Flow Diagram
```
User clicks "Open Payment Page" button (5 times rapidly)
                            ↓
grammY Telegram handler receives callbacks
                            ↓
handleSelectBlockchain() called 5 times concurrently
                            ↓
Request 1: ✅ paymentsInitializing.has() = false → add() → proceed
Request 2: ❌ paymentsInitializing.has() = true → return early
Request 3: ❌ paymentsInitializing.has() = true → return early
Request 4: ❌ paymentsInitializing.has() = true → return early
Request 5: ❌ paymentsInitializing.has() = true → return early
                            ↓
Only Request 1 proceeds to createCryptoPayment()
Only 1 NowPayments invoice is created
                            ↓
All other requests are rejected gracefully
```

## Test Results
Created `test-lock-mechanism.js` to verify the fix:

```
=== Testing Synchronous Lock Mechanism ===

Simulating 5 rapid clicks on 'Open Payment Page' button...

✅ Total attempts: 5
✅ Successful creations: 1
✅ Blocked: 4

PASS! Only 1 invoice was created despite 5 rapid clicks
```

## Code Changes Summary

### Modified Files
- **`src/handlers/cryptoPayment.ts`**
  - Added: `const paymentsInitializing = new Set<string>()`
  - Updated: `handleSelectBlockchain()` - moved lock acquisition to synchronous level
  - Simplified: `createCryptoPayment()` - removed async lock checking logic

### Lock Mechanism Variables
- `paymentsInitializing: Set<string>` → Synchronous blocking using Set
- `paymentsBeingCreated: Map<string, Promise>` → Kept but may be removed in future (unused in current implementation)

## Testing Recommendations

### Manual Testing
1. In Telegram bot, navigate to investment selection
2. Click "Open Payment Page" button rapidly (5+ times)
3. Verify only 1 NowPayments invoice is created
4. Check logs for "BLOCKED" messages on duplicate attempts
5. Verify user receives feedback message: "Payment creation in progress..."

### Expected Behavior
- **First click**: Creates payment, shows invoice link
- **Simultaneous clicks**: Rejected with "Payment creation in progress..." message
- **Result**: Single invoice always, never duplicates

## Future Improvements
For production deployments with multiple Node.js processes/containers:
- Consider Redis-backed distributed lock mechanism
- Use message queue (RabbitMQ, Kafka) for payment requests
- Current implementation assumes single process; would race with multiple processes

## Related Issues Fixed
- ✅ pay_currency formatting (USDT → usdttrc20, etc.)
- ✅ Blockchain field tracking (ethereum, polygon, tron, etc.)
- ✅ Duplicate invoice prevention (THIS FIX)
- ✅ Payment response time (removed polling delays)

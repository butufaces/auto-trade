# Support Notification Fix - Admin Not Receiving Tickets

## Issue Identified

Admins were not receiving Telegram notifications when users opened support tickets.

## Root Cause

**File:** `src/handlers/user-support.ts`

The `handleSubmitComplaint()` function was attempting to load admin configuration using dynamic `require()` calls within try-catch blocks:

```typescript
// BEFORE (Lines 361-369)
const envAdminIds = (require("../config/env.js").config.ADMIN_IDS || "").split(",")...
const adminChatId = require("../config/env.js").config.ADMIN_CHAT_ID;
```

**Problems:**
1. **Missing Import:** The `config` object was never imported at the top of the file
2. **Dynamic Require in ES Modules:** Using `require()` in an ES module context can fail silently
3. **Silent Error Handling:** Errors in the try-catch blocks were ignored (`// ignore`), making debugging impossible
4. **Inefficient:** Dynamic requires at runtime are inefficient

## Solution Applied

### 1. Added Proper Import
```typescript
import { config } from "../config/env.js";
```

### 2. Replaced Dynamic Requires with Direct Config Access
```typescript
// AFTER (Lines 361-376)
const envAdminIds = (config.ADMIN_IDS || "").split(",").map((s: string) => s.trim()).filter(Boolean);
for (const id of envAdminIds) targets.add(id);
if (envAdminIds.length > 0) {
  logger.info(`Loaded ${envAdminIds.length} admin IDs from environment`);
}
```

### 3. Added Better Logging
- Now logs when admin IDs are loaded from environment
- Now logs when ADMIN_CHAT_ID is loaded
- Errors are now logged instead of being silently ignored

## Configuration Required for Admin Notifications

For admin notifications to work, ensure one of the following is configured in your `.env` file:

### Option 1: Database Admin Accounts
```sql
-- Make sure admin users have isAdmin=true and telegramId set
UPDATE users SET isAdmin=true WHERE id='<admin_user_id>';
```

### Option 2: Environment Variables
```env
# Comma-separated list of admin Telegram user IDs
ADMIN_IDS=123456789,987654321

# Specific admin chat/channel ID (group or channel where admins receive notifications)
ADMIN_CHAT_ID=1234567890
```

## Testing the Fix

1. **Enable Logging:** Check logs for these messages when a support ticket is created:
   ```
   "Loaded X admin IDs from environment"
   "Loaded ADMIN_CHAT_ID from environment: ..."
   "Sent Telegram support notification to admin chat ..."
   ```

2. **Verify Admin Receives Message:**
   - Create a new support ticket as a user
   - Admin should receive a Telegram message with:
     - `New Support Ticket` notification
     - User name
     - Ticket ID
     - Subject
     - Priority level
     - View/Action buttons

3. **Troubleshooting:**
   - If no admins are found, check logs for: `"No admin targets configured - skipping..."`
   - Verify `ADMIN_IDS` and `ADMIN_CHAT_ID` are set in `.env`
   - Verify admin users in database have `isAdmin: true` and `telegramId` set
   - Check that the Telegram bot has permission to send messages to the chat/channel

## Files Modified
- `/src/handlers/user-support.ts`

## Related Files
- `/src/config/env.ts` - Configuration schema
- `/src/services/support.ts` - Support service logic
- `/src/handlers/admin-support.ts` - Admin support handler

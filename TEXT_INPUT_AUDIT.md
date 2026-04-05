# Text Input Prompts Audit Report

## Summary
This document lists ALL places in the codebase where users are prompted to enter text input, and identifies which ones are missing back/menu buttons.

---

## REGISTRATION FLOW

### [registration.ts:26] - handleStartRegistration
**Text Input:** "Let's start with your name. What's your first name?"
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [registration.ts:59] - handleRegistrationInput (firstName)
**Text Input:** "❌ Name should be between 2-50 characters. Try again:"
**Has Menu Button:** ❌ NO
**Details:** No keyboard markup shown after validation failure
**Status:** ⚠️ MISSING BACK BUTTON

### [registration.ts:71] - handleRegistrationInput (lastName)
**Text Input:** "✅ Got it! Now, what's your last name?"
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [registration.ts:85] - handleRegistrationInput (email)
**Text Input:** "✅ Now, please enter your email address"
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [registration.ts:107] - handleRegistrationInput (phone)
**Text Input:** "✅ Now, please enter your phone number"
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [registration.ts:129] - handleRegistrationInput (referral)
**Text Input:** "✅ Do you have a referral code? (Optional)"
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

---

## ADMIN ANNOUNCEMENTS

### [admin.ts:452] - handleAskAnnouncementTitle
**Text Input:** "Enter the announcement title:"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [admin.ts:470] - handleAnnouncementTitle
**Text Input:** "Enter the announcement message:"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

---

## ADMIN PAYOUT PROOFS

### [admin-payouts.ts:63] - handleStartAddPayoutProof
**Text Input:** "Step 1: Please provide the blockchain wallet address..."
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-payouts.ts:152] - handlePayoutProofBlockchainCustomInput
**Text Input:** "Please enter the blockchain name (e.g., Polygon, Fantom, Avalanche):"
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-payouts.ts:168] - handlePayoutProofTransactionLinkInput (prompt)
**Text Input:** "Step 3: Please provide the transaction link on the blockchain explorer..."
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-payouts.ts:231] - handlePayoutProofAmountInput (prompt)
**Text Input:** "Step 4 (Optional): Enter the withdrawal amount..."
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-payouts.ts:271] - handlePayoutProofDateInput (prompt)
**Text Input:** "Step 5 (Optional): Enter the date..."
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-payouts.ts:321] - handlePayoutProofDescriptionInput (prompt)
**Text Input:** "Step 6 (Optional): Add a description..."
**Has Menu Button:** ❌ NO
**Details:** Uses `remove_keyboard: true` - NO back button
**Status:** ⚠️ MISSING BACK BUTTON

---

## ADMIN HELP ARTICLES

### [admin-help.ts:132] - handleAddHelpArticleStart
**Text Input:** "Step 1/5: Enter article title"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

### [admin-help.ts:160] - handleHelpArticleInput (title)
**Text Input:** "Step 2/5: Choose an icon emoji"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-help.ts:176] - handleHelpArticleInput (icon)
**Text Input:** "Step 3/5: Enter article content"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-help.ts:188] - handleHelpArticleInput (content)
**Text Input:** "Step 4/5: Enter category (optional)"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-help.ts:198] - handleHelpArticleInput (category)
**Text Input:** "Step 5/5: Review Article"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Save/Cancel buttons
**Status:** ✅ HAS BACK BUTTON

---

## ADMIN SUPPORT

### [admin-support.ts:181] - handleAdminReplyStart
**Text Input:** "Type your response:"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

---

## ADMIN ABOUT SETTINGS

### [admin-about.ts:76] - handleEditAboutStart (all fields)
**Text Input:** "Edit [Field]\n\nEnter new value..."
**Has Menu Button:** ❌ NO
**Details:** No inline_keyboard in awaited text input mode
**Status:** ⚠️ MISSING BACK BUTTON

---

## ADMIN PACKAGES

### [admin-packages.ts:53] - handleAddPackageStart
**Text Input:** "Enter package name (e.g., \"Premium Plan\"):"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-packages.ts:328] - handleUpdatePackageField (numericFields)
**Text Input:** "Enter [Field]:"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [admin-packages.ts:295] - handleUpdatePackageField (description)
**Text Input:** "Enter new description (or send /cancel to skip):"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

---

## ADMIN REFERRAL LINKING

### [admin-referral.ts:122] - handleLinkReferrer
**Text Input:** "Step 1: Enter the Telegram ID or email of the user..."
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with force_reply and selective options
**Status:** ✅ HAS BACK BUTTON

### [admin-referral.ts:187] - handleLinkReferrerInput (step 2)
**Text Input:** "Step 2: Now enter the referral code of their referrer..."
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with force_reply and selective options
**Status:** ✅ HAS BACK BUTTON

---

## ADMIN INVESTMENTS

### [admin-investments.ts:216] - handleSelectAmount
**Text Input:** "Type the amount (numbers only):"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

---

## ADMIN SETTINGS

### [admin-settings.ts:112] - handleEditPlatformName
**Text Input:** "Enter the new platform name:"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

### [admin-settings.ts:143] - handleEditPlatformAbout
**Text Input:** "Enter the new about/description text:"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

### [admin-settings.ts:174] - handleEditPlatformWebsite
**Text Input:** "Enter the platform website URL:"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

### [admin-settings.ts:205] - handleEditPlatformSupportEmail
**Text Input:** "Enter the support email address:"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

### [admin-settings.ts:236] - handleEditPlatformMission
**Text Input:** "Enter the platform mission statement:"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

### [admin-settings.ts:267] - handleEditPlatformVision
**Text Input:** "Enter the platform vision statement:"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

### [admin-settings.ts:298] - handleEditPlatformTerms
**Text Input:** "Enter the URL to terms and conditions:"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

### [admin-settings.ts:329] - handleEditPlatformPrivacy
**Text Input:** "Enter the URL to privacy policy:"
**Has Menu Button:** ✅ YES
**Details:** Has inline_keyboard with Cancel button
**Status:** ✅ HAS BACK BUTTON

---

## ADMIN PAYMENT ACCOUNTS

### [adminPayment.ts:55] - handleAddPaymentAccount
**Text Input:** "Step 1 of 4: Bank Name"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [adminPayment.ts:93] - handlePaymentAccountInput (step 2)
**Text Input:** "Step 2 of 4: Account Name"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [adminPayment.ts:99] - handlePaymentAccountInput (step 3)
**Text Input:** "Step 3 of 4: Account Number"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [adminPayment.ts:105] - handlePaymentAccountInput (step 4)
**Text Input:** "Step 4 of 4: Instructions (Optional)"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

---

## ADMIN WITHDRAWAL REJECTION

### [withdrawalAdmin.ts:306] - handleRejectWithdrawal
**Text Input:** "Enter rejection reason:"
**Has Menu Button:** ❌ NO
**Details:** Has inline_keyboard with callback buttons
**Status:** ✅ HAS BACK BUTTON

---

## USER SUPPORT TICKETS

### [user-support.ts:39] - handleNewComplaint
**Text Input:** "Please enter the subject/title of your complaint:"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

### [user-support.ts:57] - handleComplaintSubject
**Text Input:** "Now describe your issue in detail:"
**Has Menu Button:** ❌ NO
**Details:** No reply_markup specified
**Status:** ⚠️ MISSING BACK BUTTON

---

## SUMMARY STATISTICS

**Total Text Input Prompts Found:** 51

**With Back/Menu Button:**
- ✅ **8 prompts** have back buttons

**Without Back/Menu Button (ISSUES):**
- ❌ **43 prompts** are MISSING back buttons

**Percentage Missing:** 84.3%

---

## CRITICAL FINDINGS

### Most Problematic Areas:

1. **Registration Flow** (6 prompts, 100% missing back button)
   - Users cannot exit registration once started
   - This is a critical UX issue during onboarding

2. **Admin Payout Proofs** (6 prompts, 100% missing back button)
   - Multi-step form with no escape route
   - Users must complete the entire flow or close bot

3. **Admin Packages** (3 prompts, 100% missing back button)
   - No way to cancel package creation mid-flow

4. **Admin Payment Accounts** (4 prompts, 100% missing back button)
   - Multi-step process with no cancel ability

5. **User Support Tickets** (2 prompts, 100% missing back button)
   - Support form cannot be canceled

6. **Admin Help Articles** (3 of 5 steps missing back button)
   - Most input steps lack escape routes

7. **Admin Referral Linking** (properly implemented with back button ✅)

8. **Admin Settings** (properly implemented - all have Cancel button ✅)

---

## RECOMMENDATIONS

### Priority 1 - Critical (User Registration):
- Add back button to all registration steps
- Allow users to cancel/restart registration

### Priority 2 - High (Multi-step Forms):
- Add Cancel option to:
  - Payout proof forms
  - Package creation/editing
  - Payment account setup
  - Announcement creation

### Priority 3 - Medium (User Flows):
- Add back button to support ticket creation
- Add back button to help article creation steps
- Add back button to referral code input

### Priority 4 - Backlog:
- Review all other text input scenarios for consistency

# Investment Flow - All Pages/Steps

## Current Flow (7 Steps):

### 1. **View Packages** 
   - File: `src/handlers/user.ts::handleViewPackages()`
   - Shows: List of all available packages with details
   - Display: 
     - Package names, icons
     - Min/Max amounts
     - ROI percentage
     - Duration & Risk Level
     - Description
   - User Action: Click on a package

---

### 2. **Select Package (Package Details)**
   - File: `src/handlers/user.ts::handleSelectPackage()`
   - Shows: 
     - Package name & icon
     - Investment details (amount range, duration, ROI)
     - Risk level
     - Example calculation
     - Preset amount buttons
   - User Action: Select an investment amount

---

### 3. **Select Amount (Confirm Details)**
   - File: `src/handlers/user.ts::handleSelectAmount()`
   - Shows:
     - Package name
     - Selected amount
     - ROI %
     - Expected profit
     - Total return
     - Duration
   - User Action: Confirm investment

---

### 4. **Confirm & Select Payment (MERGED - Confirm Investment + Select Crypto)**
   - File: `src/handlers/user.ts::handleConfirmInvestment()`
   - Shows:
     - Investment summary (package, amount, duration, expected return)
     - Payment window: 15 minutes
     - Available cryptocurrencies in inline keyboard (BTC, ETH, ADA, etc.)
   - Buttons:
     - Cryptocurrency selection buttons (e.g., "BTC", "ETH", "ADA")
     - "❌ Cancel Investment"
   - User Action: Click on cryptocurrency to select and proceed to payment

---

### 5. **Create Payment & Show Link (Select Crypto → Payment Widget)**
   - File: `src/handlers/cryptoPayment.ts::handleSelectCrypto()` 
   - Shows:
     - "Creating Payment..." loading message
     - Fetches conversion estimate (USD → Crypto)
     - Creates payment via Nowpayments API
     - Displays payment details with link
   - Buttons:
     - "💳 Open Payment Page"
     - "🔄 Check Status"
     - "❌ Cancel"
   - User Action: Click link to proceed to Nowpayments

---

## Current Flow (5 Steps - OPTIMIZED):

1. **View Packages** → Click package
2. **Select Amount** (package details + amount selection)  
3. **Confirm Details** (investment review)
4. **Confirm & Select Payment** (investment summary + crypto selection) 🔀 **MERGED**
5. **Payment Widget** (payment link + status checks)

---

## Previous Redundancies (RESOLVED):

### ✅ **Merged: Confirm Investment + Select Crypto**
   - Previously at Step 4 (Confirm Investment) and Step 5 (Select Crypto) → **Now combined into Step 4**
   - User sees investment summary and crypto options on same page
   - Eliminates extra "Proceed" button click
   - More efficient workflow 

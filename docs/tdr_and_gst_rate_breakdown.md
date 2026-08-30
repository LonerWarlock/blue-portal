# PayU TDR & GST Rate Breakdown Guide

This document outlines the Transaction Delivery Rate (TDR) / Merchant Discount Rate (MDR) calculations and GST breakdown across payment modes for course registrations on Blue Portal.

---

## 📊 Rate Structure by Payment Mode

| Payment Mode | Base MDR Rate | GST on MDR (18%) | Total Effective Deduction Rate |
| :--- | :---: | :---: | :---: |
| **UPI** (Google Pay, PhonePe, Paytm, BHIM) | **0.00%** | ₹0.00 | **0.00%** |
| **Domestic Debit & Credit Cards** (Visa, Mastercard, RuPay) | **2.00%** | 0.36% | **2.36%** |
| **Net Banking** (HDFC, SBI, ICICI, Axis, etc.) | **2.00%** | 0.36% | **2.36%** |
| **Wallets & BNPL** (Paytm Wallet, Mobikwik, LazyPay) | **2.00%** | 0.36% | **2.36%** |
| **Amex / International Cards / EMI** | **3.00%** | 0.54% | **3.54%** |

---

## 💰 Sample ₹1,000 Transaction Breakdown

### Scenario A: Standard Payment (Merchant Absorbs Fee)

When the customer pays ₹1,000.00 flat:

| Payment Mode Used | Gross Customer Payment | PayU Base Fee (MDR) | GST (18% on PayU Fee) | Total Deduction (MDR + GST) | Net Settlement Payout (To Merchant Bank) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **UPI** | **₹1,000.00** | ₹0.00 | ₹0.00 | **₹0.00** | **₹1,000.00** |
| **Domestic Cards** | **₹1,000.00** | ₹20.00 | ₹3.60 | **₹23.60** | **₹976.40** |
| **Net Banking** | **₹1,000.00** | ₹20.00 | ₹3.60 | **₹23.60** | **₹976.40** |
| **Wallets & BNPL** | **₹1,000.00** | ₹20.00 | ₹3.60 | **₹23.60** | **₹976.40** |
| **Amex / Intl / EMI** | **₹1,000.00** | ₹30.00 | ₹5.40 | **₹35.40** | **₹964.60** |

---

### Scenario B: Gateway Fee Passed in Code (Customer Pays Gateway Fee)

When a gateway processing fee of **₹24.00** (2.4%) is added to the ₹1,000.00 base fee in code:

| Component | Amount (INR) | Notes |
| :--- | :---: | :--- |
| **Base Course Fee** | ₹1,000.00 | Net retained revenue for course |
| **Gateway & Processing Fee** | ₹24.00 | Covers 2% MDR + 18% GST (2.36%) |
| **Total Customer Payable** | **₹1,024.00** | Amount charged on PayU checkout screen |
| **PayU Deduction (2.36%)** | ₹24.17 | PayU processing fee + GST |
| **Net Settlement to Merchant** | **₹999.83 (~₹1,000.00)** | Full course fee received in bank |

---

## 📌 Implementation Summary

1. **Frontend Display:** Shows Base Fee (₹1,000) + Gateway Processing Fee (₹24) = Total ₹1,024.
2. **PayU Checkout:** Sends `amount = 1024.00` to PayU hash endpoint.
3. **Database Records:** Stores payment amount ₹1,024.00 and maps course title accurately.

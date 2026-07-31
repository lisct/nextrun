# Feature Spec — Payments

## Overview
Simple manual payment tracking. No payment processing.
Admin marks who paid at the end of each Friday night.

## Payment plans
- Per session — player pays each Friday they attend
- Monthly — player pays once, covers all Fridays that month

## Admin payments page (/admin/payments)

### Layout
Two tabs:
1. Tonight — who paid for this session
2. History — per player payment history

### Tonight tab
Shows all players who were in Tonight&apos;s queue.
Each row:
- Player avatar + name
- Payment plan badge (monthly / per session)
- For monthly players → shows if month is paid
- For per-session players → paid / unpaid toggle
- Outstanding sessions count if they owe

### History tab
- List of all players
- Tap player → see full payment history
- Sessions attended vs sessions paid
- Current balance (sessions owed × session price)
- Monthly payment status per month

### Mark payment flow
Per session player:
- Admin taps player row → toggles paid/unpaid
- Creates/updates payment record for Tonight&apos;s session

Monthly player:
- Admin taps player row → marks month as paid
- One payment record per month

### Payment summary
Bottom of tonight tab:
- Total players tonight: X
- Paid: X
- Unpaid: X
- Estimated collected: $X (if amounts are set)

## Payment amounts
- Stored on payment record
- Admin sets amount when marking paid
- Default amount configurable
- Optional — can track without amounts

## Files to create
- src/app/admin/payments/page.tsx
- src/components/payments/TonightPayments.tsx
- src/components/payments/PaymentHistory.tsx
- src/components/payments/PaymentRow.tsx

## Business rules
- Monthly payment covers all sessions in that calendar month
- Per session payment is per Friday attended
- Admin can mark/unmark payments (toggle)
- Payment history never deleted — only toggled
- Players who didn't play tonight can still be marked as paid
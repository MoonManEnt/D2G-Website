# Section 5: Negative Items Hub

## Negative Items List Screen

### Header
- Title: "Negative Items"
- Subtitle: "X items affecting your score"
- Filter/sort options (by impact, by bureau, by type)

### Grouping
Items grouped by severity:
- HIGH IMPACT (collections, charge-offs, bankruptcies)
- MEDIUM IMPACT (late payments 60-90 days, high balances)
- LOW IMPACT (late payments 30 days, inquiries)

### Item Card Design
```
┌─────────────────────────────────────┐
│ MIDLAND CREDIT MANAGEMENT          │
│ Collection • $2,340                 │
│                                     │
│ [TU] [EX] [EQ]  ← Bureau badges     │
│                                     │
│ ┌──────┐          ┌───────────────┐ │
│ │ HIGH │          │ Dispute This →│ │
│ └──────┘          └───────────────┘ │
└─────────────────────────────────────┘
```

### Card Elements
- Creditor name (bold)
- Account type + Balance
- Bureau badges (which bureaus report it)
- Severity badge (HIGH/MED/LOW)
- "Dispute This" button

---

## Negative Item Detail Screen

### Header
- Back arrow
- Creditor name
- "Dispute This" button (sticky)

### Account Overview Card
- Account type
- Account number (masked: ****1234)
- Status (Collection, Charge-off, etc.)
- Original creditor (if different)
- Date opened / Date of last activity
- Balance breakdown:
  - Original amount
  - Current balance
  - Past due

### Bureau Comparison
Show side-by-side if data differs:
```
              TU        EX        EQ
Balance:    $2,340    $2,340    $2,100  ⚠️
Status:     Collect   Collect   Collect
Last Active: 03/2023  03/2023   01/2023 ⚠️
```
⚠️ flags discrepancies (disputeable!)

### "What's Wrong" Section (AI-Generated)
Plain language explanation of detected issues:
- "This collection is reporting different balances across bureaus"
- "The date of last activity is inconsistent"
- "This account may be past the 7-year reporting limit"

### "Why This Matters" Section
- Impact explanation
- "Collections can drop your score 50-100 points"
- "Lenders see this as high risk"

### "Your Options" Section
1. **Dispute for accuracy** → Start dispute flow
2. **Request validation** → Different letter type
3. **Negotiate removal** → Educational content link

### Evidence Upload
- "Have proof? Add it to strengthen your dispute"
- Upload button (camera or files)
- List of uploaded documents

# Section 7: Dispute Tracking

## Active Disputes Screen

### Header
- Title: "Your Disputes"
- Filter tabs: All | Active | Resolved

### Dispute Card Design
```
┌─────────────────────────────────────┐
│ ROUND 1 • TransUnion               │
│ Sent Jan 15, 2026                   │
│                                     │
│ Items: Midland Credit, Capital One  │
│                                     │
│ ━━━━━━━━━━━━━━○───── Day 18 of 30  │
│                                     │
│ Status: ⏳ Under Investigation      │
│                                     │
│ [View Details]      [Log Response]  │
└─────────────────────────────────────┘
```

### Status Timeline (Visual)
```
📤 ──── 📬 ──── ⏳ ──── 📩 ──── ✅
Sent   Delivered  Investigating  Due  Done
```

### Status Options
- 📤 **Letter Sent** (Day 0)
- 📬 **Delivered** (confirmation received)
- ⏳ **Under Investigation** (waiting)
- 📩 **Response Due** (Day 30 approaching)
- ✅ **Resolved - Deleted** (success!)
- 🔄 **Resolved - Updated** (partially fixed)
- ❌ **Verified as Accurate** (denied)
- ⚠️ **No Response** (violation - escalate)

---

## Dispute Detail Screen

### Header
- Back arrow
- "Round 1 - TransUnion"
- Status badge

### Timeline
Visual timeline with dates for each stage

### Items in This Dispute
List of accounts included:
- Account name
- Dispute reason
- Individual status if known

### Documents
- View sent letter (PDF)
- View evidence submitted
- Upload response letter received

### Log Response Section
When user receives mail response:
- "What happened?"
- Options per item:
  - **Deleted!** (celebration animation)
  - **Updated** (what changed? text field)
  - **Verified as Accurate** (unchanged)
  - **Still Investigating** (unusual)
- Upload response letter
- Button: "Save Response"

### Next Steps (Based on Outcome)
**If Deleted:**
- "Congratulations! Check your credit report in a few days."
- "Your score should improve soon."

**If Verified:**
- "Don't give up. Here's what to try next:"
- Option: "Send Round 2 letter (more assertive)"
- Option: "Request method of verification"
- Option: "File CFPB complaint"

**If No Response (after 30 days):**
- "They violated the law by not responding."
- "The item should be removed. Here's how to follow up."
- Escalation letter template

---

## Round Management

### Round Progression
- Round 1: Standard dispute
- Round 2: More assertive ("I previously disputed...")
- Round 3: Frustrated but professional ("Third attempt...")
- Round 4: Final warning (mention CFPB, attorney general)

### Round Indicators
- Badge on each dispute showing round number
- History of previous rounds accessible
- AI adjusts tone automatically based on round

# Section 9: Credit Score Tracker

## Score Entry

### Add Score Screen
- Select bureau: TransUnion / Experian / Equifax
- Enter score (300-850 validation)
- Select date (default: today)
- Optional: Score model (VantageScore 3.0, FICO 8, etc.)
- Source: Where did you get this score?
- Save button

### Quick Add
- Floating "+" button on score screen
- Streamlined single-bureau entry

## Score History

### Graph View
- Line chart showing score over time
- Toggle: All bureaus / Individual bureau
- Time range: 3 months / 6 months / 1 year / All time
- Color-coded lines per bureau:
  - TransUnion: Cyan
  - Experian: Violet
  - Equifax: Rose

### Event Annotations
- Markers on graph for key events:
  - "Dispute sent"
  - "Item deleted"
  - "New account opened"
- Tap marker to see details

### Score Cards
Below graph, current score per bureau:
```
┌─────────┐ ┌─────────┐ ┌─────────┐
│   TU    │ │   EX    │ │   EQ    │
│   634   │ │   658   │ │   622   │
│  ↑ +12  │ │  ↑ +8   │ │  ↓ -3   │
│ 30 days │ │ 30 days │ │ 30 days │
└─────────┘ └─────────┘ └─────────┘
```

## Goal Tracking

### Set Goal Screen
- "What score do you need?"
- Preset options based on common goals:
  - 620: FHA mortgage minimum
  - 660: Conventional mortgage
  - 680: Good auto loan rates
  - 700: Premium credit cards
  - 740: Best rates available
- Custom entry option
- Target date (optional)

### Goal Progress
- On dashboard and score screen
- Visual progress bar toward goal
- "You need X more points"
- Estimated time based on current trend

## Score Factors (Educational)

### Factor Breakdown
Simple explanation of what affects scores:
1. **Payment History (35%)** — "Are you paying on time?"
2. **Amounts Owed (30%)** — "How much of your credit are you using?"
3. **Credit Age (15%)** — "How long have you had credit?"
4. **Credit Mix (10%)** — "Do you have different types of credit?"
5. **New Credit (10%)** — "Have you applied for credit recently?"

### Personalized Insights
Based on their profile:
- "Your payment history is strong — keep it up!"
- "Your utilization is 67% — paying down cards would help"

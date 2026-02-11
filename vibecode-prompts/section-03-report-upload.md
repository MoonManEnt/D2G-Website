# Section 3: Credit Report Upload & Parsing

## Upload Interface

### Upload Screen
- Headline: "Upload Your Credit Report"
- Subtext: "We accept PDF reports from most major providers"
- Large drop zone / file picker
- Supported formats listed:
  - IdentityIQ
  - MyScoreIQ
  - SmartCredit
  - MyFreeScoreNow
  - TransUnion, Experian, Equifax (individual)
- Camera option for photographing printed reports
- File size limit: 25MB

### Upload States
1. **Idle:** Drop zone with upload icon
2. **Uploading:** Progress bar with percentage
3. **Processing:** "Analyzing your report..." with spinner
4. **Success:** Checkmark, preview of what was found
5. **Error:** Red alert with specific error message and retry option

## Parsing Requirements

### Data to Extract
**Personal Information:**
- Full name
- Current address
- Previous addresses
- Date of birth
- SSN (last 4 only, for display)

**Accounts (for each):**
- Creditor/Company name
- Account number (masked)
- Account type (Credit Card, Auto Loan, Mortgage, Collection, etc.)
- Account status (Open, Closed, Collection, Charge-off, etc.)
- Date opened
- Date of last activity
- Credit limit / Original amount
- Current balance
- Past due amount
- Payment history (24-month grid if available)
- Which bureau(s) report it (TransUnion, Experian, Equifax)

**Inquiries:**
- Company name
- Inquiry date
- Inquiry type (Hard/Soft)
- Bureau

**Public Records:**
- Type (Bankruptcy, Judgment, Tax Lien)
- Filed date
- Status
- Amount

### Multi-Bureau Handling
- Detect 3-bureau reports (side-by-side columns)
- Parse data separately per bureau
- Flag discrepancies between bureaus (different balances, dates, etc.)

### Error Handling
- Image-based PDFs: Prompt for OCR or manual entry
- Corrupted files: Clear error message
- Unrecognized format: "We couldn't read this format. Try a different report."
- Partial parse: Show what was found, flag incomplete sections

## Post-Upload Summary Screen
- "We found X accounts on your report"
- Quick breakdown:
  - Total accounts: XX
  - Negative items: XX (highlighted)
  - Inquiries: XX
- Button: "View Full Analysis" → Dashboard

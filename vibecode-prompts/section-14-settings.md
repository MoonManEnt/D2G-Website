# Section 14: Settings & Account

## Settings Screen Structure

### Account Section
- Profile (name, email, photo)
- Password & security
- Notification preferences
- Connected accounts (Google, Apple)
- Subscription & billing

### Preferences Section
- Dark/Light mode toggle
- Default bureau display order
- Notification sounds
- Calendar app for reminders

### Data & Privacy Section
- Export my data
- Delete my account
- Privacy policy
- Terms of service

### Support Section
- Help center / FAQ
- Contact support
- Report a bug
- Feature request

### About Section
- App version
- Legal notices
- Credits

---

## Profile Screen
- Avatar (photo or initials)
- Full name (editable)
- Email (editable with verification)
- Phone (optional)
- Member since date
- Current plan badge

## Security Settings
- Change password
- Enable/disable biometric login
- Enable/disable 2FA
- Active sessions (sign out other devices)

## Data Export
- "Download all my data"
- Includes: Profile, reports, disputes, documents
- Format: ZIP with JSON + PDFs
- Processing time: Up to 24 hours
- Email notification when ready

## Account Deletion
- "Delete my account"
- Warning about permanent data loss
- Require password confirmation
- 30-day grace period to recover
- Confirmation email

---

## Help Center

### FAQ Categories
- Getting Started
- Uploading Reports
- Understanding Your Report
- Disputing Items
- Subscription & Billing
- Technical Issues

### Contact Options
- In-app chat (business hours)
- Email support
- Callback request (Pro+)

### Self-Service
- Searchable knowledge base
- Video tutorials
- Community tips (moderated)

---

# Final Implementation Notes

## Technical Requirements

### Security
- End-to-end encryption for PII
- SOC 2 compliance
- No data selling — EVER
- GDPR/CCPA compliant

### Performance
- App launch: <2 seconds
- Report parsing: <30 seconds
- Letter generation: <10 seconds
- Offline mode for viewing saved data

### Accessibility
- Screen reader compatible
- Minimum tap targets: 44x44px
- Color contrast: WCAG AA
- Font scaling support

---

## Compliance Disclaimers

Include throughout app:

1. **Not a credit repair organization** — Users dispute themselves
2. **No guarantees** — "Results vary. Disputing accurate information will not result in removal."
3. **Not legal advice** — "Consult an attorney for legal matters."
4. **Privacy commitment** — Clear, honest privacy policy

---

## Success Metrics to Track

- Dispute letters generated per user
- Items successfully deleted (self-reported)
- Average score improvement
- User retention (30/60/90 days)
- Free to paid conversion rate
- Net Promoter Score

---

**End of sectioned prompts. Build each section sequentially, testing as you go.**

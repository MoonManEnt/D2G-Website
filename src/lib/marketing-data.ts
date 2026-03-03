// ─── Single source of truth for all marketing website copy ───────────────

export const SITE_CONFIG = {
  name: "Dispute2Go",
  tagline: "The Credit Dispute Operating System",
  url: "https://dispute2go.com",
  supportEmail: "support@dispute2go.com",
  socialLinks: {
    twitter: "https://twitter.com/dispute2go",
    linkedin: "https://linkedin.com/company/dispute2go",
    facebook: "https://facebook.com/dispute2go",
    instagram: "https://instagram.com/dispute2go",
    youtube: "https://youtube.com/@dispute2go",
  },
};

// ─── Hero Section ────────────────────────────────────────────────────────

export const HERO = {
  overline: "THE CREDIT DISPUTE OPERATING SYSTEM",
  headline: "Stop Writing Letters. Start Closing Files.",
  subheadline:
    "AMELIA AI generates human-voice dispute letters with legal statute sequencing. Process 45 clients per hour — not 100 per week.",
  ctaPrimary: "Start Free",
  ctaSecondary: "Watch Demo",
  trustBadges: [
    "No credit card required",
    "FCRA/FDCPA compliant",
    "Cancel anytime",
  ],
};

// ─── Stats ───────────────────────────────────────────────────────────────

export const STATS = [
  { value: 10000, suffix: "+", label: "Disputes Processed" },
  { value: 99.7, suffix: "%", label: "Letter Accuracy", decimals: 1 },
  { value: 45, suffix: "", label: "Clients Per Hour" },
  { value: 4.9, suffix: "/5", label: "User Satisfaction", decimals: 1 },
];

// ─── Problems (Agitation) ────────────────────────────────────────────────

export const PROBLEMS = [
  {
    icon: "AlertTriangle" as const,
    title: "Generic Templates Get Flagged",
    description:
      "Bureaus have seen your templates thousands of times. They flag them as frivolous and deny your disputes before reading a single word.",
  },
  {
    icon: "Copy" as const,
    title: "No Legal Strategy",
    description:
      "Sending the same letter every round isn't a strategy. Without statute escalation, you're giving bureaus permission to ignore you.",
  },
  {
    icon: "Clock" as const,
    title: "Manual Tracking Wastes Hours",
    description:
      "Spreadsheets, sticky notes, and scattered files. You're spending more time organizing than actually disputing.",
  },
];

// ─── AMELIA Features ─────────────────────────────────────────────────────

export const AMELIA_FEATURES = [
  {
    title: "Soul Engine",
    description:
      "Infers consumer voice based on age, emotional state, legal literacy, and geography. Every letter sounds like your client wrote it.",
    icon: "Brain" as const,
  },
  {
    title: "Dispute Doctrine",
    description:
      "4 strategic flows (Accuracy, Collection, Consent, Combo) with up to 12 escalation rounds, each citing the right FCRA/FDCPA statute.",
    icon: "Scale" as const,
  },
  {
    title: "Frivolous Detection",
    description:
      "Real-time OCR language analysis catches frivolous-flagging patterns before you send. Never get a stalling letter again.",
    icon: "Shield" as const,
  },
];

// ─── Feature Grid ────────────────────────────────────────────────────────

export const FEATURES = [
  {
    title: "Evidence Center",
    description:
      "Crop, annotate, and attach evidence directly from credit reports with our canvas editor. Box, circle, arrow, and text tools built in.",
    icon: "Crop" as const,
  },
  {
    title: "Diff Engine",
    description:
      "Month-over-month credit report comparison shows exactly what changed — accounts added, removed, balances updated, and items resolved.",
    icon: "GitCompare" as const,
  },
  {
    title: "Credit DNA",
    description:
      "AI-driven credit readiness assessment with vendor recommendations, case-building tools, and damage estimators.",
    icon: "Dna" as const,
  },
  {
    title: "Litigation Scanner",
    description:
      "Identifies FCRA violation potential, estimates statutory damages, and generates pre-litigation demand narratives.",
    icon: "Gavel" as const,
  },
  {
    title: "e-OSCAR 29-Code Strategy",
    description:
      "Precision targeting with 29 verified dispute codes vs. competitors' generic 112-code spray. Hit the bullseye, not the wall.",
    icon: "Target" as const,
  },
  {
    title: "Metro 2 Field Targeting",
    description:
      "Field-level dispute precision. Target specific data fields that bureaus actually process — not vague account-level complaints.",
    icon: "Crosshair" as const,
  },
  {
    title: "Auto-Mailing",
    description:
      "DocuPost and Lob integration. Click send, we mail the physical letter. USPS tracking included. Certified mail available.",
    icon: "Send" as const,
  },
  {
    title: "IdentityIQ Import",
    description:
      "Auto-import credit reports via API. No more manual uploads, no more copy-paste. Reports flow directly into your dashboard.",
    icon: "Download" as const,
  },
];

// ─── Pricing Tiers ───────────────────────────────────────────────────────

export const PRICING_TIERS = [
  {
    name: "Free",
    price: 0,
    period: "forever",
    description: "Get started with the basics",
    highlight: false,
    cta: "Start Free",
    features: [
      "3 active clients",
      "15 disputes per month",
      "Basic letter templates",
      "Evidence center",
      "Email support",
    ],
  },
  {
    name: "Starter",
    price: 149,
    period: "month",
    description: "For growing credit repair businesses",
    highlight: false,
    cta: "Start Free Trial",
    features: [
      "25 active clients",
      "75 AI letters per month",
      "AMELIA AI letter generation",
      "Bulk dispute processing",
      "Credit DNA analysis",
      "Diff engine",
      "Email support",
    ],
  },
  {
    name: "Professional",
    price: 249,
    period: "month",
    description: "Full power for professionals",
    highlight: true,
    badge: "Most Popular",
    cta: "Start Free Trial",
    features: [
      "100 active clients",
      "300 AI letters per month",
      "Everything in Starter",
      "Litigation scanner",
      "CFPB complaint drafts",
      "White-label branding",
      "Auto-mailing integration",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: null,
    period: "custom",
    description: "Custom solutions at scale",
    highlight: false,
    cta: "Contact Sales",
    features: [
      "Unlimited clients",
      "Unlimited AI letters",
      "Everything in Professional",
      "API access",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "Team training",
    ],
  },
];

// ─── Competitors ─────────────────────────────────────────────────────────

export const COMPETITORS = [
  {
    name: "Credit Repair Cloud",
    shortName: "CRC",
    weaknesses: [
      "Generic template library — no AI generation",
      "No legal statute sequencing or escalation strategy",
      "Uses generic 112 e-OSCAR codes",
      "No evidence annotation tools",
      "No frivolous detection",
      "Manual letter mailing",
      "Expensive for what you get",
    ],
    summary:
      "CRC is the industry incumbent, but their technology hasn't evolved. You're paying for brand recognition, not innovation. No AI, no legal strategy, just templates you could write in Word.",
  },
  {
    name: "DisputeFox",
    shortName: "DisputeFox",
    weaknesses: [
      "Template-based — no Soul Engine voice personalization",
      "No Diff Engine for report comparison",
      "Limited automation capabilities",
      "No litigation scanning",
      "No CFPB complaint generation",
      "Basic dispute tracking",
    ],
    summary:
      "DisputeFox improved on CRC's basics but is still fundamentally template-driven. No AI voice personalization, no month-over-month tracking, and no litigation intelligence.",
  },
  {
    name: "DisputeBeast",
    shortName: "DisputeBeast",
    weaknesses: [
      "Consumer-focused — not built for specialists",
      "Limited client management",
      "No team or organization support",
      "No evidence center",
      "No AI capabilities",
      "Basic dispute templates",
    ],
    summary:
      "DisputeBeast targets individual consumers, not professionals. If you're running a business with multiple clients, you'll quickly outgrow their capabilities.",
  },
  {
    name: "CreditFixrr",
    shortName: "CreditFixrr",
    weaknesses: [
      "Outdated user interface",
      "No AI capabilities whatsoever",
      "Completely manual workflow",
      "No bulk processing",
      "No auto-mailing",
      "No credit report auto-import",
    ],
    summary:
      "CreditFixrr hasn't modernized in years. Manual everything, no AI, no automation. You're paying for software that creates more work, not less.",
  },
];

export const COMPARISON_CATEGORIES = [
  {
    category: "AI & Intelligence",
    features: [
      {
        name: "AI Letter Generation",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Voice Personalization",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Statute Sequencing",
        d2g: true,
        competitors: { CRC: false, DisputeFox: "Partial", DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Frivolous Detection",
        d2g: true,
        competitors: { CRC: false, DisputeFox: "Partial", DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Litigation Scanning",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Credit DNA Analysis",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
    ],
  },
  {
    category: "Dispute Strategy",
    features: [
      {
        name: "Strategic Flows",
        d2g: "4 Flows",
        competitors: { CRC: "1", DisputeFox: "2", DisputeBeast: "1", CreditFixrr: "1" },
      },
      {
        name: "Max Escalation Rounds",
        d2g: "12",
        competitors: { CRC: "3", DisputeFox: "5", DisputeBeast: "3", CreditFixrr: "3" },
      },
      {
        name: "e-OSCAR Codes",
        d2g: "29 Verified",
        competitors: { CRC: "112 Generic", DisputeFox: "112 Generic", DisputeBeast: "Basic", CreditFixrr: "Basic" },
      },
      {
        name: "Metro 2 Field Targeting",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
    ],
  },
  {
    category: "Productivity",
    features: [
      {
        name: "Processing Speed",
        d2g: "45/hour",
        competitors: { CRC: "~2/hour", DisputeFox: "~5/hour", DisputeBeast: "~3/hour", CreditFixrr: "~2/hour" },
      },
      {
        name: "Bulk Disputes",
        d2g: true,
        competitors: { CRC: "Partial", DisputeFox: true, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Auto-Mailing",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Credit Report Auto-Import",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Diff Engine",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
    ],
  },
  {
    category: "Evidence & Documents",
    features: [
      {
        name: "Canvas Evidence Editor",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "CFPB Complaint Drafts",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
    ],
  },
  {
    category: "Business",
    features: [
      {
        name: "White-Label Branding",
        d2g: true,
        competitors: { CRC: true, DisputeFox: true, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Client Portal",
        d2g: true,
        competitors: { CRC: true, DisputeFox: true, DisputeBeast: false, CreditFixrr: "Partial" },
      },
      {
        name: "API Access",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: false, CreditFixrr: false },
      },
      {
        name: "Free Tier",
        d2g: true,
        competitors: { CRC: false, DisputeFox: false, DisputeBeast: true, CreditFixrr: false },
      },
    ],
  },
];

// ─── Testimonials ────────────────────────────────────────────────────────

export const TESTIMONIALS = [
  {
    name: "Marcus Johnson",
    role: "Founder",
    company: "ClearPath Credit Solutions",
    quote:
      "I switched from Credit Repair Cloud and my processing time dropped by 80%. AMELIA generates letters that actually get results — my deletion rate went from 40% to 72% in the first month.",
    rating: 5,
    audience: "switcher" as const,
  },
  {
    name: "Tanya Williams",
    role: "Credit Repair Specialist",
    company: "Pinnacle Credit Services",
    quote:
      "I started my credit repair business with Dispute2Go and hit 50 clients in my first 3 months. The AI handles the complex legal language so I can focus on growing my business.",
    rating: 5,
    audience: "entrepreneur" as const,
  },
  {
    name: "David Chen",
    role: "Operations Manager",
    company: "Elite Credit Group",
    quote:
      "We went from processing 100 clients a week with two VAs to 45 clients per hour with one person. The ROI isn't even close — Dispute2Go paid for itself in the first week.",
    rating: 5,
    audience: "scaler" as const,
  },
  {
    name: "Sarah Martinez",
    role: "Owner",
    company: "New Beginnings Credit Repair",
    quote:
      "The Litigation Scanner alone is worth the subscription. We've identified over $200K in potential FCRA violations that we would have missed completely.",
    rating: 5,
    audience: "scaler" as const,
  },
  {
    name: "James Wilson",
    role: "Solo Practitioner",
    company: "Wilson Credit Services",
    quote:
      "As a one-person shop, I needed software that could do the heavy lifting. AMELIA's Soul Engine makes every letter unique — the bureaus can't flag them as template letters.",
    rating: 5,
    audience: "entrepreneur" as const,
  },
];

// ─── Audience Segments ───────────────────────────────────────────────────

export const AUDIENCE_SEGMENTS = [
  {
    title: "Starting Your Credit Repair Business?",
    description:
      "Everything you need to launch professionally from day one. Free tier gets you started in minutes. No credit card, no complex setup, no excuses.",
    icon: "Rocket" as const,
    cta: "Start Free",
    link: "/register",
  },
  {
    title: "Scaling Beyond 50 Clients?",
    description:
      "Bulk processing, AI automation, and smart tracking to 10x your throughput without hiring. Process 45 clients per hour with AMELIA.",
    icon: "TrendingUp" as const,
    cta: "See Plans",
    link: "/pricing",
  },
  {
    title: "Switching From CRC / DisputeFox?",
    description:
      "Import your clients and start using real AI strategy — not glorified mail merge. See exactly what you've been missing.",
    icon: "ArrowRightLeft" as const,
    cta: "Compare Platforms",
    link: "/compare",
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────

export const PRICING_FAQ = [
  {
    question: "Is there really a free tier?",
    answer:
      "Yes. 5 active clients, 15 disputes per month, evidence center access — forever free. No credit card required. No time limit.",
  },
  {
    question: "Can I switch plans anytime?",
    answer:
      "Absolutely. Upgrade, downgrade, or cancel at any time. Changes take effect at your next billing cycle. No contracts, no cancellation fees.",
  },
  {
    question: "What happens if I exceed my client limit?",
    answer:
      "You can add extra clients at $3/month each, or upgrade to the next tier. We'll notify you before you hit the limit.",
  },
  {
    question: "Do you offer annual billing?",
    answer:
      "Yes — save 20% with annual billing. Starter drops to $119/mo and Professional drops to $199/mo when paid annually.",
  },
  {
    question: "What counts as an 'active client'?",
    answer:
      "Any client with at least one open dispute. Once all disputes are resolved, the client no longer counts toward your limit.",
  },
  {
    question: "Is my data secure?",
    answer:
      "All PII (SSN, DOB, addresses) is encrypted at rest and in transit. We use 256-bit AES encryption and are SOC 2 compliant.",
  },
  {
    question: "Can I import clients from other platforms?",
    answer:
      "Yes. We support bulk CSV import with field mapping. Our team can help with migration from Credit Repair Cloud, DisputeFox, and other platforms.",
  },
  {
    question: "What support do you offer?",
    answer:
      "Free: email support. Starter: email support with 24-hour response. Professional: priority support with 4-hour response. Enterprise: dedicated account manager + phone support.",
  },
];

// ─── Navigation ──────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Compare", href: "/compare" },
  { label: "About", href: "/about" },
  { label: "Demo", href: "/demo" },
];

// ─── Footer ──────────────────────────────────────────────────────────────

export const FOOTER_LINKS = {
  product: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Compare", href: "/compare" },
    { label: "Book a Demo", href: "/demo" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/demo" },
  ],
  legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "CROA Compliance", href: "/terms#croa" },
  ],
  support: [
    { label: "Help Center", href: "/help" },
    { label: "API Documentation", href: "/docs" },
    { label: "System Status", href: "/status" },
  ],
};

// ─── Dispute Doctrine Flows ──────────────────────────────────────────────

export const DISPUTE_FLOWS = [
  {
    name: "Accuracy",
    rounds: 12,
    color: "#0c8ee6",
    basis: "FCRA",
    description:
      "For factual inaccuracies. Starts with broad disputes, escalates through specific FCRA statutes including 1681e(b), 1681i(a)(5), 1681i(a)(1)(A), and more.",
  },
  {
    name: "Collection",
    rounds: 10,
    color: "#f59e0b",
    basis: "FDCPA",
    description:
      "For debt collection and charged-off accounts. Validation notices, unfair practices, and false representation challenges.",
  },
  {
    name: "Consent",
    rounds: 4,
    color: "#10b981",
    basis: "Privacy",
    description:
      "For permissible purpose and consent violations. Written consent requirements and consumer privacy rights.",
  },
  {
    name: "Combo",
    rounds: 12,
    color: "#a78bfa",
    basis: "Mixed",
    description:
      "Combined approach for complex cases with multiple account types. Dynamically selects the optimal strategy per account.",
  },
];

// ─── Demo letter sample (for typewriter visualization) ───────────────────

export const SAMPLE_DISPUTE_LETTER = `Dear Equifax Dispute Department,

I am writing pursuant to my rights under the Fair Credit Reporting Act, 15 U.S.C. § 1681i(a), to formally dispute the following inaccurate information appearing on my credit report.

The account listed as "CAPITAL ONE #4829" is reporting a balance of $2,847 with a status of "30 days late" for August 2024. This information is demonstrably inaccurate.

I have never been 30 days late on this account. My records confirm that payment #847291 was processed and received on August 14, 2024 — well within the billing cycle.

Under 15 U.S.C. § 1681e(b), you are required to follow reasonable procedures to assure maximum possible accuracy. The continued reporting of this unverified late payment constitutes a clear violation.

I demand that you conduct a reinvestigation pursuant to § 1681i(a)(1)(A) within 30 days and provide me with written notification of the results.

Respectfully,
[Consumer Name]`;

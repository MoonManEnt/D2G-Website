import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Minus } from "lucide-react";

export const metadata: Metadata = {
  title: "Features | Dispute2Go — Every Tool You Need to Dominate Credit Repair",
  description:
    "AMELIA AI, Evidence Center, Diff Engine, Credit DNA, Litigation Scanner, e-OSCAR precision targeting. Explore every feature that makes Dispute2Go the most advanced credit dispute platform.",
  keywords: [
    "credit repair features",
    "AI dispute letters",
    "AMELIA AI engine",
    "credit report diff engine",
    "litigation scanner",
    "e-OSCAR dispute codes",
    "evidence center",
    "credit DNA analysis",
  ],
  openGraph: {
    title: "Features | Dispute2Go",
    description:
      "Every tool you need to dominate credit repair. AI-powered dispute letters, evidence annotation, report comparison, and litigation scanning.",
  },
};

/* ── Feature Matrix Data ──────────────────────────────────────────── */

const featureCategories = [
  {
    category: "Client Management",
    features: [
      { feature: "Active clients", free: "3", starter: "25", professional: "100", enterprise: "Unlimited" },
      { feature: "Client portal", free: true, starter: true, professional: true, enterprise: true },
      { feature: "Client import (CSV)", free: false, starter: true, professional: true, enterprise: true },
      { feature: "Team members", free: false, starter: false, professional: "3", enterprise: "Unlimited" },
      { feature: "White-label branding", free: false, starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: "Dispute Engine",
    features: [
      { feature: "Disputes per month", free: "15", starter: "75", professional: "300", enterprise: "Unlimited" },
      { feature: "Dispute Doctrine flows", free: "1", starter: "4", professional: "4", enterprise: "4" },
      { feature: "Escalation rounds", free: "3", starter: "12", professional: "12", enterprise: "12" },
      { feature: "Bulk dispute processing", free: false, starter: true, professional: true, enterprise: true },
      { feature: "e-OSCAR 29-code targeting", free: false, starter: true, professional: true, enterprise: true },
      { feature: "Metro 2 field targeting", free: false, starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: "AI Features",
    features: [
      { feature: "AMELIA AI letter generation", free: false, starter: true, professional: true, enterprise: true },
      { feature: "Soul Engine voice personalization", free: false, starter: true, professional: true, enterprise: true },
      { feature: "Frivolous detection", free: false, starter: true, professional: true, enterprise: true },
      { feature: "Credit DNA analysis", free: false, starter: true, professional: true, enterprise: true },
      { feature: "Litigation scanner", free: false, starter: false, professional: true, enterprise: true },
      { feature: "CFPB complaint drafts", free: false, starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: "Documents & Evidence",
    features: [
      { feature: "Evidence center", free: true, starter: true, professional: true, enterprise: true },
      { feature: "Canvas annotation tools", free: true, starter: true, professional: true, enterprise: true },
      { feature: "Diff engine", free: false, starter: true, professional: true, enterprise: true },
      { feature: "Auto-mailing (DocuPost/Lob)", free: false, starter: false, professional: true, enterprise: true },
    ],
  },
  {
    category: "Support",
    features: [
      { feature: "Email support", free: true, starter: true, professional: true, enterprise: true },
      { feature: "Response time", free: "48hr", starter: "24hr", professional: "4hr", enterprise: "1hr" },
      { feature: "Dedicated account manager", free: false, starter: false, professional: false, enterprise: true },
    ],
  },
];

const tierNames = ["Free", "Starter", "Professional", "Enterprise"] as const;
type TierKey = "free" | "starter" | "professional" | "enterprise";
const tierKeys: TierKey[] = ["free", "starter", "professional", "enterprise"];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="w-4 h-4 text-[#0c8ee6] mx-auto" />;
  }
  if (value === false) {
    return <Minus className="w-4 h-4 text-slate-300 mx-auto" />;
  }
  return <span className="text-sm font-medium text-slate-700">{value}</span>;
}

/* ── Page Component ───────────────────────────────────────────────── */

export default function FeaturesPage() {
  return (
    <>
      {/* SECTION 1: Hero */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-[clamp(32px,5vw,56px)] font-semibold tracking-[-0.025em] leading-[1.1] text-slate-900 max-w-[800px] mx-auto">
            Every tool you need to dominate credit repair
          </h1>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6] max-w-[680px] mx-auto">
            Eight integrated modules. One unified platform. From AI letter
            generation to litigation scanning, every feature is engineered to
            close files faster.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors"
            >
              Start free
            </Link>
            <Link
              href="/demo"
              className="border border-slate-300 text-slate-700 rounded-lg px-6 py-3 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2: Feature deep dives (alternating text + screenshot) */}
      <section className="bg-slate-50 py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 space-y-24 lg:space-y-32">
          {/* AMELIA AI — text left, image right */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
                AMELIA AI Engine&reg;
              </h2>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
                AMELIA &mdash; the Adaptive Multi-Escalation Legal Intelligence
                Agent &mdash; combines the Soul Engine&trade; for consumer voice
                personalization, the Dispute Doctrine for strategic escalation
                flows, and Frivolous Detection to armor every letter before it
                ships. She doesn&apos;t fill in blanks. She understands dispute
                law, constructs arguments the way a trained paralegal would, and
                cites the exact statutes that create legal pressure. Not just
                another template engine.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Soul Engine\u2122 voice personalization",
                  "4 strategic dispute flows with 12 rounds",
                  "Real-time frivolous detection",
                  "Dynamic legal statute sequencing",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm text-slate-600"
                  >
                    <Check className="w-4 h-4 text-[#0c8ee6] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 shadow-lg bg-white aspect-[4/3] flex items-center justify-center p-8">
              <Image
                src="/logos/amelia-orb.png"
                alt="AMELIA AI Engine"
                width={500}
                height={500}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Evidence Center — image left, text right */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 rounded-xl border border-slate-200 shadow-lg bg-white aspect-[4/3] flex items-center justify-center">
              <span className="text-sm text-slate-400">
                Evidence Center screenshot
              </span>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
                Evidence Center
              </h2>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
                Canvas editor built into every client file. Crop, annotate, box,
                circle, arrow, text — no external tools needed. Attach evidence
                directly to disputes with a single click.
              </p>
            </div>
          </div>

          {/* Diff Engine — text left, image right */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
                Diff Engine
              </h2>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
                Month-over-month credit report comparison shows exactly what
                changed — accounts added, removed, balances updated, and items
                resolved. Track your wins automatically.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 shadow-lg bg-white aspect-[4/3] flex items-center justify-center">
              <span className="text-sm text-slate-400">
                Diff Engine screenshot
              </span>
            </div>
          </div>

          {/* e-OSCAR Precision — image left, text right */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 rounded-xl border border-slate-200 shadow-lg bg-white aspect-[4/3] flex items-center justify-center">
              <span className="text-sm text-slate-400">
                e-OSCAR targeting screenshot
              </span>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
                e-OSCAR 29-Code Precision
              </h2>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
                Competitors blast 112 generic e-OSCAR codes and hope for the
                best. We use 29 verified codes that hit the bullseye every time.
                Field-level Metro 2 targeting for faster resolutions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Feature Matrix Table */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
              Compare every feature by tier
            </h2>
            <p className="mt-6 text-lg text-slate-500 max-w-[680px] mx-auto">
              From free to enterprise, see exactly what you get at every level.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700 w-[280px]">
                    Feature
                  </th>
                  {tierNames.map((tier) => (
                    <th
                      key={tier}
                      className={`px-6 py-4 text-center text-sm font-semibold ${
                        tier === "Professional"
                          ? "text-[#0c8ee6]"
                          : "text-slate-700"
                      }`}
                    >
                      {tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureCategories.map((cat) => (
                  <>
                    <tr key={cat.category} className="border-t border-slate-200">
                      <td
                        colSpan={5}
                        className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50"
                      >
                        {cat.category}
                      </td>
                    </tr>
                    {cat.features.map((feat) => (
                      <tr
                        key={feat.feature}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-3 text-sm text-slate-600">
                          {feat.feature}
                        </td>
                        {tierKeys.map((key) => (
                          <td key={key} className="px-6 py-3 text-center">
                            <CellValue value={feat[key]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-8">
            {tierNames.map((tierName, tierIdx) => {
              const tierKey = tierKeys[tierIdx];
              return (
                <div
                  key={tierName}
                  className={`rounded-xl border overflow-hidden ${
                    tierName === "Professional"
                      ? "border-2 border-[#0c8ee6]"
                      : "border-slate-200"
                  }`}
                >
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h3 className={`text-lg font-semibold ${tierName === "Professional" ? "text-[#0c8ee6]" : "text-slate-900"}`}>
                      {tierName}
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {featureCategories.map((cat) => (
                      <div key={cat.category} className="px-6 py-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                          {cat.category}
                        </div>
                        <div className="space-y-2.5">
                          {cat.features.map((feat) => (
                            <div
                              key={feat.feature}
                              className="flex items-center justify-between"
                            >
                              <span className="text-sm text-slate-600">
                                {feat.feature}
                              </span>
                              <CellValue value={feat[tierKey]} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 4: CTA */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
            See these features in action
          </h2>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
            Every feature above is included in your free account. No credit
            card. No time limit. Upgrade when you&apos;re ready to scale.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors"
            >
              Start your free account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

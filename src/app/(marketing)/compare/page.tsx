import { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { COMPARISON_CATEGORIES } from "@/lib/marketing-data";

export const metadata: Metadata = {
  title: "Compare Dispute2Go vs Competitors | Credit Repair Software Comparison",
  description:
    "See how Dispute2Go compares to Credit Repair Cloud, DisputeFox, DisputeBeast, and CreditFixrr. AI-powered dispute letters, legal strategy, and 45 clients/hour processing.",
  keywords: [
    "credit repair software comparison",
    "Dispute2Go vs Credit Repair Cloud",
    "DisputeFox alternative",
    "DisputeBeast alternative",
    "best credit repair software",
    "AI credit repair",
  ],
};

const COMPETITOR_KEYS = [
  "CRC",
  "DisputeFox",
  "DisputeBeast",
  "CreditFixrr",
] as const;

function CellValue({
  value,
  isD2g = false,
}: {
  value: boolean | string;
  isD2g?: boolean;
}) {
  if (value === true) {
    return <Check className={`w-4 h-4 mx-auto ${isD2g ? "text-[#0c8ee6]" : "text-slate-400"}`} />;
  }
  if (value === false) {
    return <span className="text-slate-300 text-center block">&mdash;</span>;
  }
  if (value === "Partial") {
    return <span className="text-sm text-slate-400">Partial</span>;
  }
  return (
    <span className={`text-sm font-medium ${isD2g ? "text-[#0c8ee6]" : "text-slate-600"}`}>
      {value}
    </span>
  );
}

export default function ComparePage() {
  return (
    <>
      {/* SECTION 1: HERO */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-[clamp(32px,5vw,56px)] font-semibold tracking-[-0.025em] leading-[1.1] text-slate-900">
            You deserve better than templates from 2015
          </h1>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
            See how real AI strategy compares to the tools you&apos;re using
            today.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors"
            >
              Start free today
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

      {/* SECTION 2: COMPARISON TABLE */}
      <section className="bg-slate-50 py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
              Feature-by-feature comparison
            </h2>
            <p className="mt-6 text-lg text-slate-500 max-w-[680px] mx-auto">
              See exactly where Dispute2Go outperforms every competitor across
              every category that matters.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-sm font-semibold text-slate-700 py-4 px-4 w-[220px]">
                    Feature
                  </th>
                  <th className="text-center text-sm font-semibold py-4 px-3 text-[#0c8ee6] w-[120px]">
                    Dispute2Go
                  </th>
                  {COMPETITOR_KEYS.map((key) => (
                    <th
                      key={key}
                      className="text-center text-sm font-semibold text-slate-500 py-4 px-3 w-[120px]"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_CATEGORIES.map((cat) => (
                  <>
                    <tr
                      key={`cat-${cat.category}`}
                      className="border-t border-slate-200"
                    >
                      <td
                        colSpan={6}
                        className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50"
                      >
                        {cat.category}
                      </td>
                    </tr>
                    {cat.features.map((feature) => (
                      <tr
                        key={feature.name}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-slate-700">
                          {feature.name}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <CellValue value={feature.d2g} isD2g />
                        </td>
                        {COMPETITOR_KEYS.map((key) => (
                          <td key={key} className="py-3 px-3 text-center">
                            <CellValue
                              value={
                                (
                                  feature.competitors as Record<
                                    string,
                                    boolean | string
                                  >
                                )[key]
                              }
                            />
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
            {COMPARISON_CATEGORIES.map((cat) => (
              <div
                key={cat.category}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {cat.category}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {cat.features.map((feature) => (
                    <div key={feature.name} className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-900 mb-2">
                        {feature.name}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-slate-50 py-1.5 px-1">
                          <p className="text-[10px] uppercase tracking-wider text-[#0c8ee6] font-semibold mb-0.5">
                            D2G
                          </p>
                          <CellValue value={feature.d2g} isD2g />
                        </div>
                        {COMPETITOR_KEYS.slice(0, 2).map((key) => (
                          <div
                            key={key}
                            className="rounded-lg bg-slate-50 py-1.5 px-1"
                          >
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">
                              {key}
                            </p>
                            <CellValue
                              value={
                                (
                                  feature.competitors as Record<
                                    string,
                                    boolean | string
                                  >
                                )[key]
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: CTA */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
            Ready to switch?
          </h2>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
            Join thousands of credit repair specialists who upgraded from
            templates to AI.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors inline-flex items-center gap-2"
            >
              Start your free account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#0c8ee6]" />
              Free migration support
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#0c8ee6]" />
              Import from any platform
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#0c8ee6]" />
              No credit card required
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

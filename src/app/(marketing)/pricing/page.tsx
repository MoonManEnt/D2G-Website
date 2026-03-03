import { Metadata } from "next";
import Link from "next/link";
import { PRICING_TIERS, PRICING_FAQ } from "@/lib/marketing-data";
import { Check, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing | Dispute2Go — Simple Pricing. Serious Power.",
  description:
    "Start free with 5 clients. Scale to Professional at $99/mo with AMELIA AI, Litigation Scanner, and auto-mailing. Save 20% with annual billing.",
  keywords: [
    "credit repair software pricing",
    "dispute2go plans",
    "credit repair pricing",
    "AMELIA AI cost",
    "credit dispute software free",
  ],
  openGraph: {
    title: "Pricing | Dispute2Go",
    description:
      "Simple pricing, serious power. Start free and scale as you grow. Professional plan at $99/mo with full AI capabilities.",
  },
};

export default function PricingPage() {
  return (
    <>
      {/* SECTION 1: PRICING HERO */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-[clamp(32px,5vw,56px)] font-semibold tracking-[-0.025em] leading-[1.1] text-slate-900">
            Simple pricing. Serious power.
          </h1>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
            Start free. Scale when you&apos;re ready. Every plan includes the
            tools that make Dispute2Go the most advanced credit dispute platform
            on the market.
          </p>
        </div>
      </section>

      {/* SECTION 2: PRICING CARDS */}
      <section className="bg-slate-50 py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative bg-white rounded-xl p-6 flex flex-col ${
                  tier.highlight
                    ? "border-2 border-[#0c8ee6] shadow-lg"
                    : "border border-slate-200"
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium bg-[#0c8ee6] text-white whitespace-nowrap">
                    {tier.badge}
                  </span>
                )}

                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  {tier.name}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  {tier.description}
                </p>

                <div className="mb-6">
                  {tier.price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-semibold text-slate-900">
                        ${tier.price}
                      </span>
                      {tier.price > 0 && (
                        <span className="text-sm text-slate-500">/mo</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-4xl font-semibold text-slate-900">
                      Custom
                    </span>
                  )}
                  {tier.price === 0 && (
                    <div className="mt-1 text-xs text-slate-500">
                      Free forever
                    </div>
                  )}
                </div>

                <Link
                  href={tier.name === "Enterprise" ? "/demo" : "/register"}
                  className={`w-full text-center rounded-lg px-6 py-3 text-sm font-medium transition-colors mb-6 block ${
                    tier.highlight
                      ? "bg-[#0c8ee6] text-white hover:bg-[#0a7fd0]"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tier.cta}
                </Link>

                <ul className="space-y-2.5 flex-1">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Check className="w-4 h-4 text-[#0c8ee6] shrink-0 mt-0.5" />
                      <span className="text-slate-500">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: FAQ */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8">
          <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900 text-center mb-16">
            Frequently asked questions
          </h2>

          <div className="space-y-8">
            {PRICING_FAQ.map((faq) => (
              <div key={faq.question}>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  {faq.question}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: CTA */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
            Ready to get started?
          </h2>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
            Join thousands of credit repair specialists who stopped writing
            generic templates and started closing files with AI.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors inline-flex items-center gap-2"
            >
              Start your free account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

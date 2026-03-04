import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { STATS, TESTIMONIALS } from "@/lib/marketing-data";

export default function MarketingHomePage() {
  return (
    <>
      {/* ─── SECTION 1: HERO ─── */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <h1 className="text-[clamp(32px,5vw,56px)] font-semibold tracking-[-0.025em] leading-[1.1] text-slate-900">
                Stop writing letters.
                <br />
                Start closing files.
              </h1>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6] max-w-[520px]">
                AMELIA AI generates human-voice dispute letters with legal
                statute sequencing. Process 45 clients per hour — not 100 per
                week.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
                <Link
                  href="/register"
                  className="bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors"
                >
                  Start free
                </Link>
                <Link
                  href="/demo"
                  className="text-[#0c8ee6] text-sm font-medium flex items-center gap-1.5 py-3"
                >
                  Book a demo <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="mt-8 text-sm text-slate-500">
                Trusted by 500+ credit repair specialists
              </p>
            </div>

            {/* Right: Product screenshot */}
            <div className="rounded-xl border border-slate-200 shadow-lg overflow-hidden">
              <Image
                src="/logos/hero-dashboard.png"
                alt="Dispute2Go Dashboard"
                width={814}
                height={592}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: STATS ─── */}
      <section className="bg-slate-50 py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
                  {stat.value}
                  {stat.suffix}
                </div>
                <p className="mt-2 text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: FEATURES (alternating text + image) ─── */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 space-y-24 lg:space-y-32">
          {/* Feature 1: AMELIA AI Engine — text left, image right */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h3 className="text-2xl font-semibold leading-[1.3] text-slate-900">
                AMELIA AI Engine
              </h3>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
                Not just another template engine. AMELIA thinks like a
                paralegal, writes like a human, and cites like an attorney. The
                Soul Engine infers consumer voice based on age, emotional state,
                and geography — every letter sounds authentically written.
              </p>
              <Link
                href="/features"
                className="mt-6 inline-flex items-center gap-1.5 text-[#0c8ee6] text-sm font-medium"
              >
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="rounded-xl border border-slate-200 shadow-lg bg-slate-50 overflow-hidden">
              <Image
                src="/logos/amelia-engine.svg"
                alt="AMELIA AI Engine"
                width={600}
                height={450}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Feature 2: Evidence Center — image left, text right */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 rounded-xl border border-slate-200 shadow-lg bg-slate-50 aspect-[4/3] flex items-center justify-center">
              <span className="text-sm text-slate-400">
                Evidence Center screenshot
              </span>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-2xl font-semibold leading-[1.3] text-slate-900">
                Evidence Center
              </h3>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
                Crop, annotate, and attach evidence directly from credit reports
                with our canvas editor. Box, circle, arrow, and text tools built
                in — no external software needed.
              </p>
              <Link
                href="/features"
                className="mt-6 inline-flex items-center gap-1.5 text-[#0c8ee6] text-sm font-medium"
              >
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Feature 3: Diff Engine — text left, image right */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h3 className="text-2xl font-semibold leading-[1.3] text-slate-900">
                Diff Engine
              </h3>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
                Month-over-month credit report comparison shows exactly what
                changed — accounts added, removed, balances updated, and items
                resolved. Track your wins automatically.
              </p>
              <Link
                href="/features"
                className="mt-6 inline-flex items-center gap-1.5 text-[#0c8ee6] text-sm font-medium"
              >
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="rounded-xl border border-slate-200 shadow-lg bg-slate-50 aspect-[4/3] flex items-center justify-center">
              <span className="text-sm text-slate-400">
                Diff Engine screenshot
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: SOCIAL PROOF (single testimonial) ─── */}
      <section className="bg-slate-50 py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <p className="text-2xl italic leading-[1.5] text-slate-700">
            &ldquo;{TESTIMONIALS[0].quote}&rdquo;
          </p>
          <p className="mt-8 text-sm font-semibold text-slate-900">
            {TESTIMONIALS[0].name}
          </p>
          <p className="text-sm text-slate-500">
            {TESTIMONIALS[0].role}, {TESTIMONIALS[0].company}
          </p>
        </div>
      </section>

      {/* ─── SECTION 5: CTA ─── */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
            Your clients deserve better dispute letters.
          </h2>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
            Join thousands of credit repair specialists who upgraded from
            templates to AI.
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

import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About Dispute2Go | Our Mission to Transform Credit Repair",
  description:
    "Learn about the team behind Dispute2Go, our mission to democratize credit repair technology, and why we built AMELIA AI to replace outdated templates.",
  keywords: [
    "about Dispute2Go",
    "credit repair mission",
    "AMELIA AI",
    "credit repair technology",
    "credit repair innovation",
  ],
};

export default function AboutPage() {
  return (
    <>
      {/* SECTION 1: HERO */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <h1 className="text-[clamp(32px,5vw,56px)] font-semibold tracking-[-0.025em] leading-[1.1] text-slate-900">
            We&apos;re building the future of credit repair
          </h1>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
            We believe every credit repair specialist deserves intelligent tools,
            not recycled templates. That belief became Dispute2Go.
          </p>
        </div>
      </section>

      {/* SECTION 2: ORIGIN STORY */}
      <section className="bg-slate-50 py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
            {/* The Problem */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-2xl font-semibold leading-[1.3] text-slate-900 mb-4">
                The problem we saw
              </h2>
              <p className="text-lg text-slate-500 leading-[1.6]">
                Credit repair specialists were stuck with template libraries that
                bureaus had seen thousands of times. Average deletion rates
                hovered around 35%. Manual tracking ate up hours that should have
                been spent growing businesses.
              </p>
            </div>

            {/* The Solution */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <h2 className="text-2xl font-semibold leading-[1.3] text-slate-900 mb-4">
                The solution we built
              </h2>
              <p className="text-lg text-slate-500 leading-[1.6] mb-4">
                We built AMELIA &mdash; an Adaptive Multi-Escalation Legal
                Intelligence Agent that thinks like a paralegal. She generates
                human-voice dispute letters with legal statute sequencing,
                adjusting strategy across up to 12 escalation rounds.
              </p>
              <p className="text-base font-semibold text-slate-900">
                Not just another template engine. An operating system for modern
                credit repair.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: STATS */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: "10,000+", label: "Disputes Processed" },
              { value: "72%", label: "Avg Deletion Rate" },
              { value: "45", label: "Clients Per Hour" },
              { value: "4.9/5", label: "User Satisfaction" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
                  {stat.value}
                </div>
                <p className="mt-2 text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: CTA */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900">
            Join the credit repair revolution
          </h2>
          <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
            Start with a free account and experience the difference AI makes.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors inline-flex items-center gap-2"
            >
              Start free today <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

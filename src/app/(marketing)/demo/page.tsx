import { Metadata } from "next";
import Link from "next/link";
import {
  Brain,
  Crop,
  DollarSign,
  Star,
  Clock,
  Users,
  MessageSquare,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Book a Demo | See Dispute2Go & AMELIA AI in Action",
  description:
    "Schedule a live demo of Dispute2Go's AI-powered credit repair platform. See AMELIA generate dispute letters, explore the Evidence Center, and get custom pricing.",
  keywords: [
    "Dispute2Go demo",
    "credit repair software demo",
    "AMELIA AI demo",
    "credit repair pricing",
    "book demo credit repair",
  ],
};

export default function DemoPage() {
  return (
    <>
      {/* SECTION 1: Hero + Form (two-column) */}
      <section className="bg-white py-24 lg:py-[120px]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="grid items-start gap-16 lg:grid-cols-2">
            {/* Left: Benefits */}
            <div>
              <h1 className="text-[clamp(32px,5vw,56px)] font-semibold tracking-[-0.025em] leading-[1.1] text-slate-900">
                See the future of credit repair in action
              </h1>
              <p className="mt-6 text-lg text-slate-500 leading-[1.6]">
                Get a personalized walkthrough of AMELIA AI, the Evidence
                Center, and every feature that makes Dispute2Go the most
                advanced credit dispute platform.
              </p>

              <div className="mt-10 space-y-8">
                <div className="flex gap-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <Brain className="h-5 w-5 text-[#0c8ee6]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Live AMELIA AI Demo
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      Watch AMELIA generate a real dispute letter in real-time
                      with voice personalization and legal statute sequencing.
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <Crop className="h-5 w-5 text-[#0c8ee6]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Evidence Center Walkthrough
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      Experience our canvas-based evidence editor with crop,
                      annotate, and annotation tools built in.
                    </p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <DollarSign className="h-5 w-5 text-[#0c8ee6]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Custom Pricing Consultation
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      Get a tailored pricing recommendation based on your client
                      volume and business goals.
                    </p>
                  </div>
                </div>
              </div>

              {/* Testimonial */}
              <div className="mt-12 border-t border-slate-200 pt-8">
                <div className="mb-3 flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-slate-900 text-slate-900"
                    />
                  ))}
                </div>
                <blockquote className="text-sm italic text-slate-500 leading-relaxed">
                  &ldquo;I switched from Credit Repair Cloud and my processing
                  time dropped by 80%.&rdquo;
                </blockquote>
                <p className="mt-3 text-sm font-medium text-slate-900">
                  Marcus Johnson,{" "}
                  <span className="text-slate-500">
                    Founder at ClearPath Credit Solutions
                  </span>
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-8">
              <h3 className="text-xl font-semibold text-slate-900">
                Request your personalized demo
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Fill out the form below and we&apos;ll schedule a time that
                works for you.
              </p>

              <form className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-1.5 block text-sm font-medium text-slate-900"
                  >
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    placeholder="John Doe"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c8ee6]/50 focus:border-[#0c8ee6]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-slate-900"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="john@company.com"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c8ee6]/50 focus:border-[#0c8ee6]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="company"
                    className="mb-1.5 block text-sm font-medium text-slate-900"
                  >
                    Company Name
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    required
                    placeholder="ClearPath Credit Solutions"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c8ee6]/50 focus:border-[#0c8ee6]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="currentSoftware"
                    className="mb-1.5 block text-sm font-medium text-slate-900"
                  >
                    Current Software
                  </label>
                  <select
                    id="currentSoftware"
                    name="currentSoftware"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0c8ee6]/50 focus:border-[#0c8ee6]"
                  >
                    <option value="">Select your current software</option>
                    <option value="none">None</option>
                    <option value="credit-repair-cloud">
                      Credit Repair Cloud
                    </option>
                    <option value="disputefox">DisputeFox</option>
                    <option value="disputebeast">DisputeBeast</option>
                    <option value="creditfixrr">CreditFixrr</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="activeClients"
                    className="mb-1.5 block text-sm font-medium text-slate-900"
                  >
                    Number of Active Clients
                  </label>
                  <input
                    id="activeClients"
                    name="activeClients"
                    type="text"
                    placeholder="e.g. 50"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c8ee6]/50 focus:border-[#0c8ee6]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="mb-1.5 block text-sm font-medium text-slate-900"
                  >
                    Message{" "}
                    <span className="text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Any specific questions or areas you'd like covered?"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c8ee6]/50 focus:border-[#0c8ee6]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors"
                >
                  Request your demo
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-slate-400">
                We&apos;ll respond within 24 hours to schedule your personalized
                demo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FAQ */}
      <section className="bg-slate-50 py-24 lg:py-[120px]">
        <div className="max-w-[680px] mx-auto px-6 lg:px-8">
          <h2 className="text-[40px] font-semibold tracking-[-0.02em] leading-[1.2] text-slate-900 text-center mb-16">
            Before your demo
          </h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-3">
                <Clock className="h-5 w-5 shrink-0 text-[#0c8ee6]" />
                How long is the demo?
              </h3>
              <p className="pl-8 text-sm text-slate-500 leading-relaxed">
                Typically 25-30 minutes, depending on your questions. We respect
                your time and keep it focused.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-3">
                <Users className="h-5 w-5 shrink-0 text-[#0c8ee6]" />
                Is the demo personalized to my business?
              </h3>
              <p className="pl-8 text-sm text-slate-500 leading-relaxed">
                Yes. We tailor the walkthrough to your specific workflow, client
                volume, and pain points.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-3">
                <MessageSquare className="h-5 w-5 shrink-0 text-[#0c8ee6]" />
                Do I need to prepare anything?
              </h3>
              <p className="pl-8 text-sm text-slate-500 leading-relaxed">
                Nothing required. Just bring your questions. If you want us to
                analyze your current workflow, have your existing software open.
              </p>
            </div>
          </div>

          <p className="mt-12 text-center text-sm text-slate-500">
            Have more questions? Email us at{" "}
            <a
              href="mailto:support@dispute2go.com"
              className="font-medium text-[#0c8ee6] hover:underline"
            >
              support@dispute2go.com
            </a>
          </p>
        </div>
      </section>
    </>
  );
}

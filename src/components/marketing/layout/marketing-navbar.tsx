"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/lib/marketing-data";
import { Menu, X } from "lucide-react";

export function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white",
          scrolled && "shadow-sm border-b border-slate-200"
        )}
      >
        <nav className="max-w-[1200px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logos/d2g-logo.svg"
              alt="Dispute2Go"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="font-semibold text-lg text-slate-900 hidden sm:inline">
              Dispute2Go
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#0c8ee6] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-[#0c8ee6] transition-colors px-4 py-2"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="bg-[#0c8ee6] text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-[#0a7fd0] transition-colors"
            >
              Get started
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-slate-900"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </nav>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-white lg:hidden">
          <nav className="flex flex-col items-center justify-center h-full gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-semibold text-slate-900 hover:text-[#0c8ee6] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 mt-6 w-64">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center border border-slate-300 text-slate-700 rounded-lg px-6 py-3 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center bg-[#0c8ee6] text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-[#0a7fd0] transition-colors"
              >
                Get started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

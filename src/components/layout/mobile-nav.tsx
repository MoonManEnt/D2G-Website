"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, FileText, Camera, BarChart3, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PRIMARY_TABS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/clients", icon: Users, label: "Clients" },
  { href: "/disputes", icon: FileText, label: "Disputes" },
  { href: "/evidence", icon: Camera, label: "Evidence" },
];

const MORE_TABS = [
  { href: "/responses", label: "Responses" },
  { href: "/sentry", label: "Sentry" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Billing" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setShowMore(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-20 left-4 right-4 bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {MORE_TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setShowMore(false)}
                  className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname.startsWith(tab.href)
                      ? "bg-purple-500/20 text-purple-300"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50 safe-area-bottom"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around px-2 py-1">
          {PRIMARY_TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-3 py-2 rounded-xl transition-colors ${
                  isActive
                    ? "text-purple-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <tab.icon className={`w-5 h-5 ${isActive ? "text-purple-400" : ""}`} />
                <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-purple-400" />
                )}
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-3 py-2 rounded-xl transition-colors ${
              showMore ? "text-purple-400" : "text-slate-400 hover:text-slate-200"
            }`}
            aria-label="More navigation options"
            aria-expanded={showMore}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

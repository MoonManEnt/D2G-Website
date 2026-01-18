"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  FileText,
  FileStack,
  Scale,
  Image,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Ledger", href: "/ledger", icon: FileStack },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Disputes", href: "/disputes", icon: Scale },
  { name: "Evidence", href: "/evidence", icon: Image },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Billing", href: "/billing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 bg-background border-b">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">D2</span>
          </div>
          <span className="font-semibold text-lg">Dispute2Go</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background pt-16">
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
            <hr className="my-4" />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:border-r lg:bg-background">
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-6 border-b">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white font-bold">D2</span>
          </div>
          <div>
            <span className="font-semibold text-lg">Dispute2Go</span>
            <p className="text-xs text-muted-foreground">Specialist Portal</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary border-r-2 border-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
                {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium">
                {session?.user?.name?.charAt(0) || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session?.user?.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {session?.user?.organizationName || "Organization"}
              </p>
            </div>
            <Badge
              variant={session?.user?.subscriptionTier === "PRO" ? "default" : "secondary"}
              className="text-xs"
            >
              {session?.user?.subscriptionTier || "FREE"}
            </Badge>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start mt-2 text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </>
  );
}

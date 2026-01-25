"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Scale,
  Image,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
  ChevronRight,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useBrandingOptional } from "@/components/branding";
import { Avatar } from "@/components/profile";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Disputes", href: "/disputes", icon: Scale },
  { name: "Evidence", href: "/evidence", icon: Image },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Billing", href: "/billing", icon: CreditCard },
];

const navItemVariants = {
  initial: { opacity: 0, x: -10 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  }),
  hover: {
    x: 4,
    transition: { duration: 0.2 },
  },
};

const mobileMenuVariants = {
  closed: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
    },
  },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const mobileItemVariants = {
  closed: { opacity: 0, x: -20 },
  open: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 },
  },
};

interface SidebarProps {
  user: {
    name: string;
    organizationName: string;
    subscriptionTier: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const brandingContext = useBrandingOptional();
  const branding = brandingContext?.branding;

  // Fetch profile picture
  useEffect(() => {
    async function fetchProfilePicture() {
      try {
        const response = await fetch("/api/user/profile-picture");
        if (response.ok) {
          const data = await response.json();
          setProfilePicture(data.profilePicture);
        }
      } catch (error) {
        console.error("Failed to fetch profile picture:", error);
      }
    }
    fetchProfilePicture();
  }, []);

  // Dynamic styles based on branding
  const sidebarStyle = branding
    ? {
      backgroundColor: branding.sidebarBgColor,
      "--sidebar-text": branding.sidebarTextColor,
      "--sidebar-active": branding.sidebarActiveColor,
    } as React.CSSProperties
    : {};

  const logoStyle = branding?.primaryColor
    ? { backgroundColor: branding.primaryColor }
    : {};

  // Logo display logic
  const LogoDisplay = () => {
    if (branding?.logoUrl) {
      return (
        <img
          src={branding.logoUrl}
          alt="Logo"
          className="h-8 max-w-[120px] object-contain"
        />
      );
    }
    return (
      <>
        <motion.div
          className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center"
          style={logoStyle}
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
        >
          {branding?.logoText ? (
            <Sparkles className="w-5 h-5 text-white" />
          ) : (
            <span className="text-white font-bold">D2</span>
          )}
        </motion.div>
        <div>
          <span className="font-semibold text-lg" style={branding ? { color: branding.sidebarTextColor } : {}}>
            {branding?.logoText || "Dispute2Go"}
          </span>
          <p className="text-xs text-muted-foreground">Specialist Portal</p>
        </div>
      </>
    );
  };

  return (
    <>
      {/* Mobile menu button */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 bg-background border-b"
        style={sidebarStyle}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="h-8 max-w-[120px] object-contain"
            />
          ) : (
            <>
              <motion.div
                className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center"
                style={logoStyle}
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-white font-bold text-sm">
                  {branding?.logoText ? branding.logoText.charAt(0) : "D2"}
                </span>
              </motion.div>
              <span className="font-semibold text-lg" style={branding ? { color: branding.sidebarTextColor } : {}}>
                {branding?.logoText || "Dispute2Go"}
              </span>
            </>
          )}
        </Link>
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <AnimatePresence mode="wait">
              {mobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="h-6 w-6" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Menu className="h-6 w-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 z-40 pt-16"
            style={{ backgroundColor: branding?.sidebarBgColor || "#0f172a" }}
            initial="closed"
            animate="open"
            exit="closed"
            variants={mobileMenuVariants}
          >
            <nav className="p-4 space-y-2">
              {navigation.map((item, i) => {
                const isActive = pathname.startsWith(item.href);
                const activeColor = branding?.sidebarActiveColor || "#3b82f6";
                const textColor = branding?.sidebarTextColor || "#94a3b8";
                return (
                  <motion.div key={item.name} variants={mobileItemVariants} custom={i}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                      style={
                        isActive
                          ? {
                            backgroundColor: `${activeColor}20`,
                            color: activeColor,
                          }
                          : {
                            color: textColor,
                          }
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                      {isActive && (
                        <motion.div
                          className="ml-auto"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500 }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </motion.div>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
              <motion.hr className="my-4 border-slate-700" variants={mobileItemVariants} />
              <motion.div variants={mobileItemVariants}>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium w-full"
                  style={{ color: branding?.sidebarTextColor || "#94a3b8" }}
                >
                  <LogOut className="h-5 w-5" />
                  Sign Out
                </button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:border-r lg:bg-background"
        style={sidebarStyle}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-6 border-b border-slate-700/50">
          <LogoDisplay />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item, i) => {
            const isActive = pathname.startsWith(item.href);
            const activeColor = branding?.sidebarActiveColor || "#3b82f6";
            const textColor = branding?.sidebarTextColor || "#94a3b8";

            return (
              <motion.div
                key={item.name}
                initial="initial"
                animate="animate"
                whileHover="hover"
                variants={navItemVariants}
                custom={i}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative"
                  style={
                    isActive
                      ? {
                        backgroundColor: `${activeColor}20`,
                        color: activeColor,
                      }
                      : {
                        color: textColor,
                      }
                  }
                >
                  <motion.div
                    whileHover={{ rotate: isActive ? 0 : 10 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <item.icon className="h-5 w-5" />
                  </motion.div>
                  {item.name}
                  {isActive && (
                    <>
                      <motion.div
                        className="absolute right-0 top-0 bottom-0 w-0.5 rounded-full"
                        style={{ backgroundColor: activeColor }}
                        layoutId="activeIndicator"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                      <motion.div
                        className="ml-auto"
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500 }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </motion.div>
                    </>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* User section */}
        <motion.div
          className="p-4 border-t border-slate-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar
              src={profilePicture}
              name={user?.name}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={branding ? { color: branding.sidebarTextColor } : {}}>
                {user?.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.organizationName || "Organization"}
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Badge
                variant={user?.subscriptionTier === "PRO" ? "default" : "secondary"}
                className="text-xs"
              >
                {user?.subscriptionTier || "FREE"}
              </Badge>
            </motion.div>
          </div>
          <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="ghost"
              className="w-full justify-start mt-2 text-muted-foreground"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}

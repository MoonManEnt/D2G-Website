"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Scale,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
  ChevronRight,
  BarChart3,
  Sparkles,
  Search,
  GripVertical,
  Gavel,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback, useRef } from "react";
import { useBrandingOptional } from "@/components/branding";
import { Avatar } from "@/components/profile";
import { createLogger } from "@/lib/logger";
const log = createLogger("sidebar");

// Sidebar width boundaries
const MIN_WIDTH = 72;
const MAX_WIDTH = 256;
const COLLAPSE_THRESHOLD = 100;

const navigation: { name: string; href: string; icon: typeof LayoutDashboard; tourId?: string }[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tourId: "dashboard" },
  { name: "Clients", href: "/clients", icon: Users, tourId: "clients" },
  { name: "Disputes", href: "/disputes", icon: Scale, tourId: "disputes" },
  { name: "Analytics & Reporting", href: "/analytics", icon: BarChart3, tourId: "analytics" },
  { name: "Litigation", href: "/litigation", icon: Gavel, tourId: "litigation" },
  { name: "Feedback", href: "/feedback", icon: MessageSquarePlus },
  { name: "Settings", href: "/settings", icon: Settings, tourId: "settings" },
  { name: "Billing", href: "/billing", icon: CreditCard, tourId: "billing" },
];

// Icon-specific hover animations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconAnimations: Record<string, any> = {
  Settings: {
    rotate: 360,
    transition: { duration: 0.8, ease: "easeInOut" },
  },
  Dashboard: {
    scale: [1, 1.15, 1],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
  Clients: {
    y: [0, -3, 0],
    transition: { duration: 0.4, ease: "easeInOut" },
  },
  Disputes: {
    rotate: [0, -10, 10, 0],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
  "Analytics & Reporting": {
    scaleY: [1, 1.2, 1],
    transition: { duration: 0.4, ease: "easeInOut" },
  },
  Litigation: {
    rotate: [0, -15, 15, 0],
    scale: [1, 1.15, 1],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
  Feedback: {
    scale: [1, 1.2, 1],
    rotate: [0, 10, -10, 0],
    transition: { duration: 0.5, ease: "easeInOut" },
  },
  Billing: {
    rotateY: 180,
    transition: { duration: 0.5, ease: "easeInOut" },
  },
};

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

// Cybernetic Subscription Badge Component
function SubscriptionBadge({ tier, isCollapsed }: { tier: string; isCollapsed: boolean }) {
  const isPro = tier === "PROFESSIONAL" || tier === "PRO";
  const isEnterprise = tier === "ENTERPRISE";
  const isFree = tier === "FREE" || !tier;

  // Different configs based on tier
  const config = {
    FREE: {
      label: "FREE",
      shortLabel: "F",
      bgClass: "bg-zinc-800/80",
      borderClass: "border-zinc-600/50",
      textClass: "text-zinc-400",
      glowColor: "rgba(113, 113, 122, 0.3)",
    },
    PRO: {
      label: "PRO",
      shortLabel: "P",
      bgClass: "bg-gradient-to-r from-cyan-950 via-purple-950 to-cyan-950",
      borderClass: "border-cyan-500/50",
      textClass: "text-cyan-400",
      glowColor: "rgba(34, 211, 238, 0.6)",
    },
    ENTERPRISE: {
      label: "ENT",
      shortLabel: "E",
      bgClass: "bg-gradient-to-r from-amber-950 via-yellow-950 to-amber-950",
      borderClass: "border-amber-500/50",
      textClass: "text-amber-400",
      glowColor: "rgba(251, 191, 36, 0.6)",
    },
  };

  const currentConfig = isEnterprise ? config.ENTERPRISE : isPro ? config.PRO : config.FREE;

  if (isFree) {
    // Simple badge for free tier
    return (
      <div className={cn("w-full flex", isCollapsed ? "justify-center" : "justify-start")}>
        <div className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium",
          currentConfig.bgClass,
          currentConfig.textClass,
          "border",
          currentConfig.borderClass
        )}>
          {isCollapsed ? currentConfig.shortLabel : currentConfig.label}
        </div>
      </div>
    );
  }

  // Cybernetic PRO/Enterprise badge
  return (
    <div className={cn("w-full flex", isCollapsed ? "justify-center" : "justify-start")}>
      <motion.div
        className="relative"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Outer glow pulse */}
        <motion.div
          className="absolute -inset-1 rounded-lg opacity-75 blur-sm"
          style={{
            background: isPro
              ? "linear-gradient(90deg, #06b6d4, #8b5cf6, #06b6d4)"
              : "linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)",
          }}
          animate={{
            opacity: [0.4, 0.8, 0.4],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Main badge container */}
        <div className={cn(
          "relative overflow-hidden rounded-lg border",
          currentConfig.borderClass,
          isCollapsed ? "px-2 py-1.5" : "px-4 py-2"
        )}>
          {/* Animated background */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: isPro
                ? "linear-gradient(135deg, #0c4a6e 0%, #1e1b4b 50%, #0c4a6e 100%)"
                : "linear-gradient(135deg, #451a03 0%, #422006 50%, #451a03 100%)",
            }}
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* Scan line effect */}
          <motion.div
            className="absolute inset-0 overflow-hidden"
            style={{ opacity: 0.1 }}
          >
            <motion.div
              className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-white to-transparent"
              animate={{
                top: ["-10%", "110%"],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </motion.div>

          {/* Circuit pattern overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10h20M10 0v20' stroke='%23fff' stroke-width='0.5' fill='none'/%3E%3Ccircle cx='10' cy='10' r='1' fill='%23fff'/%3E%3C/svg%3E")`,
              backgroundSize: "10px 10px",
            }}
          />

          {/* Content */}
          <div className="relative flex items-center gap-2">
            {/* Pulsing dot indicator */}
            <motion.div
              className={cn(
                "w-2 h-2 rounded-full",
                isPro ? "bg-cyan-400" : "bg-amber-400"
              )}
              animate={{
                boxShadow: [
                  `0 0 4px 0px ${currentConfig.glowColor}`,
                  `0 0 8px 2px ${currentConfig.glowColor}`,
                  `0 0 4px 0px ${currentConfig.glowColor}`,
                ],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {!isCollapsed && (
              <motion.span
                className={cn(
                  "font-bold tracking-widest text-sm",
                  currentConfig.textClass
                )}
                animate={{
                  textShadow: [
                    `0 0 4px ${currentConfig.glowColor}`,
                    `0 0 12px ${currentConfig.glowColor}`,
                    `0 0 4px ${currentConfig.glowColor}`,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {currentConfig.label}
              </motion.span>
            )}
          </div>

          {/* Corner accents */}
          <div className={cn(
            "absolute top-0 left-0 w-2 h-2 border-t border-l",
            isPro ? "border-cyan-400/60" : "border-amber-400/60"
          )} />
          <div className={cn(
            "absolute top-0 right-0 w-2 h-2 border-t border-r",
            isPro ? "border-cyan-400/60" : "border-amber-400/60"
          )} />
          <div className={cn(
            "absolute bottom-0 left-0 w-2 h-2 border-b border-l",
            isPro ? "border-cyan-400/60" : "border-amber-400/60"
          )} />
          <div className={cn(
            "absolute bottom-0 right-0 w-2 h-2 border-b border-r",
            isPro ? "border-cyan-400/60" : "border-amber-400/60"
          )} />
        </div>
      </motion.div>
    </div>
  );
}

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

  // Sidebar width state with localStorage persistence
  const [sidebarWidth, setSidebarWidth] = useState(MAX_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const isCollapsed = sidebarWidth <= COLLAPSE_THRESHOLD;

  // Load saved width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem("dispute2go-sidebar-width");
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
        setSidebarWidth(width);
      }
    }
  }, []);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem("dispute2go-sidebar-width", sidebarWidth.toString());
    }
  }, [sidebarWidth, isResizing]);

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
        log.error({ err: error }, "Failed to fetch profile picture");
      }
    }
    fetchProfilePicture();
  }, []);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));

      // Snap to boundaries
      if (newWidth <= COLLAPSE_THRESHOLD) {
        setSidebarWidth(MIN_WIDTH);
      } else if (newWidth >= MAX_WIDTH - 20) {
        setSidebarWidth(MAX_WIDTH);
      } else {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Handle icon hover with delay for animation trigger
  const handleIconHover = (iconName: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredIcon(iconName);
    }, 300);
  };

  const handleIconLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredIcon(null);
  };

  // Toggle collapse/expand on double-click
  const handleDoubleClick = () => {
    setSidebarWidth(isCollapsed ? MAX_WIDTH : MIN_WIDTH);
  };

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

  // Get first name for collapsed view
  const firstName = user?.name?.split(" ")[0] || "User";

  // Logo display logic
  const LogoDisplay = () => {
    if (isCollapsed) {
      // Collapsed: show only icon
      if (branding?.logoUrl) {
        return (
          <img
            src={branding.logoUrl}
            alt="Logo"
            className="h-8 w-8 object-contain"
          />
        );
      }
      return (
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <img
            src="/logos/d2g-logo.png"
            alt="Dispute2Go"
            className="h-10 w-10 object-contain"
          />
        </motion.div>
      );
    }

    // Expanded: show full logo
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
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <img
            src="/logos/d2g-logo.png"
            alt="Dispute2Go"
            className="h-9 w-9 object-contain"
          />
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
              <img
                src="/logos/d2g-logo.png"
                alt="Dispute2Go"
                className="h-8 w-8 object-contain"
              />
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
                      {...(item.tourId ? { "data-tour": `${item.tourId}-mobile` } : {})}
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
              <motion.hr className="my-4 border-border" variants={mobileItemVariants} />
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
      <motion.div
        ref={sidebarRef}
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-background"
        style={{
          ...sidebarStyle,
          width: sidebarWidth,
        }}
        animate={{ width: sidebarWidth }}
        transition={{ duration: isResizing ? 0 : 0.2, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center h-16 border-b border-border/50",
          isCollapsed ? "justify-center px-2" : "gap-3 px-6"
        )}>
          <LogoDisplay />
        </div>

        {/* Subscription Badge - Cybernetic PRO */}
        <div className={cn("px-3 pt-3", isCollapsed && "px-2")}>
          <SubscriptionBadge tier={user?.subscriptionTier || "FREE"} isCollapsed={isCollapsed} />
        </div>

        {/* Search hint */}
        <div className={cn("pt-3 pb-1", isCollapsed ? "px-2" : "px-4")}>
          <button
            onClick={() => {
              const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
              document.dispatchEvent(event);
            }}
            className={cn(
              "w-full flex items-center text-xs text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg border border-border/50 transition-colors",
              isCollapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2"
            )}
          >
            <Search className={cn(isCollapsed ? "w-5 h-5" : "w-3.5 h-3.5")} />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">Search...</span>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded border border-border/50 font-mono">
                  {"\u2318"}K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 p-4 space-y-1 overflow-y-auto", isCollapsed && "px-2")}>
          {navigation.map((item, i) => {
            const isActive = pathname.startsWith(item.href);
            const activeColor = branding?.sidebarActiveColor || "#3b82f6";
            const textColor = branding?.sidebarTextColor || "#94a3b8";
            const iconName = item.icon.displayName || item.name;
            const isHovered = hoveredIcon === item.name;
            const iconAnimation = iconAnimations[item.name] || {};

            return (
              <motion.div
                key={item.name}
                initial="initial"
                animate="animate"
                whileHover={!isCollapsed ? "hover" : undefined}
                variants={navItemVariants}
                custom={i}
                className="relative"
              >
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all relative group",
                    isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
                  )}
                  {...(item.tourId ? { "data-tour": item.tourId } : {})}
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
                  onMouseEnter={() => handleIconHover(item.name)}
                  onMouseLeave={handleIconLeave}
                >
                  <motion.div
                    animate={isHovered && isCollapsed ? iconAnimation : {}}
                    whileHover={!isCollapsed ? { rotate: isActive ? 0 : 10 } : undefined}
                    transition={{ type: "spring", stiffness: 300 }}
                    className={cn(
                      "flex items-center justify-center",
                      isCollapsed && "w-7 h-7"
                    )}
                  >
                    <item.icon className={cn(
                      "transition-all",
                      isCollapsed ? "h-6 w-6" : "h-5 w-5"
                    )} />
                  </motion.div>

                  {!isCollapsed && (
                    <>
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
                    </>
                  )}
                </Link>

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg border border-border">
                    {item.name}
                  </div>
                )}
              </motion.div>
            );
          })}
        </nav>

        {/* User section */}
        <motion.div
          className={cn(
            "border-t border-border/50",
            isCollapsed ? "p-2" : "p-4"
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className={cn(
            "flex items-center",
            isCollapsed ? "flex-col gap-2 py-2" : "gap-3 px-3 py-2"
          )}>
            <Avatar
              src={profilePicture}
              name={user?.name}
              size={isCollapsed ? "md" : "md"}
            />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={branding ? { color: branding.sidebarTextColor } : {}}>
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.organizationName || "Organization"}
                </p>
              </div>
            )}
            {isCollapsed && (
              <p className="text-[10px] font-medium truncate max-w-full text-center" style={branding ? { color: branding.sidebarTextColor } : {}}>
                {firstName}
              </p>
            )}
          </div>
          <motion.div
            whileHover={{ x: isCollapsed ? 0 : 4 }}
            whileTap={{ scale: 0.98 }}
            className={cn(isCollapsed && "flex justify-center")}
          >
            <Button
              variant="ghost"
              className={cn(
                "text-muted-foreground",
                isCollapsed ? "w-10 h-10 p-0" : "w-full justify-start mt-2"
              )}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className={cn(isCollapsed ? "h-5 w-5" : "h-4 w-4 mr-2")} />
              {!isCollapsed && "Sign Out"}
            </Button>
          </motion.div>
        </motion.div>

        {/* Resize handle */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-1 cursor-col-resize group",
            "hover:bg-purple-500/50 transition-colors",
            isResizing && "bg-purple-500/50"
          )}
          style={{ right: 0 }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          <div className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2",
            "w-4 h-8 rounded-full bg-muted flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isResizing && "opacity-100"
          )}>
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>
      </motion.div>

      {/* Spacer for main content - adjusts based on sidebar width */}
      <div
        className="hidden lg:block flex-shrink-0 transition-all duration-200"
        style={{ width: sidebarWidth }}
      />
    </>
  );
}

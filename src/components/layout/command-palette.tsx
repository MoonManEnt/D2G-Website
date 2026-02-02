"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Users,
  FileText,
  Camera,
  MessageSquare,
  Shield,
  BarChart3,
  Settings,
  CreditCard,
  Plus,
  ArrowRight,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
  category: "navigation" | "action" | "settings";
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: CommandItem[] = [
    // Navigation
    { id: "dashboard", label: "Dashboard", description: "Go to dashboard", icon: <LayoutDashboard className="w-4 h-4" />, action: () => router.push("/dashboard"), keywords: ["home", "main", "overview"], category: "navigation" },
    { id: "clients", label: "Clients", description: "Manage clients", icon: <Users className="w-4 h-4" />, action: () => router.push("/clients"), keywords: ["people", "customers"], category: "navigation" },
    { id: "disputes", label: "Disputes", description: "Dispute management", icon: <FileText className="w-4 h-4" />, action: () => router.push("/disputes"), keywords: ["letters", "claims"], category: "navigation" },
    { id: "evidence", label: "Evidence", description: "Evidence library", icon: <Camera className="w-4 h-4" />, action: () => router.push("/evidence"), keywords: ["screenshots", "proof", "capture"], category: "navigation" },
    { id: "responses", label: "Responses", description: "Track CRA responses", icon: <MessageSquare className="w-4 h-4" />, action: () => router.push("/responses"), keywords: ["replies", "outcomes", "results"], category: "navigation" },
    { id: "sentry", label: "Sentry", description: "Dispute intelligence", icon: <Shield className="w-4 h-4" />, action: () => router.push("/sentry"), keywords: ["ai", "intelligence", "analysis", "oscar"], category: "navigation" },
    { id: "analytics", label: "Analytics", description: "Performance analytics", icon: <BarChart3 className="w-4 h-4" />, action: () => router.push("/analytics"), keywords: ["stats", "reports", "metrics", "charts"], category: "navigation" },
    { id: "settings", label: "Settings", description: "Account settings", icon: <Settings className="w-4 h-4" />, action: () => router.push("/settings"), keywords: ["preferences", "account", "profile", "config"], category: "settings" },
    { id: "billing", label: "Billing", description: "Subscription & billing", icon: <CreditCard className="w-4 h-4" />, action: () => router.push("/billing"), keywords: ["subscription", "payment", "plan", "stripe"], category: "settings" },
    // Actions
    { id: "new-client", label: "Add New Client", description: "Create a new client", icon: <Plus className="w-4 h-4" />, action: () => { router.push("/clients"); /* The page handles "add" via state */ }, keywords: ["create", "new", "add", "client"], category: "action" },
  ];

  const filteredCommands = search
    ? commands.filter(cmd => {
        const searchLower = search.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.keywords.some(k => k.includes(searchLower))
        );
      })
    : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setIsOpen(prev => !prev);
      setSearch("");
      setSelectedIndex(0);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSelect = (cmd: CommandItem) => {
    cmd.action();
    setIsOpen(false);
    setSearch("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      handleSelect(filteredCommands[selectedIndex]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9998]" role="dialog" aria-label="Command palette" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search commands..."
                className="flex-1 bg-transparent text-foreground placeholder-slate-400 outline-none text-sm"
                aria-label="Search commands"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-list"
                aria-activedescendant={filteredCommands[selectedIndex]?.id}
              />
              <kbd className="px-2 py-0.5 text-xs text-muted-foreground bg-card rounded border border-input">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div id="command-list" role="listbox" className="max-h-80 overflow-y-auto py-2">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No commands found
                </div>
              ) : (
                filteredCommands.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    id={cmd.id}
                    role="option"
                    aria-selected={i === selectedIndex}
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selectedIndex ? "bg-purple-500/20 text-foreground" : "text-muted-foreground hover:bg-card"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${i === selectedIndex ? "bg-purple-500/30 text-purple-300" : "bg-card text-muted-foreground"}`}>
                      {cmd.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{cmd.label}</div>
                      {cmd.description && (
                        <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
                      )}
                    </div>
                    {i === selectedIndex && (
                      <ArrowRight className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-input">&#8593;&#8595;</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-input">&#8629;</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-card rounded border border-input">esc</kbd>
                Close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

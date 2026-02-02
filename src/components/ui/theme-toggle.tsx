"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

const modes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-1">
        {modes.map((mode) => (
          <div
            key={mode.value}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground"
          >
            <mode.icon className="h-4 w-4" />
            <span>{mode.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-1">
      {modes.map((mode) => {
        const isActive = theme === mode.value;
        return (
          <button
            key={mode.value}
            onClick={() => setTheme(mode.value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <mode.icon className="h-4 w-4" />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

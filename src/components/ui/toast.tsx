"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] gap-2",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden",
    "rounded-xl border p-4 pr-10 shadow-2xl backdrop-blur-sm",
    "transition-all duration-300 ease-out",
    // Swipe animations
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    // Entry/exit animations
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[swipe=end]:animate-out data-[state=closed]:fade-out-80",
    "data-[state=closed]:slide-out-to-right-full",
    "data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
    "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border-border bg-background/95 text-foreground",
          "shadow-slate-900/50",
        ].join(" "),
        destructive: [
          "destructive group",
          "border-red-500/30 bg-gradient-to-r from-red-950/95 to-red-900/90 text-red-50",
          "shadow-red-900/30",
        ].join(" "),
        success: [
          "border-emerald-500/30 bg-gradient-to-r from-emerald-950/95 to-emerald-900/90 text-emerald-50",
          "shadow-emerald-900/30",
        ].join(" "),
        warning: [
          "border-amber-500/30 bg-gradient-to-r from-amber-950/95 to-amber-900/90 text-amber-50",
          "shadow-amber-900/30",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// Icon component for toast variants
const ToastIcon = ({ variant }: { variant?: "default" | "destructive" | "success" | "warning" | null }) => {
  const iconClass = "h-5 w-5 shrink-0";

  switch (variant) {
    case "success":
      return <CheckCircle2 className={cn(iconClass, "text-emerald-400 animate-in zoom-in-50 duration-300")} />;
    case "destructive":
      return <AlertCircle className={cn(iconClass, "text-red-400 animate-in zoom-in-50 duration-300")} />;
    case "warning":
      return <AlertCircle className={cn(iconClass, "text-amber-400 animate-in zoom-in-50 duration-300")} />;
    default:
      return <Info className={cn(iconClass, "text-primary animate-in zoom-in-50 duration-300")} />;
  }
};

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & { showIcon?: boolean }
>(({ className, variant, showIcon = true, children, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {showIcon && (
        <div className="shrink-0">
          <ToastIcon variant={variant} />
        </div>
      )}
      {children}
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      // Base styles
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-medium",
      // Colors
      "border border-input/50 bg-card/50 text-foreground",
      // Transitions
      "transition-all duration-200 ease-out",
      // Hover states
      "hover:bg-muted/70 hover:border-border hover:scale-[1.02]",
      // Active state
      "active:scale-[0.98]",
      // Focus states
      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 focus:ring-offset-transparent",
      // Disabled
      "disabled:pointer-events-none disabled:opacity-50",
      // Destructive variant
      "group-[.destructive]:border-red-500/30 group-[.destructive]:bg-red-500/20 group-[.destructive]:text-red-200",
      "group-[.destructive]:hover:bg-red-500/30 group-[.destructive]:hover:border-red-400/40",
      "group-[.destructive]:focus:ring-red-400/50",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      // Base styles
      "absolute right-2 top-2 rounded-lg p-1.5",
      // Colors and opacity
      "text-muted-foreground opacity-60",
      // Transitions for smooth micro-animations
      "transition-all duration-200 ease-out",
      // Hover states with scale animation
      "hover:opacity-100 hover:text-foreground hover:bg-muted/50 hover:scale-110",
      // Active state
      "active:scale-95",
      // Focus states
      "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-1 focus:ring-offset-transparent",
      // Group hover reveal
      "group-hover:opacity-100",
      // Destructive variant colors
      "group-[.destructive]:text-red-300/70 group-[.destructive]:hover:text-red-100 group-[.destructive]:hover:bg-red-500/20",
      "group-[.destructive]:focus:ring-red-400/50",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "text-sm font-semibold leading-tight tracking-tight",
      "animate-in fade-in-50 slide-in-from-left-1 duration-300",
      className
    )}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "text-sm opacity-80 leading-relaxed",
      "animate-in fade-in-50 slide-in-from-left-1 duration-300 delay-75",
      className
    )}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastIcon,
};

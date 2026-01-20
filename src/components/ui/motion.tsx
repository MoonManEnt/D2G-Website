"use client";

import { motion, AnimatePresence, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import {
  pageVariants,
  fadeInVariants,
  slideUpVariants,
  staggerContainerVariants,
  staggerItemVariants,
  cardHoverVariants,
  scaleVariants,
} from "@/lib/animations";

// Page wrapper with enter/exit animations
interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Fade in wrapper
interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  delay?: number;
}

export function FadeIn({ children, delay = 0, ...props }: FadeInProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={fadeInVariants}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Slide up wrapper
interface SlideUpProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  delay?: number;
}

export function SlideUp({ children, delay = 0, ...props }: SlideUpProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={slideUpVariants}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Stagger container for lists
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerContainer({ children, className, delay = 0 }: StaggerContainerProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={{
        ...staggerContainerVariants,
        animate: {
          transition: {
            staggerChildren: 0.05,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger item for list children
interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
}

export function StaggerItem({ children, ...props }: StaggerItemProps) {
  return (
    <motion.div variants={staggerItemVariants} {...props}>
      {children}
    </motion.div>
  );
}

// Interactive card with hover/tap animations
interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function AnimatedCard({ children, onClick, disabled, ...props }: AnimatedCardProps) {
  return (
    <motion.div
      initial="initial"
      whileHover={!disabled ? "hover" : undefined}
      whileTap={!disabled ? "tap" : undefined}
      variants={cardHoverVariants}
      onClick={!disabled ? onClick : undefined}
      style={{ cursor: onClick && !disabled ? "pointer" : "default" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Animated presence wrapper for conditional rendering
interface AnimatedPresenceWrapperProps {
  children: ReactNode;
  show: boolean;
  mode?: "wait" | "sync" | "popLayout";
}

export function AnimatedPresenceWrapper({
  children,
  show,
  mode = "wait"
}: AnimatedPresenceWrapperProps) {
  return (
    <AnimatePresence mode={mode}>
      {show && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={scaleVariants}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Animated counter for numbers
interface AnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({ value, className, duration = 1 }: AnimatedCounterProps) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
      transition={{ duration: 0.3 }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration }}
      >
        {value.toLocaleString()}
      </motion.span>
    </motion.span>
  );
}

// Success animation with checkmark
export function SuccessAnimation({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
      }}
      className={className}
    >
      <motion.svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M20 6L9 17L4 12"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        />
      </motion.svg>
    </motion.div>
  );
}

// Loading spinner with animation
export function LoadingSpinner({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear",
      }}
      className={className}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
    </motion.div>
  );
}

// Skeleton with shimmer effect
export function AnimatedSkeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={`bg-slate-700/50 rounded ${className}`}
      animate={{
        backgroundPosition: ["200% 0", "-200% 0"],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "linear",
      }}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

// Notification badge with pulse
interface PulseBadgeProps {
  children: ReactNode;
  className?: string;
  pulse?: boolean;
}

export function PulseBadge({ children, className, pulse = true }: PulseBadgeProps) {
  return (
    <motion.span
      className={className}
      animate={pulse ? { scale: [1, 1.1, 1] } : undefined}
      transition={{
        duration: 1,
        repeat: Infinity,
        repeatDelay: 2,
      }}
    >
      {children}
    </motion.span>
  );
}

// Shake animation wrapper (for errors)
interface ShakeWrapperProps {
  children: ReactNode;
  trigger: boolean;
  className?: string;
}

export function ShakeWrapper({ children, trigger, className }: ShakeWrapperProps) {
  return (
    <motion.div
      className={className}
      animate={trigger ? { x: [0, -10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}

// Export motion for custom use
export { motion, AnimatePresence };

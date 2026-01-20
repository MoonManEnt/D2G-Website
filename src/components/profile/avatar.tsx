"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  onEdit?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-xl",
  xl: "w-24 h-24 text-3xl",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

export function Avatar({
  src,
  name,
  size = "md",
  editable = false,
  onEdit,
  className,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  const showImage = src && !imageError;

  return (
    <motion.div
      className={cn(
        "relative rounded-full overflow-hidden bg-slate-700 flex items-center justify-center cursor-pointer",
        sizeClasses[size],
        editable && "ring-2 ring-transparent hover:ring-brand-500/50 transition-all",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={editable ? onEdit : undefined}
      whileHover={editable ? { scale: 1.05 } : undefined}
      whileTap={editable ? { scale: 0.95 } : undefined}
    >
      {showImage ? (
        <img
          src={src}
          alt={name || "Avatar"}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : initials ? (
        <span className="font-medium text-slate-300">{initials}</span>
      ) : (
        <User className={cn("text-slate-400", iconSizes[size])} />
      )}

      {/* Edit overlay */}
      {editable && (
        <motion.div
          className="absolute inset-0 bg-black/50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Camera className={cn("text-white", size === "xl" ? "w-8 h-8" : "w-5 h-5")} />
        </motion.div>
      )}
    </motion.div>
  );
}

// Avatar with status indicator
interface AvatarWithStatusProps extends AvatarProps {
  status?: "online" | "offline" | "busy" | "away";
}

const statusColors = {
  online: "bg-emerald-500",
  offline: "bg-slate-500",
  busy: "bg-red-500",
  away: "bg-amber-500",
};

export function AvatarWithStatus({
  status = "offline",
  size = "md",
  ...props
}: AvatarWithStatusProps) {
  const statusSizes = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
    xl: "w-4 h-4",
  };

  return (
    <div className="relative inline-block">
      <Avatar size={size} {...props} />
      <motion.div
        className={cn(
          "absolute bottom-0 right-0 rounded-full border-2 border-slate-800",
          statusColors[status],
          statusSizes[size]
        )}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500 }}
      />
    </div>
  );
}

// Avatar group for team displays
interface AvatarGroupProps {
  avatars: Array<{
    src?: string | null;
    name?: string;
  }>;
  max?: number;
  size?: "sm" | "md";
}

export function AvatarGroup({ avatars, max = 4, size = "sm" }: AvatarGroupProps) {
  const displayed = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className="flex -space-x-2">
      {displayed.map((avatar, i) => (
        <motion.div
          key={i}
          className="ring-2 ring-slate-800 rounded-full"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          <Avatar src={avatar.src} name={avatar.name} size={size} />
        </motion.div>
      ))}
      {remaining > 0 && (
        <motion.div
          className={cn(
            "rounded-full bg-slate-600 flex items-center justify-center ring-2 ring-slate-800",
            size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
          )}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: max * 0.05 }}
        >
          <span className="font-medium text-slate-300">+{remaining}</span>
        </motion.div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useIntersection } from "./use-intersection";

interface UseAnimatedCounterOptions {
  target: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function useAnimatedCounter({
  target,
  duration = 1500,
  delay = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
}: UseAnimatedCounterOptions) {
  const { ref, isIntersecting } = useIntersection({ threshold: 0.3, once: true });
  const [value, setValue] = useState(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isIntersecting || hasStarted.current) return;
    hasStarted.current = true;

    const timeout = setTimeout(() => {
      let startTime: number | null = null;

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = easeOutExpo(progress);
        setValue(eased * target);
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };

      requestAnimationFrame(step);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isIntersecting, target, duration, delay]);

  const displayValue = `${prefix}${value.toFixed(decimals)}${suffix}`;

  return { ref, displayValue, value, isIntersecting };
}

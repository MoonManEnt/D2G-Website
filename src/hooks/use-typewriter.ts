"use client";

import { useState, useEffect, useCallback } from "react";

interface UseTypewriterOptions {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
  enabled?: boolean;
}

export function useTypewriter({
  text,
  speed = 30,
  delay = 0,
  onComplete,
  enabled = true,
}: UseTypewriterOptions) {
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const reset = useCallback(() => {
    setDisplayText("");
    setIsTyping(false);
    setIsComplete(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    const delayTimeout = setTimeout(() => {
      if (!isMounted) return;
      setIsTyping(true);

      let i = 0;
      const interval = setInterval(() => {
        if (!isMounted) {
          clearInterval(interval);
          return;
        }
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1));
          i++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
          setIsComplete(true);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(delayTimeout);
    };
  }, [text, speed, delay, onComplete, enabled]);

  return { displayText, isTyping, isComplete, reset };
}

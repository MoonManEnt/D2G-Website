"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface AriaLiveContextType {
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

const AriaLiveContext = createContext<AriaLiveContextType>({ announce: () => {} });

export function useAriaLive() {
  return useContext(AriaLiveContext);
}

export function AriaLiveProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    if (priority === "assertive") {
      setAssertiveMessage("");
      requestAnimationFrame(() => setAssertiveMessage(message));
    } else {
      setPoliteMessage("");
      requestAnimationFrame(() => setPoliteMessage(message));
    }
  }, []);

  return (
    <AriaLiveContext.Provider value={{ announce }}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {politeMessage}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" role="alert">
        {assertiveMessage}
      </div>
    </AriaLiveContext.Provider>
  );
}

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AmeliaChat } from "./amelia-chat";

interface AmeliaChatDrawerProps {
  clientId?: string;
  clientName?: string;
  trigger?: React.ReactNode;
}

const overlayVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
} as const;

const drawerVariants = {
  initial: { x: "100%" },
  animate: {
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    x: "100%",
    transition: {
      duration: 0.2,
      ease: "easeIn" as const,
    },
  },
};

const fabVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
      delay: 0.5,
    },
  },
  hover: {
    scale: 1.08,
    transition: { duration: 0.2 },
  },
  tap: {
    scale: 0.92,
    transition: { duration: 0.1 },
  },
};

export function AmeliaChatDrawer({
  clientId,
  clientName,
  trigger,
}: AmeliaChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleConversationCreated = useCallback((id: string) => {
    setConversationId(id);
  }, []);

  const handleNewConversation = useCallback(() => {
    setConversationId(undefined);
  }, []);

  return (
    <>
      {/* Trigger */}
      {trigger ? (
        <div onClick={handleOpen} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <motion.div
          variants={fabVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
          whileTap="tap"
          className="fixed bottom-6 right-6 z-40"
        >
          <Button
            onClick={handleOpen}
            size="lg"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg",
              "bg-gradient-to-br from-violet-600 to-purple-600",
              "hover:from-violet-500 hover:to-purple-500",
              "text-white border-0"
            )}
          >
            <div className="relative">
              <MessageSquare className="w-6 h-6" />
              <Sparkles className="w-3 h-3 absolute -top-1.5 -right-1.5 text-yellow-300" />
            </div>
            <span className="sr-only">Open Amelia Chat</span>
          </Button>
        </motion.div>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay backdrop */}
            <motion.div
              key="amelia-drawer-overlay"
              variants={overlayVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={handleClose}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Drawer panel */}
            <motion.div
              key="amelia-drawer-panel"
              variants={drawerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={cn(
                "fixed inset-y-0 right-0 z-50",
                "w-full sm:w-[420px] md:w-[480px]",
                "bg-background border-l border-border shadow-2xl",
                "flex flex-col"
              )}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Chat with Amelia
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      AI Dispute Intelligence
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {conversationId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNewConversation}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      New Chat
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                    <span className="sr-only">Close chat</span>
                  </Button>
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 overflow-hidden">
                <AmeliaChat
                  clientId={clientId}
                  clientName={clientName}
                  conversationId={conversationId}
                  onConversationCreated={handleConversationCreated}
                  className="h-full border-0 rounded-none"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

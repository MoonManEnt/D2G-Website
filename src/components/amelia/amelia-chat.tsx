"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AmeliaChatProps {
  clientId?: string;
  clientName?: string;
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
  className?: string;
}

/** Extract all text from a UIMessage's parts array */
function getMessageText(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

export function AmeliaChat({
  clientId,
  clientName,
  conversationId,
  onConversationCreated,
  className,
}: AmeliaChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/amelia/chat",
        body: { clientId, conversationId },
      }),
    [clientId, conversationId]
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      if (onConversationCreated && message.id) {
        onConversationCreated(message.id);
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue.trim() });
    setInputValue("");
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background rounded-lg border border-border overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/30">
          <Bot className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Amelia</h3>
          <p className="text-xs text-muted-foreground">AI Dispute Assistant</p>
        </div>
        {clientId && clientName && (
          <Badge
            variant="secondary"
            className="text-xs shrink-0 max-w-[180px] truncate"
          >
            Chatting about: {clientName}
          </Badge>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-violet-400" />
            </div>
            <h4 className="text-base font-medium text-foreground mb-1">
              Chat with Amelia
            </h4>
            <p className="text-sm text-muted-foreground max-w-xs">
              {clientName
                ? `Ask me anything about ${clientName}'s case, disputes, or credit strategy.`
                : "Ask me about dispute strategies, FCRA regulations, letter crafting, or credit repair best practices."}
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const text = getMessageText(
              message.parts as Array<{ type: string; text?: string }>
            );

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                layout
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card text-card-foreground border border-border rounded-bl-md"
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">{text}</div>
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && (
            <motion.div
              key="typing-indicator"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex gap-3 justify-start"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center mt-0.5">
                <Bot className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div className="bg-card text-card-foreground border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{
                        y: [0, -6, 0],
                        transition: {
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: "easeInOut" as const,
                        },
                      }}
                      className="block w-2 h-2 rounded-full bg-muted-foreground/50"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive">
            Something went wrong. Please try again.
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border bg-card px-4 py-3">
        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              clientName
                ? `Ask about ${clientName}...`
                : "Ask Amelia anything..."
            }
            disabled={isLoading}
            className={cn(
              "flex-1 h-10 rounded-full border border-input bg-background px-4 py-2 text-sm",
              "ring-offset-background placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isLoading}
            className="h-10 w-10 rounded-full shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
}

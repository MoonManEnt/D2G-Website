"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquarePlus,
  Star,
  Send,
  Loader2,
  CheckCircle,
  Bug,
  Lightbulb,
  Heart,
  Frown,
  Meh,
  Smile,
  ThumbsUp,
  ArrowLeft,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { createLogger } from "@/lib/logger";
const log = createLogger("feedback-page");

type FeedbackType = "bug" | "idea" | "love" | "frustration" | "general";
type Rating = 1 | 2 | 3 | 4 | 5;

interface FeedbackData {
  type: FeedbackType;
  rating: Rating | null;
  comment: string;
  page: string;
  timestamp: string;
  userAgent: string;
  screenSize: string;
}

const feedbackTypes: { type: FeedbackType; icon: React.ReactNode; label: string; description: string; color: string }[] = [
  { type: "bug", icon: <Bug className="w-6 h-6" />, label: "Report a Bug", description: "Something isn't working correctly", color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50" },
  { type: "idea", icon: <Lightbulb className="w-6 h-6" />, label: "Share an Idea", description: "Suggest a new feature or improvement", color: "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 hover:border-amber-500/50" },
  { type: "love", icon: <Heart className="w-6 h-6" />, label: "Share the Love", description: "Tell us what you enjoy about Dispute2Go", color: "bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30 hover:border-pink-500/50" },
  { type: "frustration", icon: <Frown className="w-6 h-6" />, label: "I'm Frustrated", description: "Something is causing you trouble", color: "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30 hover:border-orange-500/50" },
  { type: "general", icon: <MessageSquarePlus className="w-6 h-6" />, label: "General Feedback", description: "Any other thoughts or comments", color: "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 hover:border-primary/50" },
];

const ratingEmojis: { rating: Rating; icon: React.ReactNode; label: string }[] = [
  { rating: 1, icon: <Frown className="w-8 h-8" />, label: "Very Poor" },
  { rating: 2, icon: <Meh className="w-8 h-8" />, label: "Poor" },
  { rating: 3, icon: <Smile className="w-8 h-8" />, label: "Okay" },
  { rating: 4, icon: <ThumbsUp className="w-8 h-8" />, label: "Good" },
  { rating: 5, icon: <Star className="w-8 h-8" />, label: "Excellent" },
];

export default function FeedbackPage() {
  const pathname = usePathname();
  const [step, setStep] = useState<"type" | "rating" | "comment" | "success">("type");
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState<Rating | null>(null);

  const resetForm = useCallback(() => {
    setStep("type");
    setFeedbackType(null);
    setRating(null);
    setComment("");
  }, []);

  const handleTypeSelect = (type: FeedbackType) => {
    setFeedbackType(type);
    setStep("rating");
  };

  const handleRatingSelect = (r: Rating) => {
    setRating(r);
    setStep("comment");
  };

  const handleSubmit = async () => {
    if (!feedbackType) return;

    setSubmitting(true);

    const feedbackData: FeedbackData = {
      type: feedbackType,
      rating,
      comment,
      page: pathname,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      screenSize: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
    };

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });

      setStep("success");
    } catch (error) {
      log.error({ err: error }, "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = feedbackTypes.find((t) => t.type === feedbackType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background text-foreground p-6">
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <MessageSquarePlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Beta Feedback
            </h1>
            <p className="text-muted-foreground text-sm">Help us improve Dispute2Go</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card backdrop-blur-xl border border-border rounded-2xl overflow-hidden"
        >
          {/* Progress indicator */}
          {step !== "success" && (
            <div className="px-6 pt-6">
              <div className="flex items-center gap-2 mb-6">
                {["type", "rating", "comment"].map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step === s ? "bg-purple-600 text-white" :
                      ["type", "rating", "comment"].indexOf(step) > i ? "bg-purple-600/20 text-purple-400" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </div>
                    {i < 2 && (
                      <div className={`w-12 h-0.5 mx-1 transition-colors ${
                        ["type", "rating", "comment"].indexOf(step) > i ? "bg-purple-600" : "bg-muted"
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Select Type */}
              {step === "type" && (
                <motion.div
                  key="type"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-semibold mb-2">What kind of feedback do you have?</h2>
                    <p className="text-muted-foreground text-sm">Select the category that best describes your feedback</p>
                  </div>
                  <div className="grid gap-3">
                    {feedbackTypes.map((ft) => (
                      <button
                        key={ft.type}
                        onClick={() => handleTypeSelect(ft.type)}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${ft.color}`}
                      >
                        <div className="flex-shrink-0">
                          {ft.icon}
                        </div>
                        <div>
                          <p className="font-medium">{ft.label}</p>
                          <p className="text-sm opacity-70">{ft.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Rating */}
              {step === "rating" && (
                <motion.div
                  key="rating"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setStep("type")}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-xl font-semibold">How would you rate your overall experience?</h2>
                      <p className="text-muted-foreground text-sm">This helps us understand the context of your feedback</p>
                    </div>
                  </div>

                  <div className="flex justify-center gap-4 py-8">
                    {ratingEmojis.map((r) => (
                      <button
                        key={r.rating}
                        onClick={() => handleRatingSelect(r.rating)}
                        onMouseEnter={() => setHoveredRating(r.rating)}
                        onMouseLeave={() => setHoveredRating(null)}
                        className={`p-4 rounded-xl transition-all ${
                          hoveredRating === r.rating || rating === r.rating
                            ? "bg-violet-500/20 text-violet-400 scale-110"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {r.icon}
                      </button>
                    ))}
                  </div>

                  <p className="text-center text-muted-foreground h-6">
                    {hoveredRating
                      ? ratingEmojis.find((r) => r.rating === hoveredRating)?.label
                      : "Select a rating"}
                  </p>

                  <button
                    onClick={() => setStep("comment")}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Skip rating →
                  </button>
                </motion.div>
              )}

              {/* Step 3: Comment */}
              {step === "comment" && (
                <motion.div
                  key="comment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setStep("rating")}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      {selectedType && (
                        <span className={`px-3 py-1.5 rounded-lg text-sm ${selectedType.color}`}>
                          {selectedType.icon}
                        </span>
                      )}
                      {rating && (
                        <span className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 text-sm flex items-center gap-1">
                          {ratingEmojis.find((r) => r.rating === rating)?.icon}
                          {rating}/5
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold mb-2">Tell us more</h2>
                    <p className="text-muted-foreground text-sm">The more detail you provide, the better we can help</p>
                  </div>

                  <Textarea
                    placeholder={
                      feedbackType === "bug"
                        ? "Describe the bug... What did you expect to happen? What actually happened?"
                        : feedbackType === "idea"
                        ? "Share your idea... How would this improve your workflow?"
                        : feedbackType === "frustration"
                        ? "What frustrated you? Be specific - we want to fix it."
                        : feedbackType === "love"
                        ? "What do you love about Dispute2Go? We'd love to hear it!"
                        : "Share your thoughts..."
                    }
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[200px] bg-background border-border text-foreground placeholder:text-muted-foreground resize-none"
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {comment.length}/500 characters
                    </p>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || comment.length === 0}
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Submit Feedback
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Success State */}
              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center"
                  >
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </motion.div>
                  <h2 className="text-2xl font-semibold text-foreground mb-3">Thank You!</h2>
                  <p className="text-muted-foreground mb-8">
                    Your feedback helps us build a better product for credit repair professionals.
                  </p>
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    className="border-border"
                  >
                    Submit Another Feedback
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              You're using the beta version of Dispute2Go. Your feedback is invaluable!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

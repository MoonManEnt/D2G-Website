"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquarePlus,
  X,
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
  Zap,
  Camera,
} from "lucide-react";
import { usePathname } from "next/navigation";

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

const feedbackTypes: { type: FeedbackType; icon: React.ReactNode; label: string; color: string }[] = [
  { type: "bug", icon: <Bug className="w-4 h-4" />, label: "Bug", color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" },
  { type: "idea", icon: <Lightbulb className="w-4 h-4" />, label: "Idea", color: "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30" },
  { type: "love", icon: <Heart className="w-4 h-4" />, label: "Love It", color: "bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30" },
  { type: "frustration", icon: <Frown className="w-4 h-4" />, label: "Frustrated", color: "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30" },
  { type: "general", icon: <MessageSquarePlus className="w-4 h-4" />, label: "General", color: "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30" },
];

const ratingEmojis: { rating: Rating; icon: React.ReactNode; label: string }[] = [
  { rating: 1, icon: <Frown className="w-6 h-6" />, label: "Very Poor" },
  { rating: 2, icon: <Meh className="w-6 h-6" />, label: "Poor" },
  { rating: 3, icon: <Smile className="w-6 h-6" />, label: "Okay" },
  { rating: 4, icon: <ThumbsUp className="w-6 h-6" />, label: "Good" },
  { rating: 5, icon: <Star className="w-6 h-6" />, label: "Excellent" },
];

export function BetaFeedback() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
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

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(resetForm, 300);
  }, [resetForm]);

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
      // Send to API
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });

      setStep("success");
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = feedbackTypes.find((t) => t.type === feedbackType);

  return (
    <>
      {/* Floating Trigger Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-full shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all group"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="font-medium">Beta Feedback</span>
        <Badge className="bg-white/20 text-white text-[10px] px-1.5 py-0">
          <Zap className="w-3 h-3 mr-0.5" />
          NEW
        </Badge>
      </motion.button>

      {/* Feedback Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-violet-600/10 to-purple-600/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <MessageSquarePlus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Beta Feedback</h3>
                    <p className="text-xs text-slate-400">Help us improve Dispute2Go</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <AnimatePresence mode="wait">
                  {/* Step 1: Select Type */}
                  {step === "type" && (
                    <motion.div
                      key="type"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <p className="text-sm text-slate-300">What kind of feedback do you have?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {feedbackTypes.map((ft) => (
                          <button
                            key={ft.type}
                            onClick={() => handleTypeSelect(ft.type)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${ft.color}`}
                          >
                            {ft.icon}
                            <span className="font-medium">{ft.label}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 text-center">
                        Page: {pathname}
                      </p>
                    </motion.div>
                  )}

                  {/* Step 2: Rating */}
                  {step === "rating" && (
                    <motion.div
                      key="rating"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setStep("type")}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400"
                        >
                          ←
                        </button>
                        <p className="text-sm text-slate-300">
                          How would you rate your experience on this page?
                        </p>
                      </div>

                      <div className="flex justify-center gap-2">
                        {ratingEmojis.map((r) => (
                          <button
                            key={r.rating}
                            onClick={() => handleRatingSelect(r.rating)}
                            onMouseEnter={() => setHoveredRating(r.rating)}
                            onMouseLeave={() => setHoveredRating(null)}
                            className={`p-3 rounded-xl transition-all ${
                              hoveredRating === r.rating || rating === r.rating
                                ? "bg-violet-500/20 text-violet-400 scale-110"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            }`}
                          >
                            {r.icon}
                          </button>
                        ))}
                      </div>

                      <p className="text-center text-sm text-slate-400 h-5">
                        {hoveredRating
                          ? ratingEmojis.find((r) => r.rating === hoveredRating)?.label
                          : "Select a rating"}
                      </p>

                      <button
                        onClick={() => setStep("comment")}
                        className="w-full text-center text-sm text-slate-500 hover:text-slate-300"
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
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setStep("rating")}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400"
                        >
                          ←
                        </button>
                        <div className="flex items-center gap-2">
                          {selectedType && (
                            <span className={`px-2 py-1 rounded-lg text-xs ${selectedType.color}`}>
                              {selectedType.icon}
                            </span>
                          )}
                          {rating && (
                            <span className="px-2 py-1 rounded-lg bg-violet-500/20 text-violet-400 text-xs flex items-center gap-1">
                              {ratingEmojis.find((r) => r.rating === rating)?.icon}
                              {rating}/5
                            </span>
                          )}
                        </div>
                      </div>

                      <Textarea
                        placeholder={
                          feedbackType === "bug"
                            ? "Describe the bug... What did you expect to happen?"
                            : feedbackType === "idea"
                            ? "Share your idea... How would this improve your workflow?"
                            : feedbackType === "frustration"
                            ? "What frustrated you? Be specific - we want to fix it."
                            : "Share your thoughts..."
                        }
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="min-h-[120px] bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 resize-none"
                      />

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">
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
                      className="py-8 text-center"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.1 }}
                        className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center"
                      >
                        <CheckCircle className="w-8 h-8 text-green-400" />
                      </motion.div>
                      <h4 className="text-lg font-semibold text-white mb-2">Thank You!</h4>
                      <p className="text-sm text-slate-400">
                        Your feedback helps us build a better product.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-800 bg-slate-800/30">
                <p className="text-xs text-slate-500 text-center">
                  You're using the beta version of Dispute2Go
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

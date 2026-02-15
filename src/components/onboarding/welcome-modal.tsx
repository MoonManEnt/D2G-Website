"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "./onboarding-provider";

// ── Motivational quotes pool — Black excellence in leadership, business, and legacy ──
const QUOTES = [
  // Business Titans
  { text: "Willing is not enough; we must do.", author: "Robert F. Smith" },
  { text: "Every successful business is built on the foundation of service.", author: "Robert F. Smith" },
  { text: "I want to show young people that there are no limits to what they can achieve.", author: "Janice Bryant Howroyd" },
  { text: "Don't wait for opportunity. Create it.", author: "Madam C.J. Walker" },
  { text: "I got my start by giving myself a start.", author: "Madam C.J. Walker" },
  { text: "I had to make my own living and my own opportunity. But I made it.", author: "Madam C.J. Walker" },
  { text: "You can't build a reputation on what you are going to do.", author: "John H. Johnson" },
  { text: "To be successful, you must act big, think big, and talk big.", author: "Reginald F. Lewis" },
  { text: "Keep going. No matter what.", author: "Reginald F. Lewis" },
  { text: "Why should White guys have all the fun?", author: "Reginald F. Lewis" },
  { text: "Your brand is what people say about you when you're not in the room.", author: "David Steward" },
  { text: "Success is the result of perfection, hard work, and learning from failure.", author: "Robert L. Johnson" },
  { text: "Don't let what you cannot do interfere with what you can do.", author: "Daymond John" },
  { text: "The Power of Broke forces you to think more creatively.", author: "Daymond John" },

  // Civil Rights & Activism
  { text: "If there is no struggle, there is no progress.", author: "Frederick Douglass" },
  { text: "It is easier to build strong children than to repair broken men.", author: "Frederick Douglass" },
  { text: "I am no longer accepting the things I cannot change. I am changing the things I cannot accept.", author: "Angela Davis" },
  { text: "You have to act as if it were possible to radically transform the world. And you have to do it all the time.", author: "Angela Davis" },
  { text: "Hold fast to dreams, for if dreams die, life is a broken-winged bird that cannot fly.", author: "Langston Hughes" },
  { text: "The time is always right to do what is right.", author: "Martin Luther King Jr." },
  { text: "Intelligence plus character — that is the goal of true education.", author: "Martin Luther King Jr." },
  { text: "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.", author: "Martin Luther King Jr." },
  { text: "There is no better than adversity. Every defeat, every heartbreak, every loss, contains its own seed, its own lesson on how to improve your performance the next time.", author: "Malcolm X" },
  { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
  { text: "I am America. I am the part you won't recognize. But get used to me.", author: "Muhammad Ali" },
  { text: "Service is the rent we pay for being. It is the very purpose of life, and not something you do in your spare time.", author: "Marian Wright Edelman" },

  // Culture, Arts & Thought Leadership
  { text: "You are your best thing.", author: "Toni Morrison" },
  { text: "If you are free, you need to free somebody else. If you have some power, then your job is to empower somebody else.", author: "Toni Morrison" },
  { text: "Define yourself, or someone else will define you for you.", author: "Chadwick Boseman" },
  { text: "The struggles along the way are only meant to shape you for your purpose.", author: "Chadwick Boseman" },
  { text: "You can only become truly accomplished at something you love.", author: "Maya Angelou" },
  { text: "We delight in the beauty of the butterfly, but rarely admit the changes it has gone through to achieve that beauty.", author: "Maya Angelou" },
  { text: "Success is liking yourself, liking what you do, and liking how you do it.", author: "Maya Angelou" },
  { text: "Think like a queen. A queen is not afraid to fail. Failure is another stepping stone to greatness.", author: "Oprah Winfrey" },
  { text: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
  { text: "You become what you believe.", author: "Oprah Winfrey" },
  { text: "Impossible is just a big word thrown around by small men who find it easier to live in the world they've been given than to explore the power they have to change it.", author: "Muhammad Ali" },

  // Modern Business & Tech
  { text: "Don't be intimidated by what you don't know. That can be your greatest strength.", author: "Sara Blakely" },
  { text: "The biggest risk is not taking any risk.", author: "Tyler Perry" },
  { text: "I don't want to just be a mogul. I want to build something that lasts.", author: "Tyler Perry" },
  { text: "It's not about how much money you make but how much money you keep, how hard it works for you, and how many generations you keep it for.", author: "Robert Kiyosaki" },
  { text: "Invest in as much of yourself as you can. You are your own biggest asset by far.", author: "Warren Buffett" },
  { text: "When you undervalue what you do, the world will undervalue who you are.", author: "Suze Orman" },
  { text: "Stop waiting for somebody to elevate your game. You are already equipped with everything you need to manifest your own greatness.", author: "Germany Kent" },
  { text: "Your legacy is being written by yourself. Make the right decisions.", author: "Gary Vaynerchuk" },

  // Wealth & Generational Legacy
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Build your own dreams, or someone else will hire you to build theirs.", author: "Farrah Gray" },
  { text: "Comfort is the enemy of achievement.", author: "Farrah Gray" },
  { text: "I had to go out and make it happen. Nobody was going to hand it to me.", author: "Berry Gordy" },
  { text: "The goal isn't more money. The goal is living life on your terms.", author: "Chris Brogan" },
  { text: "Real wealth is not about money. Real wealth is about freedom.", author: "T. Harv Eker" },
  { text: "The only limit to your impact is your imagination and commitment.", author: "Tony Robbins" },
  { text: "Do not wait to strike till the iron is hot; but make it hot by striking.", author: "William Butler Yeats" },
  { text: "Legacy is not leaving something for people. It's leaving something in people.", author: "Peter Strople" },
];

function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

export function WelcomeModal() {
  const { showWelcome, dismissWelcome } = useOnboarding();
  const [contentShow, setContentShow] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const quote = getDailyQuote();

  useEffect(() => {
    if (showWelcome) {
      const t = setTimeout(() => setContentShow(true), 300);
      return () => clearTimeout(t);
    } else {
      setContentShow(false);
      setClosing(false);
    }
  }, [showWelcome]);

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => {
      dismissWelcome();
    }, 500);
  };

  const fade = (d = 0) => ({
    opacity: contentShow && !closing ? 1 : 0,
    transform: contentShow && !closing ? "translateY(0)" : closing ? "translateY(-10px)" : "translateY(16px)",
    transition: `all 0.55s cubic-bezier(0.16,1,0.3,1) ${d}s`,
  });

  return (
    <AnimatePresence>
      {showWelcome && (
        <>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
            .welcome-modal-root { --head: 'Sora', sans-serif; --body: 'DM Sans', sans-serif; }
            .welcome-modal-root *::-webkit-scrollbar { display: none; }
            .welcome-modal-root * { -ms-overflow-style: none; scrollbar-width: none; }

            @keyframes orbDrift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.1); } }
            @keyframes orbDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-35px,25px) scale(1.08); } }
            @keyframes orbDrift3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px,20px) scale(1.05); } }
            @keyframes welcomeShimmer {
              0% { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
            @keyframes pulseGlow {
              0%, 100% { opacity: 0.4; transform: scale(1); }
              50% { opacity: 0.7; transform: scale(1.02); }
            }
            @keyframes logoFloat {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
          `}</style>

          <motion.div
            className="welcome-modal-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(4,8,20,0.85)",
              backdropFilter: "blur(24px) saturate(1.2)",
              WebkitBackdropFilter: "blur(24px) saturate(1.2)",
              opacity: showWelcome && !closing ? 1 : 0,
              transition: "opacity 0.4s ease",
              fontFamily: "var(--body)",
            }}
          >
            {/* Ambient orbs */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
              <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)", top: "5%", left: "10%", filter: "blur(80px)", animation: "orbDrift1 16s ease-in-out infinite" }} />
              <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)", bottom: "10%", right: "10%", filter: "blur(70px)", animation: "orbDrift2 20s ease-in-out infinite" }} />
              <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)", top: "50%", left: "55%", filter: "blur(60px)", animation: "orbDrift3 14s ease-in-out infinite" }} />
            </div>

            {/* Modal card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{
                scale: showWelcome && !closing ? 1 : closing ? 0.97 : 0.95,
                opacity: showWelcome && !closing ? 1 : 0,
                y: showWelcome && !closing ? 0 : closing ? -8 : 12
              }}
              exit={{ scale: 0.97, opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 560,
                margin: "0 24px",
                borderRadius: 24,
                overflow: "hidden",
                maxHeight: "95vh",
              }}
            >
              {/* Animated border glow */}
              <div
                style={{
                  position: "absolute",
                  inset: -1,
                  borderRadius: 25,
                  zIndex: 0,
                  background: "conic-gradient(from 0deg, #14b8a6, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #14b8a6)",
                  animation: "pulseGlow 4s ease-in-out infinite",
                  filter: "blur(1px)",
                }}
              />

              {/* Card body */}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  margin: 1.5,
                  borderRadius: 23,
                  overflow: "hidden",
                  background: "linear-gradient(165deg, rgba(15,22,41,0.95) 0%, rgba(10,16,32,0.98) 100%)",
                  backdropFilter: "blur(40px)",
                  overflowY: "auto",
                  maxHeight: "calc(95vh - 3px)",
                }}
              >
                {/* Top hero gradient */}
                <div
                  style={{
                    position: "relative",
                    padding: "28px 40px 28px",
                    background: "linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(59,130,246,0.12) 40%, rgba(139,92,246,0.15) 100%)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    overflow: "hidden",
                    textAlign: "center",
                  }}
                >
                  {/* Grid pattern */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
                      backgroundSize: "40px 40px",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Shield icon */}
                  <div style={{ ...fade(0.05), display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 20,
                        background: "linear-gradient(135deg, rgba(20,184,166,0.2), rgba(59,130,246,0.2))",
                        border: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "logoFloat 6s ease-in-out infinite",
                      }}
                    >
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(226,232,240,0.8)" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                  </div>

                  {/* Heading */}
                  <h1
                    style={{
                      ...fade(0.12),
                      fontFamily: "var(--head)",
                      fontSize: 26,
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      color: "#f0f2f7",
                      margin: 0,
                      lineHeight: 1.25,
                    }}
                  >
                    Welcome to{" "}
                    <span
                      style={{
                        background: "linear-gradient(135deg, #2dd4bf, #3b82f6, #a78bfa)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundSize: "200% auto",
                        animation: "welcomeShimmer 6s linear infinite",
                      }}
                    >
                      Dispute2Go
                    </span>
                  </h1>
                </div>

                {/* Body content */}
                <div style={{ padding: "32px 40px 36px" }}>
                  {/* Welcome paragraphs */}
                  <div style={{ ...fade(0.2), textAlign: "center" }}>
                    <p
                      style={{
                        fontFamily: "var(--body)",
                        fontSize: 14.5,
                        lineHeight: 1.7,
                        color: "rgba(226,232,240,0.7)",
                        margin: "0 0 16px 0",
                      }}
                    >
                      The credit dispute operating system built for professionals. Import any IdentityIQ report and watch it transform into a complete, actionable dispute workflow—automatically sequenced by FCRA statute, legally compliant, and ready to send.
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--body)",
                        fontSize: 14.5,
                        lineHeight: 1.7,
                        color: "rgba(226,232,240,0.7)",
                        margin: "0 0 16px 0",
                      }}
                    >
                      No more manual letter drafting. No more guessing which violations to cite. Just powerful, precise disputes that get results.
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--body)",
                        fontSize: 14.5,
                        lineHeight: 1.7,
                        color: "rgba(226,232,240,0.85)",
                        fontWeight: 500,
                        margin: "0 0 28px 0",
                      }}
                    >
                      Good luck out there.
                    </p>
                  </div>

                  {/* Quote card */}
                  <div style={{ ...fade(0.32), display: "flex", justifyContent: "center", marginBottom: 28 }}>
                    <div
                      style={{
                        padding: "16px 20px",
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        display: "inline-flex",
                        gap: 14,
                        alignItems: "flex-start",
                        maxWidth: "100%",
                      }}
                    >
                      {/* Quote icon */}
                      <div
                        style={{
                          flexShrink: 0,
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "linear-gradient(135deg, rgba(20,184,166,0.12), rgba(59,130,246,0.12))",
                          border: "1px solid rgba(20,184,166,0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M10 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2l-2 4h2.4l2-4H10V8h4V6H10c-1.1 0-2 .9-2 2zm8-2h-4v2h4v6h-2.4l-2 4h2.4l2-4c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2z"
                            fill="url(#qg)"
                          />
                          <defs>
                            <linearGradient id="qg" x1="6" y1="6" x2="22" y2="18">
                              <stop stopColor="#2dd4bf" />
                              <stop offset="1" stopColor="#818cf8" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--body)",
                            fontSize: 13.5,
                            fontStyle: "italic",
                            lineHeight: 1.6,
                            color: "rgba(226,232,240,0.6)",
                            margin: "0 0 6px 0",
                          }}
                        >
                          &ldquo;{quote.text}&rdquo;
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--body)",
                            fontSize: 12,
                            color: "rgba(148,163,184,0.6)",
                            margin: 0,
                            fontWeight: 500,
                          }}
                        >
                          — {quote.author}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div style={fade(0.42)}>
                    <button
                      onClick={handleDismiss}
                      onMouseEnter={() => setHovered(true)}
                      onMouseLeave={() => setHovered(false)}
                      style={{
                        width: "100%",
                        position: "relative",
                        padding: "15px 28px",
                        borderRadius: 14,
                        border: "none",
                        cursor: "pointer",
                        overflow: "hidden",
                        background: hovered
                          ? "linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)"
                          : "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
                        boxShadow: hovered
                          ? "0 8px 32px rgba(20,184,166,0.35), 0 0 0 1px rgba(20,184,166,0.2) inset"
                          : "0 4px 16px rgba(20,184,166,0.2), 0 0 0 1px rgba(20,184,166,0.1) inset",
                        transform: hovered ? "translateY(-1px)" : "translateY(0)",
                        transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                      }}
                    >
                      {/* Shimmer overlay */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)",
                          backgroundSize: "200% 100%",
                          animation: hovered ? "welcomeShimmer 2s linear infinite" : "none",
                          pointerEvents: "none",
                        }}
                      />
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--body)",
                            fontSize: 14.5,
                            fontWeight: 600,
                            color: "#fff",
                            letterSpacing: "0.02em",
                          }}
                        >
                          Let&apos;s Get to Work
                        </span>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transform: hovered ? "translateX(3px)" : "translateX(0)",
                            transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
                          }}
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

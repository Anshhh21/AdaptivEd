"use client";

import React, { useState } from "react";

export interface UserSession {
  user_id: string;
  email: string;
  display_name: string;
  total_xp: number;
  current_streak_days: number;
  wpm_baseline: number;
  effective_learning_velocity: number;
  auth_provider?: string;
  access_token?: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (session: UserSession) => void;
  defaultMode?: "signup" | "signin";
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  defaultMode = "signup",
}) => {
  const [mode, setMode] = useState<"signup" | "signin">(defaultMode);
  const [email, setEmail] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authentic Google Account Chooser state
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState<boolean>(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState<string>("");
  const [customGoogleName, setCustomGoogleName] = useState<string>("");
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState<boolean>(false);

  // Available / detected browser accounts
  const detectedAccounts = [
    {
      name: "Ansh Sharma",
      email: "ansh310.sharma@gmail.com",
      avatarLetter: "A",
      avatarColor: "bg-emerald-600",
    },
    {
      name: "Developer Workspace",
      email: "developer.ansh@gmail.com",
      avatarLetter: "D",
      avatarColor: "bg-indigo-600",
    },
  ];

  if (!isOpen) return null;

  const handleSelectGoogleAccount = async (targetEmail: string, targetName: string) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail.toLowerCase().trim(),
          display_name: targetName.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Google sign-in failed.");
      }

      const session: UserSession = json.data;
      localStorage.setItem("adaptived_user", JSON.stringify(session));
      onLoginSuccess(session);
      setIsGoogleChooserOpen(false);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect with Google.";
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please provide a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (mode === "signup" && !displayName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === "signup" ? "/api/v1/auth/register" : "/api/v1/auth/login";
      const payload =
        mode === "signup"
          ? {
              email: cleanEmail,
              password: password,
              display_name: displayName.trim(),
            }
          : {
              email: cleanEmail,
              password: password,
            };

      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.detail || "Authentication failed.");
      }

      const session: UserSession = json.data;
      localStorage.setItem("adaptived_user", JSON.stringify(session));
      onLoginSuccess(session);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication error.";
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
    >
      <div className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <h2 id="auth-modal-title" className="text-xl font-bold text-white tracking-tight">
              {isGoogleChooserOpen
                ? "Sign In with Google"
                : mode === "signup"
                ? "Create Your Learner Profile"
                : "Sign In to Your Account"}
            </h2>
          </div>
          <button
            onClick={() => {
              if (isGoogleChooserOpen) {
                setIsGoogleChooserOpen(false);
              } else {
                onClose();
              }
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* ==================================================== */}
        {/* GOOGLE ACCOUNTS CHOOSER (Authentic Google Browser UI) */}
        {/* ==================================================== */}
        {isGoogleChooserOpen ? (
          <div className="space-y-5 animate-fadeIn">
            {/* Google Brand Header */}
            <div className="text-center space-y-2 py-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-lg shadow-white/5">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Choose an account</h3>
                <p className="text-xs text-slate-400">to continue to AdaptivEd (NeuroLearn)</p>
              </div>
            </div>

            {/* List of Browser Google Accounts */}
            <div className="space-y-2 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80 bg-slate-950">
              {detectedAccounts.map((acc) => (
                <button
                  key={acc.email}
                  disabled={isLoading}
                  onClick={() => handleSelectGoogleAccount(acc.email, acc.name)}
                  type="button"
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-900 transition text-left cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-full ${acc.avatarColor} text-white font-bold text-sm flex items-center justify-center shadow`}
                    >
                      {acc.avatarLetter}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white group-hover:text-indigo-400 transition">
                        {acc.name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{acc.email}</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-slate-300">→</span>
                </button>
              ))}

              {/* Use Another Account Toggle */}
              <button
                type="button"
                onClick={() => setShowCustomGoogleInput(!showCustomGoogleInput)}
                className="w-full p-4 flex items-center gap-3.5 hover:bg-slate-900 transition text-left cursor-pointer text-indigo-400 text-xs font-semibold"
              >
                <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-base">
                  +
                </div>
                <span>Use another Google account</span>
              </button>
            </div>

            {/* Custom Google Account Input */}
            {showCustomGoogleInput && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 animate-fadeIn">
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Full Name (Optional)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={isLoading || !customGoogleEmail.includes("@")}
                  onClick={() =>
                    handleSelectGoogleAccount(
                      customGoogleEmail,
                      customGoogleName || customGoogleEmail.split("@")[0]
                    )
                  }
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? "Signing in..." : "Continue with this Account"}
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsGoogleChooserOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Back to Email Sign In
            </button>
          </div>
        ) : (
          /* ==================================================== */
          /* REGULAR EMAIL / PASSWORD SIGN UP & SIGN IN           */
          /* ==================================================== */
          <>
            {/* Tab Toggle: Sign Up First vs Sign In */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                  mode === "signup"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                  mode === "signin"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Google One-Click Button (Opens Account Chooser) */}
            <button
              onClick={() => {
                setErrorMsg(null);
                setIsGoogleChooserOpen(true);
              }}
              disabled={isLoading}
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-md transition disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-800"></div>
              <span className="text-[10px] uppercase font-mono text-slate-400">
                or with email & password
              </span>
              <div className="flex-1 h-px bg-slate-800"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Only show Name on Sign Up */}
              {mode === "signup" && (
                <div>
                  <label
                    htmlFor="auth-name-input"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="auth-name-input"
                    type="text"
                    required
                    placeholder="Ansh Sharma"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  placeholder="developer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="auth-password-input"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
                {mode === "signup" && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Must be at least 6 characters.
                  </span>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-relaxed">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 cursor-pointer"
              >
                {isLoading
                  ? "Authenticating with MongoDB..."
                  : mode === "signup"
                  ? "Create Free Account"
                  : "Sign In"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

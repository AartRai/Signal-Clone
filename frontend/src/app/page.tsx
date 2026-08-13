"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/context/SocketContext";
import { useToast } from "@/context/ToastContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const AVATAR_SEEDS = ["signal", "alice", "bob", "charlie", "dana", "evan", "happy", "cool", "star"];

// The Home component serves as the authentication entry point (Login & Registration).
export default function Home() {
  const { currentUser, login, register } = useSocket();
  const { error } = useToast();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");

  // Registration fields
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState("signal");

  // OTP stage
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingIdentifier, setPendingIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to chat
  // Redirects the user to the chat interface if they are already logged in
  useEffect(() => {
    if (currentUser) {
      router.push("/chat");
    }
  }, [currentUser, router]);

  // Handles the primary login/registration submission, transitioning to the OTP stage if successful
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = phone.trim() || username.trim();
    if (!identifier) {
      error("Please provide either phone number or username");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim() || null,
          username: username.trim() || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Login failed");
      }

      setPendingIdentifier(identifier);
      setShowOtp(true);
    } catch (err: any) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Finalizes the authentication process by verifying the simulated OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      error("OTP must be exactly 6 characters");
      return;
    }

    setLoading(true);
    // Identify whether phone or username was used
    const isPhone = pendingIdentifier.startsWith("+");
    const success = await login(
      isPhone ? pendingIdentifier : null,
      isPhone ? null : pendingIdentifier,
      otp
    );

    setLoading(false);
    if (success) {
      router.push("/chat");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      error("Display name is required");
      return;
    }
    if (!phone.trim() && !username.trim()) {
      error("Please provide either a phone number or a username");
      return;
    }

    setLoading(true);
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${selectedAvatarSeed}`;
    const success = await register(
      username.trim(),
      phone.trim(),
      displayName.trim(),
      avatarUrl
    );
    setLoading(false);

    if (success) {
      // Switch to login tab and prefill the identifier
      setPendingIdentifier(phone.trim() || username.trim());
      setMode("login");
      setShowOtp(true);
    }
  };

  // Render loading state while checking the active session
  if (currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-text-secondary font-semibold">
        Loading your chats...
      </div>
    );
  }

  // Render the main authentication UI layout
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-surface-2 p-8 shadow-2xl">

        {/* Signal Branding Logo */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-blue-500/20">
            <svg viewBox="0 0 24 24" className="h-10 w-10 fill-white">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.83.49 3.55 1.34 5.03L2.06 21.6c-.22.68.41 1.3 1.09 1.09l4.57-1.28C9.2 22.14 10.57 22.4 12 22.4c5.52 0 10-4.48 10-10S17.52 2 12 2zm1.09 16.03c-.22.25-.49.37-.81.37s-.61-.13-.85-.38l-2.61-2.63a1.14 1.14 0 010-1.6c.44-.45 1.15-.45 1.59 0l1.83 1.84 4.54-4.88c.42-.45 1.14-.47 1.58-.02.44.44.42 1.16-.03 1.6l-5.26 5.7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Signal</h2>
          <p className="text-sm text-text-secondary">Private, secure messaging clone.</p>
        </div>

        {/* Tab Switcher */}
        {!showOtp && (
          <div className="flex rounded-lg bg-surface-2 p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === "login"
                  ? "bg-primary text-white shadow"
                  : "text-text-secondary hover:text-neutral-200"
                }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === "register"
                  ? "bg-primary text-white shadow"
                  : "text-text-secondary hover:text-neutral-200"
                }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Auth Forms */}
        {showOtp ? (
          /* OTP Screen */
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div className="space-y-1 text-center">
              <h3 className="text-lg font-medium">Verify Identity</h3>
              <p className="text-xs text-text-secondary">
                We've sent a simulated OTP to <span className="text-neutral-200">{pendingIdentifier}</span>.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="otp" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Enter Verification Code
              </label>
              <input
                id="otp"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-border bg-surface-1 px-4 py-3 text-center text-xl font-bold tracking-widest text-foreground outline-none ring-offset-neutral-900 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
              <p className="text-center text-xs text-text-secondary">
                Enter mock OTP <span className="font-semibold text-text-secondary">123456</span> to log in.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowOtp(false);
                setOtp("");
              }}
              className="w-full text-center text-xs text-text-secondary hover:text-neutral-200"
            >
              Back to Login
            </button>
          </form>
        ) : mode === "login" ? (
          /* Login Screen */
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="phone" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+1111111111"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setUsername(""); // exclusive inputs
                  }}
                  className="w-full rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none ring-offset-neutral-900 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-4 text-xs text-text-secondary font-semibold uppercase">Or</span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              <div className="space-y-2">
                <label htmlFor="username" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  placeholder="alice"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setPhone(""); // exclusive inputs
                  }}
                  className="w-full rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none ring-offset-neutral-900 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (!phone.trim() && !username.trim())}
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
            >
              {loading ? "Sending OTP..." : "Request Verification Code"}
            </button>

            {/* Seed guide helper */}
            <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-xs text-text-secondary space-y-1">
              <span className="font-semibold text-neutral-200">Tip:</span> Try logging in with one of the pre-seeded users:
              <ul className="list-disc list-inside mt-1 text-[11px] text-text-secondary space-y-0.5">
                <li>Username: <span className="font-mono text-foreground">alice</span> or Phone: <span className="font-mono text-foreground">+1111111111</span></li>
                <li>Username: <span className="font-mono text-foreground">bob</span> or Phone: <span className="font-mono text-foreground">+2222222222</span></li>
              </ul>
            </div>
          </form>
        ) : (
          /* Registration Screen */
          <form onSubmit={handleRegisterSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Select Profile Avatar
                </label>
                <div className="flex flex-wrap gap-2 justify-center py-2">
                  {AVATAR_SEEDS.map((seed) => {
                    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setSelectedAvatarSeed(seed)}
                        className={`h-11 w-11 rounded-full overflow-hidden border-2 transition ${selectedAvatarSeed === seed ? "border-blue-500 scale-110" : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                      >
                        <img src={avatarUrl} alt={seed} className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-name" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Display Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none ring-offset-neutral-900 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-phone" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  placeholder="+1999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none ring-offset-neutral-900 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-username" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-foreground outline-none ring-offset-neutral-900 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !displayName.trim() || (!phone.trim() && !username.trim())}
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
            >
              {loading ? "Registering..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

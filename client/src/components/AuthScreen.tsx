import { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle, MessageSquare } from "lucide-react";
import { register, login, resetPassword, AuthUser } from "../lib/api";

interface Props {
  onAuth: (token: string, user: AuthUser) => void;
}

type Tab = "login" | "register";

export default function AuthScreen({ onAuth }: Props) {
  const [tab, setTab] = useState<Tab>("login");
  const [resetting, setResetting] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const switchTab = (t: Tab) => {
    setTab(t); setResetting(false); setError(""); setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (resetting) {
        await resetPassword(email, password, newPassword);
        setSuccess("Password changed successfully.");
        setPassword(""); setNewPassword("");
        setTimeout(() => { setResetting(false); setSuccess(""); }, 2000);
      } else if (tab === "login") {
        const result = await login(email, password);
        localStorage.setItem("lc_token", result.token);
        onAuth(result.token, result.user);
      } else {
        const result = await register(email, username, password);
        localStorage.setItem("lc_token", result.token);
        onAuth(result.token, result.user);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = resetting ? "Reset Password" : tab === "login" ? "Sign in" : "Create account";

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--bg)", fontFamily: "var(--font-ui)" }}
    >
      {/* Left panel — branding, hidden on mobile */}
      <div
        className="hidden md:flex flex-col justify-between p-12 flex-1"
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent)" }}
          >
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "18px", color: "var(--text-primary)" }}>
            LocalChat
          </span>
        </div>

        <div>
          <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "28px", color: "var(--text-primary)", lineHeight: 1.4, maxWidth: "320px" }}>
            "Chat and share files with anyone on your network. No internet required."
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {[
              "Real-time messaging across your LAN",
              "File sharing up to 200 MB per file",
              "No accounts stored on any server",
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--accent-light)", border: "1px solid var(--accent-mid)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)" }}>
          LAN-only · No internet required
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col items-center justify-center w-full md:w-auto md:min-w-[420px] p-6 md:p-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 md:hidden">
          <div
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "17px", color: "var(--text-primary)" }}>
            LocalChat
          </span>
        </div>

        <div className="w-full max-w-[360px] animate-slide-up">
          {/* Heading */}
          <div className="mb-7">
            <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
              {resetting ? "Reset password" : tab === "login" ? "Sign in" : "Create account"}
            </h1>
            <p className="mt-1" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {resetting ? "Enter your current and new password" : "to your LocalChat workspace"}
            </p>
          </div>

          {/* Tab switcher */}
          {!resetting && (
            <div
              className="flex mb-6 p-1 rounded-lg"
              style={{ background: "var(--border-soft)" }}
            >
              {(["login", "register"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: tab === t ? "var(--surface)" : "transparent",
                    color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    fontFamily: "var(--font-ui)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>
          )}

          {/* Back from reset */}
          {resetting && (
            <button
              type="button"
              onClick={() => { setResetting(false); setError(""); setSuccess(""); }}
              className="flex items-center gap-2 mb-5 text-sm"
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)" }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign in
            </button>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="block mb-1.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-dim)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="input-field"
                  style={{ paddingLeft: "36px" }}
                />
              </div>
            </div>

            {/* Username — register only */}
            {tab === "register" && !resetting && (
              <div>
                <label className="block mb-1.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  Display name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-dim)" }} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your name"
                    required
                    maxLength={30}
                    className="input-field"
                    style={{ paddingLeft: "36px" }}
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block mb-1.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                {resetting ? "Current password" : "Password"}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-dim)" }} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input-field"
                  style={{ paddingLeft: "36px", paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 icon-btn"
                  style={{ width: "24px", height: "24px" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password — reset only */}
            {resetting && (
              <div>
                <label className="block mb-1.5 text-xs font-medium" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-dim)" }} />
                  <input
                    type={showPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="input-field"
                    style={{ paddingLeft: "36px" }}
                  />
                </div>
              </div>
            )}

            {/* Forgot password */}
            {tab === "login" && !resetting && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => { setResetting(true); setError(""); setSuccess(""); }}
                  style={{ fontSize: "13px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)" }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm" style={{ background: "var(--error-light)", border: "1px solid #FECACA" }}>
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--error)" }} />
                <span style={{ color: "var(--error)" }}>{error}</span>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm" style={{ background: "var(--success-light)", border: "1px solid var(--accent-mid)" }}>
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
                <span style={{ color: "var(--success)" }}>{success}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-1">
              {loading
                ? <span className="spinner" />
                : submitLabel
              }
            </button>
          </form>

          {/* Switch tab hint */}
          {!resetting && (
            <p className="text-center mt-5 text-sm" style={{ color: "var(--text-muted)" }}>
              {tab === "login" ? "No account?" : "Already registered?"}{" "}
              <button
                onClick={() => switchTab(tab === "login" ? "register" : "login")}
                style={{ color: "var(--accent)", fontWeight: 500, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)" }}
              >
                {tab === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

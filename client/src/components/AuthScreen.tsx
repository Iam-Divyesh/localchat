import { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
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
    setTab(t);
    setResetting(false);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (resetting) {
        await resetPassword(email, password, newPassword);
        setSuccess("Password changed successfully.");
        setPassword("");
        setNewPassword("");
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

  const submitLabel = resetting ? "Reset Password" : tab === "login" ? "Sign in" : "Create Account";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: "#0a0a0a" }}>
      {/* Depth blob */}
      <div className="depth-blob" />
      <div className="ambient-glow" />
      <div className="ambient-glow-2" />

      <div className="relative z-10 w-full max-w-[380px] animate-slide-up">
        {/* Glass card */}
        <div className="glass-card p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-1" style={{ color: "#fff" }}>
              {resetting ? "Reset password" : tab === "login" ? "Sign in" : "Create account"}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {resetting ? "Enter your current and new password" : "to your account"}
            </p>
          </div>

          {/* Reset back button */}
          {resetting && (
            <button
              type="button"
              onClick={() => { setResetting(false); setError(""); setSuccess(""); }}
              className="flex items-center gap-2 mb-6 text-sm transition-colors"
              style={{ color: "var(--accent)" }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                {tab === "register" ? "Phone Number" : "Email"}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="input-field w-full pl-11"
                />
              </div>
            </div>

            {/* Username — register only */}
            {tab === "register" && !resetting && (
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                  Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your name"
                    required
                    maxLength={30}
                    className="input-field w-full pl-11"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                {resetting ? "Current Password" : "Password"}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input-field w-full pl-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password — reset only */}
            {resetting && (
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type={showPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="input-field w-full pl-11"
                  />
                </div>
              </div>
            )}

            {/* Remember me / Forgot password */}
            {tab === "login" && !resetting && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setResetting(true); setError(""); setSuccess(""); }}
                  className="text-sm transition-colors"
                  style={{ color: "var(--accent)" }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div 
                className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(248, 113, 113, 0.1)", border: "1px solid rgba(248, 113, 113, 0.2)" }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--error)" }} />
                <span style={{ color: "var(--error)" }}>{error}</span>
              </div>
            )}

            {/* Success */}
            {success && (
              <div 
                className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(74, 222, 128, 0.1)", border: "1px solid rgba(74, 222, 128, 0.2)" }}
              >
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
                <span style={{ color: "var(--success)" }}>{success}</span>
              </div>
            )}

            {/* Submit */}
            <button 
              type="submit" 
              disabled={loading} 
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <span className="spinner" style={{ width: "20px", height: "20px", borderWidth: "2px" }} />
              ) : (
                <>
                  {submitLabel}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch tab */}
          {!resetting && (
            <p className="text-center mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
              {tab === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => switchTab(tab === "login" ? "register" : "login")}
                className="font-medium transition-colors"
                style={{ color: "var(--accent)" }}
              >
                {tab === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

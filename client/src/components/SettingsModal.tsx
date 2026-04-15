import { useState } from "react";
import { X, User, Lock, Bell, Check, AlertCircle } from "lucide-react";
import { changeUsername, changePassword } from "../lib/api";

interface Props {
  token: string;
  currentUsername: string;
  email: string;
  soundEnabled: boolean;
  onSoundToggle: (v: boolean) => void;
  onUsernameChanged: (newUsername: string) => void;
  onClose: () => void;
}

type Tab = "profile" | "password" | "notifications";

interface FieldState {
  loading: boolean;
  error: string;
  success: string;
}

const INIT: FieldState = { loading: false, error: "", success: "" };

export default function SettingsModal({ 
  token, currentUsername, email, soundEnabled, onSoundToggle, onUsernameChanged, onClose 
}: Props) {
  const [tab, setTab] = useState<Tab>("profile");

  const [username, setUsername] = useState(currentUsername);
  const [profileState, setProfileState] = useState<FieldState>(INIT);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdState, setPwdState] = useState<FieldState>(INIT);

  const handleUsernameChange = async () => {
    if (username.trim() === currentUsername) return;
    setProfileState({ loading: true, error: "", success: "" });
    try {
      const res = await changeUsername(token, username.trim());
      onUsernameChanged(res.username);
      setProfileState({ loading: false, error: "", success: "Username updated!" });
    } catch (err) {
      setProfileState({ loading: false, error: (err as Error).message, success: "" });
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPwd || !newPwd) return setPwdState({ loading: false, error: "All fields are required", success: "" });
    if (newPwd.length < 6) return setPwdState({ loading: false, error: "New password must be at least 6 characters", success: "" });
    if (newPwd !== confirmPwd) return setPwdState({ loading: false, error: "Passwords do not match", success: "" });
    setPwdState({ loading: true, error: "", success: "" });
    try {
      await changePassword(token, currentPwd, newPwd);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setPwdState({ loading: false, error: "", success: "Password changed successfully!" });
    } catch (err) {
      setPwdState({ loading: false, error: (err as Error).message, success: "" });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden glass-card animate-slide-up">
        {/* Header */}
        <div 
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--glass-border)" }}
        >
          <h2 className="font-semibold text-lg" style={{ color: "#fff" }}>Settings</h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex">
          {/* Sidebar tabs */}
          <div 
            className="flex flex-col py-4 px-3 gap-1"
            style={{ width: "150px", borderRight: "1px solid var(--glass-border)" }}
          >
            {([
              { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
              { id: "password", label: "Password", icon: <Lock className="w-4 h-4" /> },
              { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
            ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left transition-all"
                style={{
                  background: tab === t.id ? "var(--accent-dim)" : "transparent",
                  color: tab === t.id ? "var(--accent)" : "var(--text-secondary)",
                }}
                onMouseEnter={(e) => { if (tab !== t.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (tab !== t.id) e.currentTarget.style.background = "transparent"; }}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 p-6">
            {tab === "profile" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                    Email
                  </label>
                  <div 
                    className="px-4 py-3 rounded-xl text-sm"
                    style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
                  >
                    {email}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Email cannot be changed</p>
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                    Display Name
                  </label>
                  <input
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setProfileState(INIT); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleUsernameChange(); }}
                    className="input-field w-full"
                    placeholder="New username"
                    maxLength={40}
                  />
                </div>

                <Feedback state={profileState} />

                <button
                  onClick={handleUsernameChange}
                  disabled={profileState.loading || username.trim() === currentUsername || username.trim().length < 2}
                  className="btn-primary w-full"
                  style={{
                    opacity: (profileState.loading || username.trim() === currentUsername || username.trim().length < 2) ? 0.4 : 1,
                  }}
                >
                  {profileState.loading ? "Saving…" : "Save Username"}
                </button>
              </div>
            )}

            {tab === "password" && (
              <div className="space-y-4">
                {[
                  { label: "Current Password", value: currentPwd, set: setCurrentPwd },
                  { label: "New Password", value: newPwd, set: setNewPwd },
                  { label: "Confirm New Password", value: confirmPwd, set: setConfirmPwd },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                      {f.label}
                    </label>
                    <input
                      type="password"
                      value={f.value}
                      onChange={(e) => { f.set(e.target.value); setPwdState(INIT); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handlePasswordChange(); }}
                      className="input-field w-full"
                      placeholder="••••••••"
                    />
                  </div>
                ))}

                <Feedback state={pwdState} />

                <button
                  onClick={handlePasswordChange}
                  disabled={pwdState.loading}
                  className="btn-primary w-full"
                  style={{ opacity: pwdState.loading ? 0.4 : 1 }}
                >
                  {pwdState.loading ? "Changing…" : "Change Password"}
                </button>
              </div>
            )}

            {tab === "notifications" && (
              <div className="space-y-4">
                <div 
                  className="flex items-center justify-between py-4 px-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#fff" }}>Notification Sound</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Play a sound for new messages
                    </p>
                  </div>
                  <button
                    onClick={() => onSoundToggle(!soundEnabled)}
                    className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
                    style={{ 
                      background: soundEnabled ? "var(--accent)" : "rgba(255,255,255,0.1)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                      style={{
                        background: soundEnabled ? "#fff" : "var(--text-muted)",
                        left: soundEnabled ? "calc(100% - 22px)" : "2px",
                      }}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Feedback({ state }: { state: FieldState }) {
  if (state.success) return (
    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--success)" }}>
      <Check className="w-4 h-4" />{state.success}
    </div>
  );
  if (state.error) return (
    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--error)" }}>
      <AlertCircle className="w-4 h-4" />{state.error}
    </div>
  );
  return null;
}

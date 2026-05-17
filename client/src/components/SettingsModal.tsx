import { useState } from "react";
import { X, User, Bell, Check, AlertCircle } from "lucide-react";

interface Props {
  currentUsername: string;
  soundEnabled: boolean;
  onSoundToggle: (v: boolean) => void;
  onUsernameChanged: (newUsername: string) => void;
  onClose: () => void;
}

type Tab = "profile" | "notifications";

interface FieldState {
  error: string;
  success: string;
}

const INIT: FieldState = { error: "", success: "" };

export default function SettingsModal({
  currentUsername, soundEnabled, onSoundToggle, onUsernameChanged, onClose
}: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [username, setUsername] = useState(currentUsername);
  const [profileState, setProfileState] = useState<FieldState>(INIT);

  const handleUsernameChange = () => {
    const trimmed = username.trim();
    if (trimmed === currentUsername) return;
    if (trimmed.length < 2) { setProfileState({ error: "Name must be at least 2 characters", success: "" }); return; }
    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) { setProfileState({ error: "Only letters, numbers, spaces, hyphens and underscores", success: "" }); return; }
    localStorage.setItem("lc_username", trimmed);
    onUsernameChanged(trimmed);
    setProfileState({ error: "", success: "Name updated!" });
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full h-full md:h-auto md:max-w-md rounded-none md:rounded-2xl overflow-hidden flex flex-col animate-slide-up"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}>Settings</h2>
          <button onClick={onClose} className="icon-btn" style={{ width: "28px", height: "28px" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Tabs */}
          <div
            className="flex md:flex-col py-2 md:py-3 px-2 gap-0.5 overflow-x-auto md:overflow-x-visible flex-shrink-0 md:w-[148px] border-b md:border-b-0 md:border-r"
            style={{ background: "var(--bg)", borderColor: "var(--border)" }}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  background: tab === t.id ? "var(--accent-light)" : "transparent",
                  color: tab === t.id ? "var(--accent)" : "var(--text-muted)",
                  fontFamily: "var(--font-ui)",
                  fontWeight: tab === t.id ? 500 : 400,
                  borderLeft: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
                }}
                onMouseEnter={(e) => { if (tab !== t.id) e.currentTarget.style.background = "var(--border-soft)"; }}
                onMouseLeave={(e) => { if (tab !== t.id) e.currentTarget.style.background = "transparent"; }}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 p-5 overflow-y-auto">
            {tab === "profile" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    Display Name
                  </label>
                  <input
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setProfileState(INIT); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleUsernameChange(); }}
                    className="input-field w-full"
                    placeholder="Your name"
                    maxLength={30}
                  />
                </div>

                {profileState.success && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--success)", fontFamily: "var(--font-ui)" }}>
                    <Check className="w-4 h-4" />{profileState.success}
                  </div>
                )}
                {profileState.error && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--error)", fontFamily: "var(--font-ui)" }}>
                    <AlertCircle className="w-4 h-4" />{profileState.error}
                  </div>
                )}

                <button
                  onClick={handleUsernameChange}
                  disabled={username.trim() === currentUsername || username.trim().length < 2}
                  className="btn-primary w-full"
                  style={{ opacity: (username.trim() === currentUsername || username.trim().length < 2) ? 0.4 : 1 }}
                >
                  Save Name
                </button>
              </div>
            )}

            {tab === "notifications" && (
              <div className="space-y-4">
                <div
                  className="flex items-center justify-between py-4 px-4 rounded-xl"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}>Notification Sound</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", fontFamily: "var(--font-ui)" }}>
                      Play a sound for new messages
                    </p>
                  </div>
                  <button
                    onClick={() => onSoundToggle(!soundEnabled)}
                    className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                    style={{ background: soundEnabled ? "var(--accent)" : "var(--border)", border: "none" }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                      style={{
                        background: "#fff",
                        left: soundEnabled ? "calc(100% - 22px)" : "2px",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
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

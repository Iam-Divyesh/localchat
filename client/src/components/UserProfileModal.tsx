import { useEffect } from "react";
import { X, User, Mail, Circle } from "lucide-react";

interface Props {
  username: string;
  email?: string;
  online: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ username, email, online, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const colors = [
    { bg: "#EFF4FF", fg: "#2563EB" },
    { bg: "#FEF3C7", fg: "#B45309" },
    { bg: "#FCE7F3", fg: "#BE185D" },
    { bg: "#E0F2FE", fg: "#0369A1" },
    { bg: "#F0FDF4", fg: "#15803D" },
  ];
  const av = colors[username.charCodeAt(0) % colors.length];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-80 rounded-2xl overflow-hidden animate-slide-up"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" }}
      >
        {/* Avatar banner */}
        <div className="relative h-20" style={{ background: av.bg }}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 icon-btn"
            style={{ width: "28px", height: "28px" }}
          >
            <X className="w-4 h-4" />
          </button>
          <div
            className="absolute -bottom-10 left-6 w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold"
            style={{
              background: av.bg,
              color: av.fg,
              border: `3px solid var(--surface)`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
            }}
          >
            {username[0]?.toUpperCase()}
          </div>
        </div>

        {/* Content */}
        <div className="pt-14 pb-6 px-6">
          <div className="flex items-center gap-2 mb-5">
            <h3 className="font-semibold text-xl" style={{ color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}>{username}</h3>
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{
                background: online ? "var(--accent-light)" : "var(--border-soft)",
                color: online ? "var(--accent)" : "var(--text-dim)",
                border: `1px solid ${online ? "var(--accent-mid)" : "var(--border)"}`,
              }}
            >
              <Circle className="w-1.5 h-1.5" fill="currentColor" />
              {online ? "Online" : "Offline"}
            </span>
          </div>

          <div className="space-y-2">
            <div
              className="flex items-center gap-3 py-3 px-4 rounded-xl"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            >
              <User className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-dim)" }} />
              <div>
                <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>Username</p>
                <p className="text-sm" style={{ color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}>{username}</p>
              </div>
            </div>
            {email && (
              <div
                className="flex items-center gap-3 py-3 px-4 rounded-xl"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
              >
                <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-dim)" }} />
                <div>
                  <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>Email</p>
                  <p className="text-sm" style={{ color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}>{email}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-80 rounded-2xl overflow-hidden glass-card animate-slide-up">
        {/* Avatar banner */}
        <div className="relative h-24" style={{ background: "var(--accent-dim)" }}>
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-lg transition-colors"
            style={{ background: "rgba(0,0,0,0.3)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <X className="w-4 h-4" />
          </button>
          <div 
            className="absolute -bottom-10 left-6 w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold"
            style={{ 
              background: "var(--accent)", 
              color: "#fff",
              border: "4px solid #1a1a1a",
            }}
          >
            {username[0]?.toUpperCase()}
          </div>
        </div>

        {/* Content */}
        <div className="pt-14 pb-6 px-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-semibold text-xl" style={{ color: "#fff" }}>{username}</h3>
            <span 
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
              style={{ 
                background: online ? "rgba(74, 222, 128, 0.1)" : "rgba(255,255,255,0.05)",
                color: online ? "var(--success)" : "var(--text-muted)",
              }}
            >
              <Circle className="w-2 h-2" fill="currentColor" />
              {online ? "Online" : "Offline"}
            </span>
          </div>

          <div className="space-y-3">
            <div 
              className="flex items-center gap-3 py-3 px-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}
            >
              <User className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              <div>
                <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Username</p>
                <p className="text-sm" style={{ color: "#fff" }}>{username}</p>
              </div>
            </div>
            {email && (
              <div 
                className="flex items-center gap-3 py-3 px-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}
              >
                <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <div>
                  <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Email</p>
                  <p className="text-sm" style={{ color: "#fff" }}>{email}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

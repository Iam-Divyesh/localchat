import { useState } from "react";
import { Hash, LogOut, ArrowRight } from "lucide-react";

interface Props {
  username: string;
  onJoin: (room: string) => void;
  onLogout: () => void;
}

export default function JoinScreen({ username, onJoin, onLogout }: Props) {
  const [room, setRoom] = useState("general");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoin(room.trim() || "general");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: "#0a0a0a" }}>
      {/* Depth blob */}
      <div className="depth-blob" />
      <div className="ambient-glow" />
      <div className="ambient-glow-2" />

      <div className="relative z-10 w-full max-w-[380px] animate-slide-up">
        {/* Glass card */}
        <div className="glass-card p-8">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold mb-4"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {username[0]?.toUpperCase()}
            </div>
            <p className="text-xl font-semibold" style={{ color: "#fff" }}>
              {username}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Pick a channel to join
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                Channel
              </label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--accent)" }} />
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="general"
                  maxLength={40}
                  autoFocus
                  className="input-field w-full pl-11"
                  style={{ fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
              Join #{room || "general"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 mt-4 py-3 rounded-xl text-sm transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

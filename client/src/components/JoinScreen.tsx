import { useState } from "react";
import { Hash, LogOut, MessageSquare, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[360px] animate-slide-up">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "18px", color: "var(--text-primary)" }}>
            LocalChat
          </span>
        </div>

        {/* Card */}
        <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {/* Avatar + name */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold mb-3"
              style={{ background: "var(--accent-light)", color: "var(--accent)", border: "2px solid var(--accent-mid)" }}
            >
              {username[0]?.toUpperCase()}
            </div>
            <p className="font-semibold" style={{ color: "var(--text-primary)", fontSize: "15px" }}>{username}</p>
            <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>Pick a channel to join</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                className="block mb-1.5"
                style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.04em" }}
              >
                Channel
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--accent)" }} />
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="general"
                  maxLength={40}
                  autoFocus
                  className="input-field"
                  style={{ paddingLeft: "36px", fontFamily: "var(--font-mono)" }}
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
            className="w-full flex items-center justify-center gap-2 mt-4 py-2.5 rounded-lg text-sm transition-colors"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)" }}
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

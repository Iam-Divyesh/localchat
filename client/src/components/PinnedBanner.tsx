import { Pin, X } from "lucide-react";
import { Message } from "../hooks/useChat";

interface Props {
  pinned: Message;
  onUnpin: () => void;
  onScrollTo?: () => void;
}

export default function PinnedBanner({ pinned, onUnpin }: Props) {
  return (
    <div
      className="flex items-center gap-3 px-6 py-2.5 flex-shrink-0"
      style={{ background: "var(--accent-light)", borderBottom: "1px solid var(--accent-mid)" }}
    >
      <Pin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold mr-2" style={{ color: "var(--accent)" }}>
          {pinned.username}
        </span>
        <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {pinned.text.slice(0, 80)}
        </span>
      </div>
      <button
        onClick={onUnpin}
        className="flex-shrink-0 icon-btn"
        style={{ width: "20px", height: "20px" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--error)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        title="Unpin"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { fileListToArray } from "../lib/fileChunker";

interface Props {
  onFiles: (files: File[]) => void;
  maxMb?: number;
}

export default function FileDropZone({ onFiles, maxMb = 200 }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (files: FileList | null) => {
    const valid = fileListToArray(files).filter((f) => {
      if (f.size > maxMb * 1024 * 1024) { alert(`${f.name} exceeds ${maxMb} MB`); return false; }
      return true;
    });
    if (valid.length) onFiles(valid);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <button
      type="button"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 flex-shrink-0"
      style={{
        background: dragging ? "var(--accent-dim)" : "transparent",
        border: `1px solid ${dragging ? "var(--accent-border)" : "transparent"}`,
        color: dragging ? "var(--accent)" : "var(--text-muted)",
      }}
      onMouseEnter={(e) => { if (!dragging) e.currentTarget.style.color = "var(--text-secondary)"; }}
      onMouseLeave={(e) => { if (!dragging) e.currentTarget.style.color = "var(--text-muted)"; }}
      title="Attach file"
    >
      <Paperclip className="w-3.5 h-3.5" />
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
    </button>
  );
}

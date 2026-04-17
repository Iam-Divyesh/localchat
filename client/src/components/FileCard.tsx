import { useState, useEffect } from "react";
import { FileText, Image, Video, Music, Archive, File, Download, Check, X, ZoomIn } from "lucide-react";
import { FileAvailable } from "../hooks/useChat";
import { formatBytes, formatTime, CHUNK_SIZE } from "../lib/fileChunker";

type DownloadState = "idle" | "loading" | "done" | "error";

interface Props {
  file: FileAvailable;
  onDownload: (fileId: string, name: string, mimeType: string, totalChunks: number) => Promise<void>;
  onFetchBlob: (fileId: string, mimeType: string, totalChunks: number) => Promise<string>;
}

function FileIcon({ mime, className }: { mime: string; className?: string }) {
  if (mime.startsWith("image/")) return <Image className={className} />;
  if (mime.startsWith("video/")) return <Video className={className} />;
  if (mime.startsWith("audio/")) return <Music className={className} />;
  if (mime === "application/pdf") return <FileText className={className} />;
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("gzip")) return <Archive className={className} />;
  return <File className={className} />;
}

function ImageCard({ file, onDownload, onFetchBlob }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [dlState, setDlState] = useState<DownloadState>("idle");
  const [lightbox, setLightbox] = useState(false);
  const isExpired = Date.now() > file.expiresAt;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const loadPreview = async () => {
    if (loadState !== "idle" || isExpired) return;
    setLoadState("loading");
    try {
      const url = await onFetchBlob(file.id, file.mimeType, totalChunks);
      setPreviewUrl(url);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  };

  const handleDownload = async () => {
    if (dlState !== "idle" || isExpired) return;
    setDlState("loading");
    try {
      await onDownload(file.id, file.name, file.mimeType, totalChunks);
      setDlState("done");
    } catch {
      setDlState("error");
      setTimeout(() => setDlState("idle"), 3000);
    }
  };

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden max-w-[280px] animate-fade-in"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="relative w-full" style={{ minHeight: "100px", background: "var(--bg)" }}>
          {loadState === "ready" && previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt={file.name}
                className="w-full object-cover cursor-zoom-in"
                style={{ maxHeight: "200px", display: "block" }}
                onClick={() => setLightbox(true)}
              />
              <div
                className="absolute top-2 right-2 rounded-lg p-1.5 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                style={{ background: "rgba(0,0,0,0.5)" }}
                onClick={() => setLightbox(true)}
              >
                <ZoomIn className="w-4 h-4" style={{ color: "#fff" }} />
              </div>
            </>
          ) : (
            <button
              onClick={loadPreview}
              disabled={isExpired || loadState === "loading"}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 transition-all"
              style={{ cursor: isExpired ? "not-allowed" : "pointer" }}
            >
              {loadState === "loading" ? (
                <div className="spinner" />
              ) : loadState === "error" ? (
                <>
                  <X className="w-5 h-5" style={{ color: "var(--error)" }} />
                  <span className="text-xs" style={{ color: "var(--error)" }}>Failed to load</span>
                </>
              ) : (
                <>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--accent-light)", border: "1px solid var(--accent-mid)" }}
                  >
                    <Image className="w-6 h-6" style={{ color: "var(--accent)" }} />
                  </div>
                  <span className="text-xs" style={{ color: isExpired ? "var(--text-dim)" : "var(--text-muted)", fontFamily: "var(--font-ui)" }}>
                    {isExpired ? "Expired" : "Click to preview"}
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}>{file.name}</p>
            <p className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              {formatBytes(file.size)} · {formatTime(file.timestamp)}
            </p>
          </div>
          <button
            onClick={handleDownload}
            disabled={dlState !== "idle" || isExpired}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
            style={isExpired
              ? { background: "var(--border-soft)", color: "var(--text-dim)", cursor: "not-allowed" }
              : dlState === "done" ? { background: "var(--accent-light)", color: "var(--accent)" }
              : dlState === "error" ? { background: "#FEE2E2", color: "var(--error)" }
              : dlState === "loading" ? { background: "var(--accent-light)", color: "var(--accent)", cursor: "wait" }
              : { background: "var(--accent)", color: "#fff" }
            }
          >
            {dlState === "loading"
              ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : dlState === "done" ? <Check className="w-4 h-4" />
              : dlState === "error" ? <X className="w-4 h-4" />
              : <Download className="w-4 h-4" />
            }
          </button>
        </div>
      </div>

      {lightbox && previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 cursor-zoom-out"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(false)}
        >
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-full rounded-xl"
            style={{ objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 p-2 rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
            onClick={() => setLightbox(false)}
          >
            <X className="w-5 h-5" />
          </button>
          <p
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm px-4 py-2 rounded-xl"
            style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.8)", fontFamily: "var(--font-mono)" }}
          >
            {file.name} · {formatBytes(file.size)}
          </p>
        </div>
      )}
    </>
  );
}

function PdfCard({ file, onDownload, onFetchBlob }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [dlState, setDlState] = useState<DownloadState>("idle");
  const isExpired = Date.now() > file.expiresAt;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const loadPreview = async () => {
    if (loadState !== "idle" || isExpired) return;
    setLoadState("loading");
    try {
      const url = await onFetchBlob(file.id, file.mimeType, totalChunks);
      setPdfUrl(url);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  };

  const handleDownload = async () => {
    if (dlState !== "idle" || isExpired) return;
    setDlState("loading");
    try {
      await onDownload(file.id, file.name, file.mimeType, totalChunks);
      setDlState("done");
    } catch {
      setDlState("error");
      setTimeout(() => setDlState("idle"), 3000);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden max-w-[320px] animate-fade-in"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {loadState === "ready" && pdfUrl ? (
        <iframe
          src={pdfUrl}
          title={file.name}
          className="w-full"
          style={{ height: "280px", border: "none", background: "#fff" }}
        />
      ) : (
        <button
          onClick={loadPreview}
          disabled={isExpired || loadState === "loading"}
          className="w-full flex flex-col items-center justify-center gap-2 py-10 transition-all"
          style={{ cursor: isExpired ? "not-allowed" : "pointer" }}
        >
          {loadState === "loading" ? (
            <div className="spinner" />
          ) : loadState === "error" ? (
            <>
              <X className="w-5 h-5" style={{ color: "var(--error)" }} />
              <span className="text-xs" style={{ color: "var(--error)" }}>Failed to load</span>
            </>
          ) : (
            <>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "var(--accent-light)", border: "1px solid var(--accent-mid)" }}
              >
                <FileText className="w-6 h-6" style={{ color: "var(--accent)" }} />
              </div>
              <span className="text-xs" style={{ color: isExpired ? "var(--text-dim)" : "var(--text-muted)", fontFamily: "var(--font-ui)" }}>
                {isExpired ? "Expired" : "Click to preview PDF"}
              </span>
            </>
          )}
        </button>
      )}

      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderTop: "1px solid var(--border-soft)" }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}>{file.name}</p>
          <p className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {formatBytes(file.size)} · PDF · {formatTime(file.timestamp)}
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={dlState !== "idle" || isExpired}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
          style={isExpired
            ? { background: "var(--border-soft)", color: "var(--text-dim)", cursor: "not-allowed" }
            : dlState === "done" ? { background: "var(--accent-light)", color: "var(--accent)" }
            : dlState === "error" ? { background: "#FEE2E2", color: "var(--error)" }
            : dlState === "loading" ? { background: "var(--accent-light)", color: "var(--accent)", cursor: "wait" }
            : { background: "var(--accent)", color: "#fff" }
          }
        >
          {dlState === "loading"
            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : dlState === "done" ? <Check className="w-4 h-4" />
            : dlState === "error" ? <X className="w-4 h-4" />
            : <Download className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  );
}

export default function FileCard({ file, onDownload, onFetchBlob }: Props) {
  if (file.mimeType.startsWith("image/")) {
    return <ImageCard file={file} onDownload={onDownload} onFetchBlob={onFetchBlob} />;
  }
  if (file.mimeType === "application/pdf") {
    return <PdfCard file={file} onDownload={onDownload} onFetchBlob={onFetchBlob} />;
  }

  const [state, setState] = useState<DownloadState>("idle");
  const isExpired = Date.now() > file.expiresAt;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  const handleDownload = async () => {
    if (state !== "idle" || isExpired) return;
    setState("loading");
    try {
      await onDownload(file.id, file.name, file.mimeType, totalChunks);
      setState("done");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-4 py-4 max-w-[280px] animate-fade-in"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--accent-light)", border: "1px solid var(--accent-mid)", color: "var(--accent)" }}
      >
        <FileIcon mime={file.mimeType} className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)", fontFamily: "var(--font-ui)" }}>{file.name}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {formatBytes(file.size)} · {formatTime(file.timestamp)}{isExpired && " · expired"}
        </p>
      </div>
      <button
        onClick={handleDownload}
        disabled={state !== "idle" || isExpired}
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
        style={isExpired
          ? { background: "var(--border-soft)", color: "var(--text-dim)", cursor: "not-allowed" }
          : state === "done" ? { background: "var(--accent-light)", color: "var(--accent)" }
          : state === "error" ? { background: "#FEE2E2", color: "var(--error)" }
          : state === "loading" ? { background: "var(--accent-light)", color: "var(--accent)", cursor: "wait" }
          : { background: "var(--accent)", color: "#fff" }
        }
      >
        {state === "loading"
          ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          : state === "done" ? <Check className="w-4 h-4" />
          : state === "error" ? <X className="w-4 h-4" />
          : <Download className="w-4 h-4" />
        }
      </button>
    </div>
  );
}

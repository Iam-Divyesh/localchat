import { useCallback, useState } from "react";
import { getSocket } from "../lib/socket";
import { splitFile, blobToArrayBuffer, assembleChunks } from "../lib/fileChunker";

export interface UploadProgress {
  fileId: string;
  name: string;
  sent: number;
  total: number;
  error?: string;
}

export function useFiles() {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  // roomId = channel name (e.g. "general") or DM room ID (e.g. "dm:alice:bob")
  const uploadFile = useCallback(async (file: File, roomId: string) => {
    const socket = getSocket();
    const chunks = splitFile(file);

    const res = await new Promise<{ ok: boolean; fileId?: string; error?: string }>((resolve) => {
      socket.emit("file:init", {
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        totalChunks: chunks.length,
        roomId,
      }, resolve);
    });

    if (!res.ok || !res.fileId) throw new Error(res.error ?? "Upload init failed");

    const { fileId } = res;
    setUploads((prev) => [...prev, { fileId, name: file.name, sent: 0, total: chunks.length }]);

    try {
      for (let i = 0; i < chunks.length; i++) {
        const ab = await blobToArrayBuffer(chunks[i]);
        socket.emit("file:chunk", { fileId, index: i, chunk: ab });
        setUploads((prev) => prev.map((u) => u.fileId === fileId ? { ...u, sent: i + 1 } : u));
        if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      setUploads((prev) => prev.map((u) => u.fileId === fileId ? { ...u, error: String(err) } : u));
      throw err;
    }

    setTimeout(() => setUploads((prev) => prev.filter((u) => u.fileId !== fileId)), 2000);
  }, []);

  // Fetches chunks and returns a blob: URL — caller must revoke it when done
  const fetchBlob = useCallback((fileId: string, mimeType: string, totalChunks: number): Promise<string> => {
    const socket = getSocket();
    return new Promise<string>((resolve, reject) => {
      socket.emit("file:download", fileId, (res: { ok: boolean; error?: string }) => {
        if (!res.ok) reject(new Error(res.error));
      });

      const receivedChunks: ArrayBuffer[] = [];
      let received = 0;

      let timer: ReturnType<typeof setTimeout>;

      const onChunk = (data: { fileId: string; index: number; chunk: ArrayBuffer; total: number }) => {
        if (data.fileId !== fileId) return;
        receivedChunks[data.index] = data.chunk;
        received += 1;
        if (received === totalChunks) {
          clearTimeout(timer);
          socket.off("file:chunk:recv", onChunk);
          resolve(URL.createObjectURL(assembleChunks(receivedChunks, mimeType)));
        }
      };

      socket.on("file:chunk:recv", onChunk);
      timer = setTimeout(() => {
        socket.off("file:chunk:recv", onChunk);
        reject(new Error("Timed out"));
      }, 30_000);
    });
  }, []);

  const downloadFile = useCallback(async (fileId: string, name: string, mimeType: string, totalChunks: number) => {
    const url = await fetchBlob(fileId, mimeType, totalChunks);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, [fetchBlob]);

  return { uploadFile, downloadFile, fetchBlob, uploads };
}

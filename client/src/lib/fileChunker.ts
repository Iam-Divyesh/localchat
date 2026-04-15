export const CHUNK_SIZE = 64 * 1024;
export const FILE_MESSAGE_PREFIX = "__file__:";

export function splitFile(file: File): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < file.size) {
    chunks.push(file.slice(offset, offset + CHUNK_SIZE));
    offset += CHUNK_SIZE;
  }
  return chunks;
}

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

export function assembleChunks(chunks: ArrayBuffer[], mimeType: string): Blob {
  return new Blob(chunks, { type: mimeType });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fileListToArray(fileList: FileList | null): File[] {
  return fileList ? Array.from(fileList) : [];
}

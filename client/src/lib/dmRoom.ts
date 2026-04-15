// Canonical DM room ID — must match server logic
export function dmRoomKey(a: string, b: string): string {
  return `dm:${[a, b].sort().join(":")}`;
}

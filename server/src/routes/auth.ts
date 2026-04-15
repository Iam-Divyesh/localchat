import { Router, Request, Response } from "express";
import {
  registerUser, loginUser, createSession,
  validateSession, deleteSession,
  updateUsername, updatePassword, resetPasswordByEmail,
} from "../db/database.js";

const router = Router();

// Simple in-memory rate limiter for login: 5 attempts per 15 min per IP
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { blocked: false, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT) {
    return { blocked: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

function clearRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

router.post("/register", (req: Request, res: Response) => {
  const { email, username, password } = req.body ?? {};

  if (!email || !username || !password)
    return res.status(400).json({ error: "email, username and password are required" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Invalid email address" });
  if (username.trim().length < 2)
    return res.status(400).json({ error: "Username must be at least 2 characters" });

  try {
    const user = registerUser(email, username.trim(), password);
    const token = createSession(user.id);
    return res.json({ ok: true, token, user: { email: user.email, username: user.username } });
  } catch (err: unknown) {
    const msg = (err as Error).message ?? "";
    if (msg.includes("UNIQUE")) {
      if (msg.includes("email")) return res.status(409).json({ error: "Email already registered" });
      if (msg.includes("username")) return res.status(409).json({ error: "Username already taken" });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", (req: Request, res: Response) => {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const { blocked, retryAfterSec } = checkRateLimit(ip);
  if (blocked) {
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({ error: `Too many login attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minutes.` });
  }

  const { email, password } = req.body ?? {};
  if (!email || !password)
    return res.status(400).json({ error: "email and password are required" });

  const user = loginUser(email, password);
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  clearRateLimit(ip);
  const token = createSession(user.id);
  return res.json({ ok: true, token, user: { email: user.email, username: user.username } });
});

router.post("/logout", (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) deleteSession(token);
  return res.json({ ok: true });
});

router.patch("/username", (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const user = validateSession(token);
  if (!user) return res.status(401).json({ error: "Session expired" });

  const { username } = req.body ?? {};
  if (!username || username.trim().length < 2)
    return res.status(400).json({ error: "Username must be at least 2 characters" });

  const result = updateUsername(user.id, username.trim());
  if (!result.ok) return res.status(409).json({ error: result.error });
  return res.json({ ok: true, username: username.trim() });
});

router.patch("/password", (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const user = validateSession(token);
  if (!user) return res.status(401).json({ error: "Session expired" });

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  if (newPassword.length < 6)
    return res.status(400).json({ error: "New password must be at least 6 characters" });

  const result = updatePassword(user.id, currentPassword, newPassword);
  if (!result.ok) return res.status(400).json({ error: result.error });
  return res.json({ ok: true });
});

router.post("/reset-password", (req: Request, res: Response) => {
  const { email, currentPassword, newPassword } = req.body ?? {};
  if (!email || !currentPassword || !newPassword)
    return res.status(400).json({ error: "email, currentPassword and newPassword are required" });
  if (newPassword.length < 6)
    return res.status(400).json({ error: "New password must be at least 6 characters" });

  const result = resetPasswordByEmail(email, currentPassword, newPassword);
  if (!result.ok) return res.status(400).json({ error: result.error });
  return res.json({ ok: true });
});

router.get("/me", (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const user = validateSession(token);
  if (!user) return res.status(401).json({ error: "Session expired or invalid" });
  return res.json({ ok: true, user: { email: user.email, username: user.username } });
});

export default router;

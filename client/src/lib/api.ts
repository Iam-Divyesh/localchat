const BASE = "/api/auth";

export interface AuthUser {
  email: string;
  username: string;
}

async function patch<T>(path: string, body: object, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach server.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error((data.error as string) ?? "Request failed");
  return data as T;
}

export interface AuthResult {
  ok: boolean;
  token: string;
  user: AuthUser;
}

async function post<T>(path: string, body: object, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach server. Make sure LocalChat server is running.");
  }

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new Error("Server returned an unexpected response. Is the server running?");
  }

  if (!res.ok) throw new Error((data.error as string) ?? "Request failed");
  return data as T;
}

export async function register(email: string, username: string, password: string): Promise<AuthResult> {
  return post("/register", { email, username, password });
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return post("/login", { email, password });
}

export async function logout(token: string): Promise<void> {
  await post("/logout", {}, token);
}

export async function changeUsername(token: string, username: string): Promise<{ ok: boolean; username: string }> {
  return patch("/username", { username }, token);
}

export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return patch("/password", { currentPassword, newPassword }, token);
}

export async function resetPassword(email: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return post("/reset-password", { email, currentPassword, newPassword });
}

export async function getMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

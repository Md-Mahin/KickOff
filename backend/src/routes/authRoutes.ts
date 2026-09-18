import { Router, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

import { pool } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
const jwtSecret = process.env.JWT_SECRET ??
  (process.env.NODE_ENV !== "production" ? "kickoff-local-development-secret" : undefined);
const sessionDays = 7;

type Credentials = { name: string; email: string; password: string };
type User = { id: number; name: string; email: string; role: "fan" | "admin" };

function setSessionCookie(res: Response, token: string) {
  res.setHeader("Set-Cookie", `kickoff_session=${token}; HttpOnly; Path=/; Max-Age=${sessionDays * 86400}; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

async function createSession(res: Response, user: User) {
  if (!jwtSecret) throw new Error("JWT_SECRET is not configured");
  const sessionId = randomUUID();
  try {
    await pool.query(
      `INSERT INTO UserSessions (SessionID, UserID, ExpiresAt)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '7 days')`,
      [sessionId, user.id]
    );
  } catch {
    // DB offline — continue and use stateless session
  }
  const token = jwt.sign(
    { sid: sessionId, role: user.role },
    jwtSecret,
    { subject: String(user.id), expiresIn: `${sessionDays}d` }
  );
  setSessionCookie(res, token);
  return { user };
}

function readCredentials(body: unknown): Credentials {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  return {
    name: typeof input.name === "string" ? input.name.trim() : "",
    email: typeof input.email === "string" ? input.email.trim().toLowerCase() : "",
    password: typeof input.password === "string" ? input.password : "",
  };
}

async function register(res: Response, credentials: Credentials, role: "fan" | "admin", teamIds: number[] = [], playerIds: number[] = []) {
  const { name, email, password } = credentials;
  if (!name || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 255 || password.length < 8 || password.length > 200) {
    return res.status(400).json({ message: "Enter a valid name, email address, and password of 8 to 200 characters." });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO Users (Username, Email, PasswordHash, Role)
       VALUES ($1, $2, $3, $4)
       RETURNING UserID AS "id", Username AS "name", Email AS "email", Role AS "role"`,
      [name, email, passwordHash, role]
    );
    const user = result.rows[0] as User;

    // Auto-create session so user is immediately logged in
    const sessionData = await createSession(res, user);

    // Save team preferences (best-effort — skip if DB issue or team not found)
    for (const teamId of teamIds) {
      try {
        await pool.query("INSERT INTO UserFollowsTeam (UserID, TeamID) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.id, teamId]);
      } catch {}
    }

    // Save player preferences (best-effort)
    for (const playerId of playerIds) {
      try {
        await pool.query("INSERT INTO UserFollowsPlayer (UserID, PlayerID) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.id, playerId]);
      } catch {}
    }

    return res.status(201).json(sessionData);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return res.status(409).json({ message: "An account with that name or email already exists." });
    console.error("Unable to create user:", error);
    return res.status(500).json({ message: "Unable to create your account. Please try again." });
  }
}

router.post("/register", (req, res) => {
  const teamIds = Array.isArray(req.body?.teamIds) ? (req.body.teamIds as unknown[]).map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
  const playerIds = Array.isArray(req.body?.playerIds) ? (req.body.playerIds as unknown[]).map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
  return register(res, readCredentials(req.body), "fan", teamIds, playerIds);
});

router.post("/bootstrap-admin", (req, res) => {
  const key = typeof req.body?.bootstrapKey === "string" ? req.body.bootstrapKey : "";
  if (!process.env.ADMIN_BOOTSTRAP_KEY || key !== process.env.ADMIN_BOOTSTRAP_KEY) return res.status(403).json({ message: "A valid administrator invite is required." });
  return register(res, readCredentials(req.body), "admin");
});

router.post("/login", async (req, res) => {
  const { email, password } = readCredentials(req.body);
  if (!email || !password) return res.status(400).json({ message: "Enter your email address and password." });
  try {
    const result = await pool.query(`SELECT UserID AS "id", Username AS "name", Email AS "email", PasswordHash AS "passwordHash", Role AS "role" FROM Users WHERE Email = $1`, [email]);
    const user = result.rows[0] as (User & { passwordHash: string }) | undefined;
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Incorrect email or password." });
    return res.json(await createSession(res, user));
  } catch (error) {
    console.error("Unable to sign in:", error);
    return res.status(500).json({ message: "Unable to sign in. Please try again." });
  }
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.auth }));

router.post("/logout", requireAuth, async (req, res) => {
  await pool.query("UPDATE UserSessions SET RevokedAt = CURRENT_TIMESTAMP WHERE SessionID = $1", [req.auth!.sessionId]);
  res.setHeader("Set-Cookie", "kickoff_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  return res.status(204).send();
});

export default router;

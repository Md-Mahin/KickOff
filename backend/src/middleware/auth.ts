
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { pool } from "../db";

export type UserRole = "fan" | "admin";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: number; sessionId: string; role: UserRole; name: string; email: string };
    }
  }
}

const jwtSecret = process.env.JWT_SECRET ??
  (process.env.NODE_ENV !== "production" ? "kickoff-local-development-secret" : undefined);

function getToken(req: Request) {
  const cookieToken = req.headers.cookie?.match(/(?:^|; )kickoff_session=([^;]+)/)?.[1];
  const header = req.headers.authorization;
  return cookieToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
}

async function loadSessionUser(userId: number, sessionId: string) {
  const result = await pool.query(
    `SELECT u.UserID AS "userId", u.Username AS name, u.Email AS email,
            u.Role AS role, s.SessionID AS "sessionId"
     FROM Users u
     JOIN UserSessions s ON s.UserID = u.UserID
     WHERE u.UserID = $1 AND s.SessionID = $2
       AND s.RevokedAt IS NULL AND s.ExpiresAt > CURRENT_TIMESTAMP
     LIMIT 1`,
    [userId, sessionId]
  );
  const user = result.rows[0];
  if (!user || !["fan", "admin"].includes(user.role)) return null;
  return {
    userId: Number(user.userId),
    sessionId: String(user.sessionId),
    role: user.role as UserRole,
    name: String(user.name),
    email: String(user.email),
  };
}

/** Verify the signed token, then resolve account, role and active session from PostgreSQL. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!jwtSecret) return res.status(500).json({ message: "Authentication is not configured." });
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: "Authentication required." });

  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    const sessionId = typeof payload.sid === "string" ? payload.sid : "";
    const userId = Number(payload.sub);

    if (!sessionId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Session is invalid or expired." });
    }

    try {
      const user = await loadSessionUser(userId, sessionId);
      if (!user) {
        return res.status(401).json({ message: "Session has been revoked. Please sign in again." });
      }
      req.auth = user;
      return next();
    } catch (error) {
      console.error("Unable to verify account session in PostgreSQL:", error);
      return res.status(503).json({ message: "Account verification is temporarily unavailable." });
    }
  } catch {
    return res.status(401).json({ message: "Session is invalid or expired." });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ message: "Authentication required." });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ message: "You do not have permission for this action." });
    return next();
  };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  if (!jwtSecret) return next();
  const token = getToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    const sessionId = typeof payload.sid === "string" ? payload.sid : "";
    const userId = Number(payload.sub);

    if (sessionId && Number.isInteger(userId) && userId > 0) {
      try {
        req.auth = await loadSessionUser(userId, sessionId) ?? undefined;
      } catch {
        // Optional authentication fails closed when PostgreSQL cannot verify the account.
      }
    }
  } catch {
    // Invalid token — continue as unauthenticated
  }

  return next();
}

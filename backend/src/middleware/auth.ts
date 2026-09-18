import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { pool } from "../db";

export type UserRole = "fan" | "admin";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: number; sessionId: string; role: UserRole };
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

/**
 * Verify the JWT and set req.auth.
 * Role is read directly from the JWT payload — no DB lookup needed.
 * DB is only consulted (best-effort) to check if the session was revoked.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!jwtSecret) return res.status(500).json({ message: "Authentication is not configured." });
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: "Authentication required." });

  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    const sessionId = typeof payload.sid === "string" ? payload.sid : "";
    const userId = Number(payload.sub);
    const role = typeof payload.role === "string" ? payload.role as UserRole : undefined;

    if (!sessionId || !Number.isInteger(userId) || !role || !["fan", "admin"].includes(role)) {
      return res.status(401).json({ message: "Session is invalid or expired." });
    }

    // Best-effort revocation check — skipped silently if DB is offline
    try {
      const result = await pool.query(
        `SELECT 1 FROM UserSessions WHERE SessionID = $1 AND RevokedAt IS NOT NULL`,
        [sessionId]
      );
      if (result.rows.length > 0) {
        return res.status(401).json({ message: "Session has been revoked. Please sign in again." });
      }
    } catch {
      // DB offline — trust the JWT signature
    }

    req.auth = { userId, sessionId, role };
    return next();
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
    const role = typeof payload.role === "string" ? payload.role as UserRole : undefined;

    if (sessionId && Number.isInteger(userId) && role && ["fan", "admin"].includes(role)) {
      // Best-effort revocation check
      try {
        const revoked = await pool.query(
          `SELECT 1 FROM UserSessions WHERE SessionID = $1 AND RevokedAt IS NOT NULL`,
          [sessionId]
        );
        if (revoked.rows.length === 0) {
          req.auth = { userId, sessionId, role };
        }
      } catch {
        // DB offline — trust the JWT
        req.auth = { userId, sessionId, role };
      }
    }
  } catch {
    // Invalid token — continue as unauthenticated
  }

  return next();
}

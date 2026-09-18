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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!jwtSecret) return res.status(500).json({ message: "Authentication is not configured." });
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    const sessionId = typeof payload.sid === "string" ? payload.sid : "";
    const userId = Number(payload.sub);
    if (!sessionId || !Number.isInteger(userId)) throw new Error("Invalid session");
    const result = await pool.query(
      `SELECT u.UserID AS "userId", u.Role AS "role"
       FROM UserSessions s JOIN Users u ON u.UserID = s.UserID
       WHERE s.SessionID = $1 AND s.UserID = $2
         AND s.RevokedAt IS NULL AND s.ExpiresAt > CURRENT_TIMESTAMP`,
      [sessionId, userId]
    );
    const user = result.rows[0] as { userId: number; role: UserRole } | undefined;
    if (!user || !["fan", "admin"].includes(user.role)) return res.status(401).json({ message: "Session is invalid or expired." });
    req.auth = { userId: user.userId, sessionId, role: user.role };
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
    if (!sessionId || !Number.isInteger(userId)) return next();

    const result = await pool.query(
      `SELECT u.UserID AS "userId", u.Role AS "role"
       FROM UserSessions s JOIN Users u ON u.UserID = s.UserID
       WHERE s.SessionID = $1 AND s.UserID = $2
         AND s.RevokedAt IS NULL AND s.ExpiresAt > CURRENT_TIMESTAMP`,
      [sessionId, userId]
    );
    const user = result.rows[0] as { userId: number; role: UserRole } | undefined;
    if (user && ["fan", "admin"].includes(user.role)) {
      req.auth = { userId: user.userId, sessionId, role: user.role };
    }
  } catch {
    // Public endpoints continue without personalization ...............
  }

  return next();
}

// this is the ai written code. of auth.ts now I want to write it with my own hand now guide me from the scratch of this portion what am I going to write and what I need to write in Bangla step by step and the reason and concept behind those its not neccessary the code I wlill write willl be same to same as the code I have just given you. I will write a code myself that looks like a human written code

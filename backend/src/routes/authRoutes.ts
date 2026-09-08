import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { pool } from "../db";

const router = Router();
const jwtSecret =
  process.env.JWT_SECRET ??
  (process.env.NODE_ENV !== "production" ? "kickoff-local-development-secret" : undefined);

router.post("/register", async (req, res) => {
  const username = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!username || username.length > 100 || !email || email.length > 255 || password.length < 8) {
    return res.status(400).json({
      message: "Enter a name, a valid email address, and a password of at least 8 characters.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO Users (Username, Email, PasswordHash)
       VALUES ($1, $2, $3)
       RETURNING UserID, Username, Email, CreatedAt`,
      [username, email, passwordHash]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return res.status(409).json({ message: "An account with that name or email already exists." });
    }

    console.error("Unable to create user:", error);
    return res.status(500).json({ message: "Unable to create your account. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "Enter your email address and password." });
  }

  if (!jwtSecret) {
    console.error("JWT_SECRET must be configured before users can sign in.");
    return res.status(500).json({ message: "Sign-in is not configured yet." });
  }

  try {
    const result = await pool.query(
      `SELECT UserID AS "id", Username AS "name", Email AS "email", PasswordHash AS "passwordHash"
       FROM Users
       WHERE Email = $1`,
      [email]
    );
    const user = result.rows[0] as
      | { id: number; name: string; email: string; passwordHash: string }
      | undefined;

    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Unable to sign in:", error);
    return res.status(500).json({ message: "Unable to sign in. Please try again." });
  }
});

export default router;

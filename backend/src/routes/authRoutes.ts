import { Router } from "express";
import bcrypt from "bcrypt";

import { pool } from "../db";

const router = Router();

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

export default router;

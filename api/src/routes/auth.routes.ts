import bcrypt from "bcryptjs";
import { Router } from "express";
import { query } from "../config/db";
import { signAccessToken } from "../utils/jwt";

const authRouter = Router();

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
};

authRouter.post("/register", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ message: "username and password are required." });
    return;
  }

  const normalizedUsername = username.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username`,
      [normalizedUsername, passwordHash]
    );

    const user = result.rows[0] as { id: number; username: string };
    res.status(201).json({ id: user.id, username: user.username });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      res.status(409).json({ message: "Username is already taken." });
      return;
    }
    res.status(500).json({ message: "Registration failed." });
  }
});

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ message: "username and password are required." });
    return;
  }

  const normalizedUsername = username.trim().toLowerCase();
  const result = await query<UserRow>(
    `SELECT id, username, password_hash
     FROM users
     WHERE username = $1`,
    [normalizedUsername]
  );

  const user = result.rows[0];
  if (!user) {
    res.status(401).json({ message: "Invalid credentials." });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    res.status(401).json({ message: "Invalid credentials." });
    return;
  }

  const accessToken = signAccessToken({
    sub: String(user.id),
    username: user.username
  });

  res.json({
    accessToken,
    tokenType: "Bearer"
  });
});

export default authRouter;

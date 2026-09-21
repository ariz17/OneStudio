import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../lib/hash.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../lib/jwt.js";
import { setAuthCookies } from "../lib/cookies.js";

/* REGISTER */
export const register = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedEmail, mode: "insensitive" } },
          { username: { equals: cleanUsername, mode: "insensitive" } },
        ],
      },
    });

    if (existingUser) {
      const field = existingUser.email.toLowerCase() === normalizedEmail ? "Email" : "Username";
      return res.status(409).json({ message: `${field} is already in use` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email: normalizedEmail, username: cleanUsername, password: hashedPassword },
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
};

/* LOGIN */
export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });

  setAuthCookies(res, accessToken, refreshToken);
  res.json({ success: true });
};

/* REFRESH */
export const refresh = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "No refresh token" });

  const tokenHash = hashToken(token);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!stored)
    return res.status(403).json({ message: "Token revoked" });

  try {
    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    return res.status(403).json({ message: "Invalid refresh token" });
  }

  // rotate
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const newAccessToken = generateAccessToken(stored.userId);
  const newRefreshToken = generateRefreshToken(stored.userId);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(newRefreshToken),
      userId: stored.userId,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });

  setAuthCookies(res, newAccessToken, newRefreshToken);
  res.json({ success: true });
};

/* LOGOUT */
export const logout = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (token) {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  const IS_PROD = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
  };
  res.clearCookie("accessToken", cookieOpts);
  res.clearCookie("refreshToken", cookieOpts);
  res.json({ success: true });
};

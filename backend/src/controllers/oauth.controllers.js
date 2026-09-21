import { generateAccessToken, generateRefreshToken } from "../lib/jwt.js";
import { setAuthCookies } from "../lib/cookies.js";
import { hashToken } from "../lib/hash.js";
import { prisma } from "../lib/prisma.js";

export const oauthSuccess = async (req, res) => {
  const user = req.user;

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

  // Pass tokens in URL fragment (#) so the client can store them
  // Fragments are NOT sent to the server, keeping them secure
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  res.redirect(`${clientUrl}/auth/callback#access=${accessToken}&refresh=${refreshToken}`);
};

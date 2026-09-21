import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token)
    return res.status(401).json({ message: "Not authenticated" });

  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: "Token expired" });
  }
};

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as DiscordStrategy } from "passport-discord-auth";
import { prisma } from "./prisma.js";

async function generateUniqueUsername(preferredName) {
  // Strip whitespace and special characters
  const sanitized = (preferredName || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "");
  const base = (sanitized || "user").slice(0, 20);

  let candidate = base;
  let attempts = 0;

  while (attempts < 15) {
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
    });
    if (!exists) return candidate;

    // Append 4 random digits if base username is already taken
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    candidate = `${base.slice(0, 15)}_${randomSuffix}`;
    attempts++;
  }

  return `${base.slice(0, 10)}_${Date.now()}`;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const rawEmail = profile.emails?.[0]?.value;
        if (!rawEmail) return done(new Error("Email not provided"), false);
        const email = rawEmail.toLowerCase().trim();

        let user = await prisma.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
        });

        const originalName = (profile.displayName || profile.name?.givenName || email.split("@")[0] || "User").trim();

        if (!user) {
          const username = await generateUniqueUsername(originalName);
          const avatar = profile.photos?.[0]?.value || null;

          user = await prisma.user.create({
            data: {
              name: originalName,
              email,
              username,
              password: "oauth", // required by schema
              ...(avatar ? { avatar } : {}),
            },
          });
        } else if (!user.name) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name: originalName },
          });
        }

        done(null, user);
      } catch (err) {
        done(err, false);
      }
    }
  )
);

passport.use(
  new DiscordStrategy(
    {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackUrl: process.env.DISCORD_CALLBACK_URL,
      scope: ["identify", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const rawEmail = profile.email;
        if (!rawEmail)
          return done(new Error("Discord email missing"), false);
        const email = rawEmail.toLowerCase().trim();

        let user = await prisma.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
        });

        const originalName = (profile.global_name || profile.username || email.split("@")[0] || "User").trim();

        if (!user) {
          const username = await generateUniqueUsername(originalName);
          const avatar = profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null;

          user = await prisma.user.create({
            data: {
              name: originalName,
              email,
              username,
              password: "oauth",
              ...(avatar ? { avatar } : {}),
            },
          });
        } else if (!user.name) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { name: originalName },
          });
        }

        done(null, user);
      } catch (err) {
        done(err, false);
      }
    }
  )
);

export default passport;

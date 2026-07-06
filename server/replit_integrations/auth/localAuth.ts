import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db } from "../../db";
import { users } from "@shared/models/auth";
import { eq, sql as dsql } from "drizzle-orm";
import { isSuperAdminEmail } from "../../super-admin-allowlist";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Attach req.user in the shape the rest of the app expects ({ claims: { sub } })
  app.use((req: any, _res, next) => {
    if (req.session?.userId) {
      req.user = { claims: { sub: req.session.userId }, id: req.session.userId };
    }
    next();
  });

  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || typeof email !== "string" || !password || typeof password !== "string") {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const [user] = await db.select().from(users)
        .where(dsql`lower(${users.email}) = ${normalizedEmail}`)
        .limit(1);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Bootstrap: an allowlisted super admin with no password yet may log in
      // with SUPER_ADMIN_INITIAL_PASSWORD (becomes their temp password, forced change).
      if (!user.passwordHash) {
        const bootstrapPassword = process.env.SUPER_ADMIN_INITIAL_PASSWORD;
        if (
          bootstrapPassword &&
          bootstrapPassword.length >= 8 &&
          user.email &&
          isSuperAdminEmail(user.email) &&
          password === bootstrapPassword
        ) {
          const hash = await bcrypt.hash(bootstrapPassword, 10);
          await db.update(users)
            .set({ passwordHash: hash, mustChangePassword: true, updatedAt: new Date() })
            .where(eq(users.id, user.id));
          user.passwordHash = hash;
          user.mustChangePassword = true;
        } else {
          return res.status(401).json({ message: "Invalid email or password" });
        }
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Super admin allowlist: deterministic elevation on every login
      if (user.email && isSuperAdminEmail(user.email) && !user.isSuperAdmin) {
        await db.update(users).set({ isSuperAdmin: true, updatedAt: new Date() }).where(eq(users.id, user.id));
        user.isSuperAdmin = true;
      }

      await new Promise<void>((resolve, reject) =>
        req.session.regenerate((err: any) => (err ? reject(err) : resolve()))
      );
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err: any) => (err ? reject(err) : resolve()))
      );

      const { passwordHash, ...safeUser } = user;
      res.json(safeUser);
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  const doLogout = (req: any, res: any, redirect: boolean) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      if (redirect) res.redirect("/");
      else res.json({ success: true });
    });
  };
  app.post("/api/auth/logout", (req: any, res) => doLogout(req, res, false));
  app.get("/api/logout", (req: any, res) => doLogout(req, res, true));

  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.passwordHash) {
        return res.status(400).json({ message: "Password login is not set up for this account" });
      }
      // If the user is not in a forced-change state, require the current password
      if (!user.mustChangePassword) {
        if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }
      if (newPassword === currentPassword || (await bcrypt.compare(newPassword, user.passwordHash))) {
        return res.status(400).json({ message: "New password must be different from the current password" });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await db.update(users)
        .set({ passwordHash: hash, mustChangePassword: false, updatedAt: new Date() })
        .where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Change password error:", err);
      res.status(500).json({ message: "Failed to change password" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  if (req.session?.userId) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7);
    try {
      const { createHash } = await import("crypto");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const { storage } = await import("../../storage");
      const apiToken = await storage.getApiTokenByHash(tokenHash);
      if (!apiToken || apiToken.revokedAt) {
        return res.status(401).json({ message: "Invalid or revoked API token" });
      }
      if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
        return res.status(401).json({ message: "API token expired" });
      }
      storage.updateApiTokenLastUsed(apiToken.id).catch(() => {});
      (req as any).user = {
        claims: { sub: apiToken.userId },
        id: apiToken.userId,
      };
      (req as any).apiTokenTenantId = apiToken.tenantId;
      (req as any).isApiToken = true;
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

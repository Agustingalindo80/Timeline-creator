import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./localAuth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user (never expose the password hash)
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const { passwordHash, ...safeUser } = user as any;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

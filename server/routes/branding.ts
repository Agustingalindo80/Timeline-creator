import type { Express } from "express";
import path from "path";
import fs from "fs";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { upload, uploadsDir } from "./helpers";

export function registerBrandingRoutes(app: Express) {
  app.get("/api/branding", async (req, res) => {
    try {
      const branding = await storage.getBranding(req.tenantId || "default");
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/branding", requireModuleAccess("admin"), requirePermission("org.settings.manage"), async (req, res) => {
    try {
      const fields = [
        "appName", "logoUrl", "faviconUrl", "primaryColor",
        "sidebarColor", "sidebarForegroundColor", "sidebarAccentColor", "accentColor",
      ];
      const updates: any = {};
      for (const field of fields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      const branding = await storage.updateBranding(updates, req.tenantId || "default");
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/branding/logo", requireModuleAccess("admin"), requirePermission("org.settings.manage"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `logo-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      const url = `/uploads/${filename}`;
      const branding = await storage.updateBranding({ logoUrl: url }, req.tenantId || "default");
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/branding/favicon", requireModuleAccess("admin"), requirePermission("org.settings.manage"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `favicon-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      const url = `/uploads/${filename}`;
      const branding = await storage.updateBranding({ faviconUrl: url }, req.tenantId || "default");
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}

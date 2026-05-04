import type { Express } from "express";
import { storage } from "../storage";
import { requirePermission } from "../middleware/permissions";

export function registerRateCardRoutes(app: Express) {
  app.get("/api/rate-cards", async (req, res) => {
    try {
      const cards = await storage.getRateCards(req.tenantId);
      res.json(cards);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/rate-cards", requirePermission("rates.edit"), async (req, res) => {
    try {
      const { name, role, region, costRate, billRate } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
      const card = await storage.createRateCard({
        tenantId: req.tenantId || "default",
        name: name.trim(),
        role: role || null,
        region: region || null,
        costRate: costRate || null,
        billRate: billRate || null,
      });
      res.status(201).json(card);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/rate-cards/:id", requirePermission("rates.edit"), async (req, res) => {
    try {
      const { name, role, region, costRate, billRate } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (region !== undefined) updates.region = region;
      if (costRate !== undefined) updates.costRate = costRate;
      if (billRate !== undefined) updates.billRate = billRate;
      const card = await storage.updateRateCard(req.params.id, req.tenantId || "default", updates);
      if (!card) return res.status(404).json({ message: "Rate card not found" });
      res.json(card);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/rate-cards/:id", requirePermission("rates.edit"), async (req, res) => {
    try {
      await storage.deleteRateCard(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}

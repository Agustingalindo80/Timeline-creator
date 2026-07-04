import type { Express } from "express";
import { storage } from "../storage";
import { requireModuleAccess } from "../middleware/permissions";
import { getRecordAccessContext } from "./helpers";

export function registerClientRoutes(app: Express) {
  app.get("/api/clients", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (ctx.isGlobal) {
        const clients = await storage.getClients(req.tenantId);
        return res.json(clients);
      }
      const clients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (!ctx.isGlobal) {
        const accessibleClients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
        if (!accessibleClients.some(c => c.id === req.params.id)) {
          return res.status(403).json({ message: "You don't have access to this client" });
        }
      }
      const client = await storage.getClientWithProjects(req.params.id, req.tenantId || "default");
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients", requireModuleAccess("clients"), async (req, res) => {
    try {
      const { name, industry, country, segment, contactPhone, website, address, notes, status } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Client name is required" });
      }
      const client = await storage.createClient({
        tenantId: req.tenantId || "default",
        name: name.trim(),
        industry: industry || null,
        country: country || null,
        segment: segment || null,
        contactPhone: contactPhone || null,
        website: website || null,
        address: address || null,
        notes: notes || null,
        status: status || "active",
      });
      res.status(201).json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/clients/:id", requireModuleAccess("clients"), async (req, res) => {
    try {
      const { name, industry, country, segment, contactPhone, website, address, notes, status } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (industry !== undefined) updates.industry = industry;
      if (country !== undefined) updates.country = country;
      if (segment !== undefined) updates.segment = segment;
      if (contactPhone !== undefined) updates.contactPhone = contactPhone;
      if (website !== undefined) updates.website = website;
      if (address !== undefined) updates.address = address;
      if (notes !== undefined) updates.notes = notes;
      if (status !== undefined) updates.status = status;

      const client = await storage.updateClient(req.params.id, req.tenantId || "default", updates);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/clients/:id", requireModuleAccess("clients"), async (req, res) => {
    try {
      await storage.deleteClient(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}

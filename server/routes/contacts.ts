import type { Express } from "express";
import { storage } from "../storage";
import { requireModuleAccess } from "../middleware/permissions";
import { getRecordAccessContext } from "./helpers";

export function registerContactRoutes(app: Express) {
  app.get("/api/contacts", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (ctx.isGlobal) {
        const allContacts = await storage.getAllContacts(req.tenantId);
        return res.json(allContacts);
      }
      const accessibleClients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
      const clientIds = accessibleClients.map(c => c.id);
      const contacts = await storage.getContactsByClientIds(clientIds);
      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clients/:clientId/contacts", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      if (!ctx.isGlobal) {
        const accessibleClients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
        if (!accessibleClients.some(c => c.id === req.params.clientId)) {
          return res.status(403).json({ message: "You don't have access to this client's contacts" });
        }
      }
      const contacts = await storage.getContacts(req.params.clientId, req.tenantId || "default");
      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const ctx = await getRecordAccessContext(req);
      if (!ctx) return res.status(401).json({ message: "Authentication required" });
      const contact = await storage.getContact(req.params.id, req.tenantId || "default");
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (!ctx.isGlobal) {
        const accessibleClients = await storage.getClientsByTimelineIds(ctx.assignedTimelineIds);
        if (!accessibleClients.some(c => c.id === contact.clientId)) {
          return res.status(403).json({ message: "You don't have access to this contact" });
        }
      }
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clients/:clientId/contacts", requireModuleAccess("contacts"), async (req, res) => {
    try {
      const { firstName, lastName, email, phone, role, stakeholderType, isLegalRepresentative } = req.body;
      if (!firstName?.trim() || !lastName?.trim()) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      const contact = await storage.createContact({
        tenantId: req.tenantId || "default",
        clientId: req.params.clientId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email || null,
        phone: phone || null,
        role: role || null,
        stakeholderType: Array.isArray(stakeholderType) ? stakeholderType : null,
        isLegalRepresentative: isLegalRepresentative ?? false,
      });
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/contacts/:id", requireModuleAccess("contacts"), async (req, res) => {
    try {
      const { firstName, lastName, email, phone, role, stakeholderType, isLegalRepresentative } = req.body;
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (stakeholderType !== undefined) updates.stakeholderType = Array.isArray(stakeholderType) ? stakeholderType : null;
      if (isLegalRepresentative !== undefined) updates.isLegalRepresentative = isLegalRepresentative;

      const contact = await storage.updateContact(req.params.id, req.tenantId || "default", updates);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/contacts/:id", requireModuleAccess("contacts"), async (req, res) => {
    try {
      await storage.deleteContact(req.params.id, req.tenantId || "default");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}

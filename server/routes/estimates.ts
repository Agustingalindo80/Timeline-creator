import type { Express } from "express";
import * as XLSX from "xlsx";
import { storage } from "../storage";
import { requirePermission, requireModuleAccess } from "../middleware/permissions";
import { upload } from "./helpers";
import { importEstimate } from "../services/estimate-import";

export function registerEstimateRoutes(app: Express) {
  app.get("/api/estimate-template", async (req, res) => {
    try {
      const allRateCards = await storage.getRateCards(req.tenantId);
      const templateData = [
        { Phase: "Discovery", Workstream: "Requirements Gathering", "Duration (Weeks)": 4, Confidence: "high", "Role / Rate Card": "Senior Developer", "Hours Per Week": 40, "Task Type": "Functional" },
        { Phase: "Discovery", Workstream: "Requirements Gathering", "Duration (Weeks)": 4, Confidence: "high", "Role / Rate Card": "Business Analyst", "Hours Per Week": 20, "Task Type": "Functional" },
        { Phase: "Build", Workstream: "Backend Development", "Duration (Weeks)": 8, Confidence: "medium", "Role / Rate Card": "Senior Developer", "Hours Per Week": 40, "Task Type": "Technical" },
        { Phase: "Build", Workstream: "Frontend Development", "Duration (Weeks)": 6, Confidence: "medium", "Role / Rate Card": "Senior Developer", "Hours Per Week": 40, "Task Type": "Technical" },
        { Phase: "Build", Workstream: "QA & Testing", "Duration (Weeks)": 4, Confidence: "low", "Role / Rate Card": "QA Engineer", "Hours Per Week": 30, "Task Type": "QA" },
        { Phase: "Deployment", Workstream: "Go-Live Support", "Duration (Weeks)": 2, Confidence: "medium", "Role / Rate Card": "Project Manager", "Hours Per Week": 20, "Task Type": "PM" },
      ];

      const rateCardRef = allRateCards.map(rc => ({
        Name: rc.name,
        Role: rc.role || "",
        Region: rc.region || "",
        "Cost Rate ($/hr)": rc.costRate || "",
        "Bill Rate ($/hr)": rc.billRate || "",
      }));

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(templateData);
      ws1["!cols"] = [
        { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, "Estimate Template");

      const ws2 = XLSX.utils.json_to_sheet(rateCardRef.length > 0 ? rateCardRef : [{ Name: "(No rate cards configured yet)", Role: "", Region: "", "Cost Rate ($/hr)": "", "Bill Rate ($/hr)": "" }]);
      ws2["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Rate Cards (Reference)");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Disposition", 'attachment; filename="estimate-template.xlsx"');
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/timelines/:id/import-estimate", requirePermission("estimate.edit"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const result = await importEstimate(req.file.buffer, req.params.id, req.tenantId || "default");
      res.json(result);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ message: err.message });
    }
  });

  app.post("/api/parse-excel", requireModuleAccess("projects"), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ message: "Empty spreadsheet" });
      }

      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        return res.status(400).json({ message: "No data rows found" });
      }

      const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().trim());

      const titleCol = headers.find((h) =>
        ["title", "name", "milestone", "stage", "event", "phase"].includes(h)
      );
      const dateCol = headers.find((h) =>
        ["date", "time", "when", "start", "start date", "start_date", "period"].includes(h)
      );
      const descCol = headers.find((h) =>
        ["description", "desc", "details", "notes", "note", "info"].includes(h)
      );

      if (!titleCol && !dateCol) {
        return res.status(400).json({
          message: "Could not find Title or Date columns. Expected column headers like: Title, Date, Description",
        });
      }

      const originalHeaders = Object.keys(rows[0]);
      const getOriginalHeader = (lowerKey: string | undefined) => {
        if (!lowerKey) return undefined;
        return originalHeaders.find((h) => h.toLowerCase().trim() === lowerKey);
      };

      const titleHeader = getOriginalHeader(titleCol);
      const dateHeader = getOriginalHeader(dateCol);
      const descHeader = getOriginalHeader(descCol);

      const parsedMilestones = rows
        .map((row) => ({
          title: titleHeader ? String(row[titleHeader] || "").trim() : "",
          date: dateHeader ? String(row[dateHeader] || "").trim() : "",
          description: descHeader ? String(row[descHeader] || "").trim() : "",
        }))
        .filter((m) => m.title || m.date);

      res.json({
        title: sheetName !== "Sheet1" ? sheetName : undefined,
        milestones: parsedMilestones,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to parse file: " + err.message });
    }
  });
}

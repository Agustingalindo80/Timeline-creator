import type { Express } from "express";
import OpenAI from "openai";
import { storage } from "../storage";
import { requireModuleAccess } from "../middleware/permissions";

export function registerCoachRoutes(app: Express) {
  app.post("/api/chat", requireModuleAccess("coach"), async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array is required" });
      }

      const stages = await storage.getFlightpathStages(req.tenantId || "default");
      const sortedStages = stages.sort((a, b) => a.sortOrder - b.sortOrder);
      const tenantSettings = await storage.getSettings(req.tenantId || "default");
      const tenantLocale = tenantSettings?.locale || "en";
      const { getGovernanceLabel } = await import("@shared/terminology");
      const govLabel = getGovernanceLabel(tenantSettings?.governanceModelLabel, tenantLocale as "en" | "es" | "pt");
      const localeInstruction = tenantLocale !== "en" ? `\nIMPORTANT: Respond in ${tenantLocale === "es" ? "Spanish" : "Portuguese"}. The tenant's language is set to ${tenantLocale}.\n` : "";
      let frameworkContext = `You are the ${govLabel} Governance Coach — an AI assistant that helps project managers navigate the ${govLabel} governance framework.\n${localeInstruction}\n`;
      frameworkContext += `IMPORTANT: In all user-facing responses, refer to the governance lifecycle as "${govLabel}". Do not use the term "FlightPath".\n\n`;
      frameworkContext += `## ${govLabel} Framework Overview\n`;
      frameworkContext += `The ${govLabel} is a 5-stage project governance framework (Stage 0 through Stage 4) that guides projects from initial value framing through to value realization and evolution.\n\n`;

      for (const stage of sortedStages) {
        const deliverables = await storage.getStageDeliverables(stage.id, req.tenantId || "default");
        frameworkContext += `### Stage ${stage.stageNumber}: ${stage.name}\n`;
        frameworkContext += `- **Goal**: ${stage.goal}\n`;
        if (stage.description) frameworkContext += `- **Description**: ${stage.description}\n`;
        frameworkContext += `- **Gate**: ${stage.gateName}\n`;
        if (stage.gateDescription) frameworkContext += `- **Gate Criteria**: ${stage.gateDescription}\n`;
        if (stage.playbookPurpose) frameworkContext += `- **Playbook Purpose**: ${stage.playbookPurpose}\n`;
        if (stage.playbookExitBundle) frameworkContext += `- **Exit Bundle**: ${stage.playbookExitBundle}\n`;

        if (deliverables.length > 0) {
          frameworkContext += `- **Deliverables** (${deliverables.length}):\n`;
          for (const d of deliverables.sort((a, b) => a.sortOrder - b.sortOrder)) {
            frameworkContext += `  - ${d.name}`;
            if (d.description) frameworkContext += `: ${d.description}`;
            if (d.raciData && Object.keys(d.raciData).length > 0) {
              const raciStr = Object.entries(d.raciData).map(([role, resp]) => `${role}=${resp}`).join(", ");
              frameworkContext += ` [RACI: ${raciStr}]`;
            }
            frameworkContext += "\n";
          }
        }
        frameworkContext += "\n";
      }

      frameworkContext += `## Your Role
- Answer questions about the ${govLabel} framework, stages, gates, deliverables, and RACI responsibilities
- Guide PMs through their current stage and explain what's needed
- Recommend next actions and warn about common failure modes
- Explain gate criteria and what it takes to pass each gate
- Help PMs understand RACI roles and accountability
- Be specific, actionable, and reference actual framework deliverables and stages
- Keep responses focused and practical — you're a governance coach, not a general assistant
- Always refer to the governance framework as "${govLabel}" — never use the term "FlightPath" in your responses`;

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: frameworkContext },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        max_completion_tokens: 8192,
      });

      const reply = response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
      res.json({ response: reply });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}

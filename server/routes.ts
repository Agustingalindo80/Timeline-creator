import type { Express } from "express";
import { type Server } from "http";
import express from "express";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { tenantContext } from "./middleware/tenant";
import { seedFlightpathData } from "./seed-flightpath";
import { uploadsDir } from "./routes/helpers";

import { registerBrandingRoutes } from "./routes/branding";
import { registerClientRoutes } from "./routes/clients";
import { registerContactRoutes } from "./routes/contacts";
import { registerTimelineRoutes } from "./routes/timelines";
import { registerTimesheetRoutes } from "./routes/timesheets";
import { registerProgressRoutes } from "./routes/progress";
import { registerRiskRoutes } from "./routes/risks";
import { registerTeamMemberRoutes } from "./routes/team-members";
import { registerRateCardRoutes } from "./routes/rate-cards";
import { registerProjectTeamRoutes } from "./routes/project-team";
import { registerSettingsRoutes } from "./routes/settings";
import { registerEstimateRoutes } from "./routes/estimates";
import { registerGovernanceRoutes } from "./routes/governance";
import { registerCoachRoutes } from "./routes/coach";
import { registerWorkstreamResourceRoutes } from "./routes/workstream-resources";
import { registerOpportunityRoutes } from "./routes/opportunities";
import { registerRbacRoutes } from "./routes/rbac";
import { registerEvmRoutes } from "./routes/evm";
import { registerTenantRoutes } from "./routes/tenant";
import { registerGlobalAdminRoutes } from "./routes/global-admin";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/uploads", express.static(uploadsDir));

  app.use((req, _res, next) => {
    const match = req.path.match(/^\/t\/([a-z0-9-]+)(\/api\/.*)$/);
    if (match) {
      req.url = match[2];
    }
    next();
  });

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    const publicPaths = ["/api/login", "/api/logout", "/api/callback", "/api/auth/user", "/api/branding"];
    if (publicPaths.includes(req.path)) return next();
    return isAuthenticated(req, res, next);
  });

  app.use(tenantContext());

  registerBrandingRoutes(app);
  registerClientRoutes(app);
  registerContactRoutes(app);
  registerTimelineRoutes(app);
  registerTimesheetRoutes(app);
  registerProgressRoutes(app);
  registerRiskRoutes(app);
  registerTeamMemberRoutes(app);
  registerRateCardRoutes(app);
  registerProjectTeamRoutes(app);
  registerSettingsRoutes(app);
  registerEstimateRoutes(app);
  registerGovernanceRoutes(app);
  registerCoachRoutes(app);
  registerWorkstreamResourceRoutes(app);
  registerOpportunityRoutes(app);
  registerRbacRoutes(app);
  registerEvmRoutes(app);
  registerTenantRoutes(app);
  registerGlobalAdminRoutes(app);

  seedFlightpathData().catch(err => console.error("FlightPath seed error:", err));

  return httpServer;
}

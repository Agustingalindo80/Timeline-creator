import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBranding } from "@/components/branding-provider";
import { useAppTitle } from "@/hooks/use-app-title";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Users,
  Clock,
  TrendingUp,
  BarChart3,
  Shield,
  Palette,
  SlidersHorizontal,
  Layers,
  DollarSign,
  Heart,
  FileSpreadsheet,
  Moon,
  Lock,
  CheckCircle2,
} from "lucide-react";

const coreModules = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Portfolio-level overview providing a consolidated view of all active projects, their health status, budgets, and key metrics at a glance.",
  },
  {
    icon: Building2,
    title: "Client & Contact Management",
    description: "Maintain a centralised directory of clients, contacts, industries, and relationships. Link projects to clients for full traceability.",
  },
  {
    icon: FolderKanban,
    title: "Project Management",
    description: "Create and manage projects with visual timelines, milestones, hierarchical phases and workstreams, and configurable health indicators across four dimensions.",
  },
  {
    icon: Users,
    title: "Team & Resource Management",
    description: "Track team members, define rate cards by role and region, assign resources to projects, and plan weekly allocations across the portfolio.",
  },
  {
    icon: Clock,
    title: "Timesheets",
    description: "Record actual daily effort per team member, per project and workstream. Supports Mon-Sun daily entry with automatic weekly totalling.",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Weekly percentage-complete updates per workstream. Phases auto-calculate from child workstreams using duration-weighted averages.",
  },
  {
    icon: BarChart3,
    title: "EVM Dashboard",
    description: "Full Earned Value Management suite: BAC, PV, AC, EV, SV, CV, SPI, CPI, EAC, and ETC. Colour-coded performance indicators with weekly and per-workstream breakdowns.",
  },
  {
    icon: Shield,
    title: "Risk Register",
    description: "Identify, assess, and track project risks with probability, impact, mitigation strategies, and automatically calculated risk scores.",
  },
  {
    icon: Palette,
    title: "Branding & Customisation",
    description: "Personalise the platform with custom app name, logo, favicon, and colour scheme. Supports dark and light themes.",
  },
  {
    icon: SlidersHorizontal,
    title: "Configurable Fields",
    description: "User-defined dropdown options for project types, engagement models, statuses, roles, regions, and more. Adapt the platform to your organisation's terminology.",
  },
];

const keyCapabilities = [
  {
    icon: Layers,
    title: "Hierarchical Task Structure",
    description: "Organise work into phases and workstreams with automatic parent-child relationships, status cascading, and date validation.",
  },
  {
    icon: DollarSign,
    title: "Financial Tracking",
    description: "Approved budget, total running cost, and gross margin calculated automatically from milestones, allocations, and rate cards.",
  },
  {
    icon: Heart,
    title: "Health Indicators",
    description: "Four independent, colour-coded health dimensions — Overall, Scope, Budget, and Team Composition — for rapid project assessment.",
  },
  {
    icon: BarChart3,
    title: "Earned Value Management",
    description: "Industry-standard EVM metrics computed from allocations (PV), timesheets (AC), and progress entries (EV) for objective performance measurement.",
  },
  {
    icon: FileSpreadsheet,
    title: "Bulk Import",
    description: "Import project data from Excel (.xlsx, .xls) and CSV files for rapid project setup and migration from existing tools.",
  },
  {
    icon: Moon,
    title: "Dark & Light Themes",
    description: "Toggle between dark and light modes. Theme preference is persisted and applied consistently across all pages.",
  },
  {
    icon: Lock,
    title: "Secure Authentication",
    description: "Role-based access control with secure session management. All data is protected behind authentication.",
  },
];

export default function AboutPage() {
  const { branding } = useBranding();
  const appTitle = useAppTitle();
  const appName = branding?.appName || "Project High Level Planning";
  const logoUrl = branding?.logoUrl;

  return (
    <>
      <Helmet>
        <title>About - {appTitle}</title>
        <meta name="description" content={`${appName} — A comprehensive visual project planning and Earned Value Management platform for tracking scope, schedule, cost, and team performance.`} />
        <meta property="og:title" content={`About - ${appName}`} />
        <meta property="og:description" content="Comprehensive Visual Project Planning & Earned Value Management Platform" />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="p-6 max-w-6xl mx-auto space-y-12" data-testid="about-page">

        <div className="text-center space-y-4 py-8" data-testid="about-hero">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={appName}
              className="h-16 mx-auto object-contain"
              data-testid="img-about-logo"
            />
          )}
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-about-title">
            {appName}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-about-tagline">
            Comprehensive Visual Project Planning & Earned Value Management Platform
          </p>
        </div>

        <div className="text-center max-w-3xl mx-auto" data-testid="about-overview">
          <p className="text-sm leading-relaxed text-muted-foreground">
            A unified platform for project managers to plan, execute, and monitor projects with full visibility into
            scope, schedule, cost, and team performance. From initial client engagement through to delivery, the platform
            provides the tools and insights needed to keep projects on track and stakeholders informed.
          </p>
        </div>

        <div data-testid="about-modules">
          <div className="text-center mb-6">
            <Badge variant="outline" className="text-xs uppercase tracking-wider mb-2">Platform Modules</Badge>
            <h2 className="text-xl font-semibold">Core Modules</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreModules.map((mod, idx) => (
              <Card
                key={mod.title}
                className="p-5 flex gap-4 items-start"
                data-testid={`card-module-${idx}`}
              >
                <div className="shrink-0 mt-0.5 rounded-lg bg-primary/10 p-2.5">
                  <mod.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div data-testid="about-capabilities">
          <div className="text-center mb-6">
            <Badge variant="outline" className="text-xs uppercase tracking-wider mb-2">Highlights</Badge>
            <h2 className="text-xl font-semibold">Key Capabilities</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {keyCapabilities.map((cap, idx) => (
              <div
                key={cap.title}
                className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                data-testid={`capability-${idx}`}
              >
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-medium mb-0.5">{cap.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center py-6 border-t" data-testid="about-tech-summary">
          <Badge variant="outline" className="text-xs uppercase tracking-wider mb-3">Architecture</Badge>
          <h2 className="text-xl font-semibold mb-3">Technical Summary</h2>
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Built on a modern web stack with a React frontend, Node.js backend, and PostgreSQL database.
            Real-time data updates, secure session-based authentication, and a responsive design ensure
            the platform works reliably across devices and team sizes. All configuration, branding, and
            field options are database-driven for easy customisation without code changes.
          </p>
        </div>
      </div>
    </>
  );
}

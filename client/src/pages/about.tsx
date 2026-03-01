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
  AlertTriangle,
  Compass,
  Bot,
  Target,
  Calculator,
  ArrowRightLeft,
  Upload,
  UserCheck,
  Milestone,
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
    icon: Target,
    title: "Opportunities & Pre-Sales",
    description: "Full pre-sales pipeline with opportunity lifecycle management (Qualifying, Estimating, Proposed, Won, Lost). Price-driven financial model with risk and buffer adjustments. Stage 0 governance gate and one-click conversion to delivery projects.",
  },
  {
    icon: Calculator,
    title: "Resource-Based Estimation",
    description: "Build detailed estimates with hierarchical phases and workstreams. Assign multiple resources per workstream using rate cards, with duration-based hour calculations, confidence levels, and automatic financial roll-ups for pricing and cost.",
  },
  {
    icon: Users,
    title: "Team & Resource Management",
    description: "Track team members, define rate cards by role and region, assign resources to projects, and plan weekly allocations across the portfolio. Supports role-only entries for pre-sales planning with automatic team sync from estimates.",
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
    icon: AlertTriangle,
    title: "RAID Log",
    description: "Full Risks, Assumptions, Issues, and Dependencies tracking per project with type-specific fields, probability/impact scoring for risks, and linkage to governance stages.",
  },
  {
    icon: Compass,
    title: "Operating Model Governance",
    description: "Stage-gated project lifecycle with 5 stages (Value Framing through Value Realization), deliverable checklists, RACI accountability matrices, gate enforcement, AI-powered readiness evaluation, and document repository integration for artifact verification.",
  },
  {
    icon: Bot,
    title: "Governance Coach",
    description: "AI-powered natural language assistant that guides project managers through the governance framework, explains stage requirements, RACI roles, and recommends next actions.",
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
    title: "Price-Driven Financial Model",
    description: "Opportunities use a price-driven model: Base Price (hours x bill rate), Risk-Adjusted Price, and Buffered Price with configurable risk and buffer percentages. Gross Margin calculated as (Buffered Price - Base Cost) / Buffered Price. Projects track approved budget, running cost, and margin.",
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
    icon: Shield,
    title: "Stage-Gated Governance",
    description: "Five-stage governance framework with pass/fail gate enforcement, AI evaluator assessment, exception workflows, and configurable stage definitions.",
  },
  {
    icon: Compass,
    title: "RACI Accountability Matrices",
    description: "Per-deliverable RACI (Responsible, Accountable, Consulted, Informed) matrices ensure clear role assignments across all governance stages.",
  },
  {
    icon: Bot,
    title: "AI-Powered Gate Evaluation",
    description: "Automated gate readiness assessment that checks checkpoint completion, artifact presence and quality, RAID status, and EVM indicators to provide structured pass/fail recommendations.",
  },
  {
    icon: FolderKanban,
    title: "Document Repository Integration",
    description: "Connect Google Drive or SharePoint folders to projects. Link deliverable artifacts to governance checkpoints and run AI-powered verification to ensure documents meet requirements.",
  },
  {
    icon: ArrowRightLeft,
    title: "Convert to Project",
    description: "One-click conversion from won opportunities to delivery projects. Copies phases, workstreams, resources, team composition, allocations, and RAID items. Role-only team entries carry over as positions to fill.",
  },
  {
    icon: Milestone,
    title: "Stage 0 Pre-Sales Governance",
    description: "Six pre-sales deliverables (Deal Context, Scope Definition Pack, Solution Approach, Delivery Feasibility Review, SOW, Sales-to-Delivery Handoff Pack) with RACI matrices and a Commercial & Operational Authorization gate.",
  },
  {
    icon: Upload,
    title: "Estimate Template Import/Export",
    description: "Download a pre-formatted Excel template to define phases, workstreams, and resources offline. Import the completed template to bulk-create the estimate hierarchy with automatic duplicate detection.",
  },
  {
    icon: UserCheck,
    title: "Sync from Estimate",
    description: "Auto-populate team composition from workstream resources. Consolidates by rate card, calculates required FTEs using peak concurrent hours, and computes the delta against existing team entries.",
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
  {
    icon: SlidersHorizontal,
    title: "Dynamic Framework Configuration",
    description: "Multi-tenant ready governance framework. Configure stages, deliverables, RACI roles, and gate criteria per organisation. AI Coach dynamically adapts to your framework.",
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
        <meta name="description" content={`${appName} — A comprehensive visual project planning, Earned Value Management, and AI-powered governance platform for tracking scope, schedule, cost, team performance, and stage-gated delivery.`} />
        <meta property="og:title" content={`About - ${appName}`} />
        <meta property="og:description" content="Comprehensive Visual Project Planning, EVM & AI-Powered Governance Platform" />
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
            Comprehensive Visual Project Planning, EVM & AI-Powered Governance Platform
          </p>
        </div>

        <div className="text-center max-w-3xl mx-auto" data-testid="about-overview">
          <p className="text-sm leading-relaxed text-muted-foreground">
            A unified platform for project managers to plan, execute, and monitor projects with full visibility into
            scope, schedule, cost, and team performance. From pre-sales opportunity estimation through stage-gated
            delivery to value realization, the platform combines resource-based pricing, traditional project management,
            AI-powered governance, and earned value analysis to keep projects on track and stakeholders informed.
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
            the platform works reliably across devices and team sizes. AI-powered features leverage
            OpenAI integration for intelligent gate evaluation and conversational coaching.
            All configuration, branding, governance frameworks, and field options are database-driven
            for easy customisation without code changes. Multi-tenant ready architecture supports
            different governance frameworks per organisation.
          </p>
        </div>
      </div>
    </>
  );
}

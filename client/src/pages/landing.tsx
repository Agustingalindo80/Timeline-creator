import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBranding } from "@/components/branding-provider";
import { FolderKanban, BarChart3, Users, ArrowRight, Shield } from "lucide-react";

export default function Landing() {
  const { branding } = useBranding();
  const appName = branding?.appName || "Project High Level Planning";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{appName}</title>
      </Helmet>

      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding?.logoUrl && (
              <img src={branding.logoUrl} alt={appName} className="h-8 w-8 rounded object-contain" />
            )}
            <span className="font-semibold text-foreground" data-testid="text-landing-app-name">{appName}</span>
          </div>
          <Button asChild data-testid="button-login-nav">
            <a href="/api/login">Log In</a>
          </Button>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-serif font-bold tracking-tight text-foreground leading-tight">
              Plan, Track &<br />Deliver Projects<br />with Confidence
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              A comprehensive project planning platform for managing timelines, budgets, teams, and deliverables — all in one place.
            </p>
            <div className="flex items-center gap-4">
              <Button size="lg" asChild data-testid="button-login-hero">
                <a href="/api/login">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Secure authentication</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex justify-center">
            <div className="w-80 h-64 rounded-xl bg-card border border-border shadow-lg p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FolderKanban className="w-4 h-4 text-primary" />
                Project Overview
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Budget Utilization</span>
                  <span className="text-xs font-medium">67%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "67%" }} />
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="text-center">
                    <div className="text-lg font-semibold">12</div>
                    <div className="text-[10px] text-muted-foreground">Milestones</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">8</div>
                    <div className="text-[10px] text-muted-foreground">Team</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">94%</div>
                    <div className="text-[10px] text-muted-foreground">Health</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-serif font-bold text-center mb-12">Everything you need for project success</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3 hover:bg-background/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold" data-testid="text-feature-planning">Visual Planning</h3>
              <p className="text-sm text-muted-foreground">
                Timeline views with milestones, tasks, and Gantt-style progress bars to keep your projects on track.
              </p>
            </Card>
            <Card className="p-6 space-y-3 hover:bg-background/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold" data-testid="text-feature-financial">Financial Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Automatic budget calculations, running costs, and gross margin tracking for complete financial visibility.
              </p>
            </Card>
            <Card className="p-6 space-y-3 hover:bg-background/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold" data-testid="text-feature-team">Team Management</h3>
              <p className="text-sm text-muted-foreground">
                Resource allocation, rate cards, and team composition tracking to optimize your workforce.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <footer className="py-8 px-6 border-t text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} {appName}. All rights reserved.
      </footer>
    </div>
  );
}

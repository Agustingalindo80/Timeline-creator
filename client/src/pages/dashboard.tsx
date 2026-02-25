import { Helmet } from "react-helmet-async";
import { LayoutDashboard } from "lucide-react";
import { useAppTitle } from "@/hooks/use-app-title";

export default function Dashboard() {
  const appTitle = useAppTitle("Dashboard");
  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <LayoutDashboard className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Dashboard</h2>
        <p className="text-muted-foreground max-w-md">
          Dashboard content coming soon. This will show an overview of all your projects and key metrics.
        </p>
      </div>
    </div>
  );
}

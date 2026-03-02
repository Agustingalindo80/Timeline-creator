import { useRef, forwardRef, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCSV, exportToPDF } from "./report-export";

interface ReportLayoutProps {
  title: string;
  description?: string;
  filters?: ReactNode;
  csvData?: Record<string, unknown>[];
  csvColumns?: { key: string; label: string }[];
  csvFilename?: string;
  children: ReactNode;
}

const ReportLayout = forwardRef<HTMLDivElement, ReportLayoutProps>(
  ({ title, description, filters, csvData, csvColumns, csvFilename, children }, ref) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLDivElement>) || contentRef;

    const handlePdfExport = async () => {
      const el = resolvedRef.current;
      if (!el) return;
      await exportToPDF(el, title);
    };

    const handleCsvExport = () => {
      if (csvData && csvColumns) {
        exportToCSV(csvData, csvColumns, csvFilename || title.toLowerCase().replace(/\s+/g, "-"));
      }
    };

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="report-layout">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/reports">
            <Button variant="ghost" size="sm" data-testid="button-back-reports">
              <ArrowLeft className="w-4 h-4 mr-1" /> Reports
            </Button>
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-report-title">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-report-description">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {csvData && csvColumns && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCsvExport}
                data-testid="button-export-csv"
              >
                Export CSV
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePdfExport}
              data-testid="button-export-pdf"
            >
              Export PDF
            </Button>
          </div>
        </div>

        {filters && (
          <div className="flex items-end gap-3 flex-wrap" data-testid="report-filter-bar">
            {filters}
          </div>
        )}

        <div ref={resolvedRef} data-testid="report-content-area">
          {children}
        </div>
      </div>
    );
  }
);

ReportLayout.displayName = "ReportLayout";

export { ReportLayout };

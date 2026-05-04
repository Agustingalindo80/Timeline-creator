import { useCallback, useState, type RefObject } from "react";
import type { useToast } from "@/hooks/use-toast";
import type { TimelineWithMilestones } from "@shared/schema";

type ToastFn = ReturnType<typeof useToast>["toast"];

export function useTimelineExport(
  timeline: TimelineWithMilestones | undefined,
  timelineRef: RefObject<HTMLDivElement>,
  toast: ToastFn
) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(
    async (format: "png" | "pdf") => {
      if (!timelineRef.current || !timeline) return;
      setExporting(true);

      try {
        const html2canvas = (await import("html2canvas")).default;

        const source = timelineRef.current;

        const extraPadding = 48;
        const canvas = await html2canvas(source, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: -window.scrollY,
          width: source.scrollWidth,
          height: source.scrollHeight + extraPadding,
          windowWidth: Math.max(source.scrollWidth + 200, 1400),
          windowHeight: source.scrollHeight + extraPadding + 200,
          onclone: (clonedDoc: Document) => {
            clonedDoc.documentElement.classList.remove("dark");
            clonedDoc.documentElement.setAttribute("style", "color-scheme: light !important;");

            const style = clonedDoc.createElement("style");
            style.textContent = `
              :root, html, *, *::before, *::after {
                --background: 0 0% 100% !important;
                --foreground: 222 15% 12% !important;
                --card: 0 0% 98% !important;
                --card-foreground: 222 15% 12% !important;
                --card-border: 220 13% 94% !important;
                --muted: 220 14% 94% !important;
                --muted-foreground: 222 13% 38% !important;
                --border: 220 13% 91% !important;
                --ring: 217 91% 48% !important;
                --popover: 0 0% 96% !important;
                --popover-foreground: 222 15% 12% !important;
                --primary: 217 91% 48% !important;
                --primary-foreground: 210 40% 98% !important;
                --secondary: 220 14% 93% !important;
                --secondary-foreground: 222 15% 12% !important;
                --accent: 220 15% 95% !important;
                --accent-foreground: 222 15% 12% !important;
                --input: 220 13% 85% !important;
                color-scheme: light !important;
              }
              .dark {
                --background: 0 0% 100% !important;
                --foreground: 222 15% 12% !important;
                --card: 0 0% 98% !important;
                --card-foreground: 222 15% 12% !important;
                --card-border: 220 13% 94% !important;
                --muted: 220 14% 94% !important;
                --muted-foreground: 222 13% 38% !important;
                --border: 220 13% 91% !important;
                --ring: 217 91% 48% !important;
                --popover: 0 0% 96% !important;
                --popover-foreground: 222 15% 12% !important;
                --primary: 217 91% 48% !important;
                --primary-foreground: 210 40% 98% !important;
                --secondary: 220 14% 93% !important;
                --secondary-foreground: 222 15% 12% !important;
                --accent: 220 15% 95% !important;
                --accent-foreground: 222 15% 12% !important;
                --input: 220 13% 85% !important;
                color-scheme: light !important;
              }
            `;
            clonedDoc.head.appendChild(style);

            const targetEl = clonedDoc.querySelector("[data-export-timeline]") as HTMLElement;
            if (targetEl) {
              targetEl.style.padding = "32px";
              targetEl.style.paddingBottom = "48px";
              targetEl.style.backgroundColor = "hsl(0 0% 100%)";
              const allEls = targetEl.querySelectorAll<HTMLElement>("*");
              allEls.forEach((el) => {
                el.style.overflow = "visible";
              });
            }
          },
        });

        if (format === "png") {
          const link = document.createElement("a");
          link.download = `${timeline.title.replace(/[^a-zA-Z0-9]/g, "_")}_project.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
          toast({ title: "PNG downloaded" });
        } else {
          const { jsPDF } = await import("jspdf");
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const isLandscape = imgWidth > imgHeight;
          const pdf = new jsPDF({
            orientation: isLandscape ? "landscape" : "portrait",
            unit: "px",
            format: [imgWidth, imgHeight],
          });
          pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
          pdf.save(`${timeline.title.replace(/[^a-zA-Z0-9]/g, "_")}_project.pdf`);
          toast({ title: "PDF downloaded" });
        }
      } catch (err: unknown) {
        toast({
          title: "Export failed",
          description: err instanceof Error ? err.message : "Something went wrong during export.",
          variant: "destructive",
        });
      } finally {
        setExporting(false);
      }
    },
    [timeline, toast, timelineRef]
  );

  return { handleExport, exporting };
}

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function exportToCSV(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename: string
) {
  if (!data.length) return;

  const header = columns.map((c) => `"${c.label}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportToPDF(
  element: HTMLElement,
  title: string
) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const isLandscape = imgWidth > imgHeight * 1.2;
  const orientation = isLandscape ? "landscape" : "portrait";

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const headerHeight = 16;
  pdf.setFontSize(14);
  pdf.setTextColor(33, 37, 41);
  pdf.text(title, 14, 12);

  pdf.setFontSize(8);
  pdf.setTextColor(108, 117, 125);
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  pdf.text(`Generated: ${dateStr}`, pageWidth - 14, 12, { align: "right" });

  pdf.setDrawColor(222, 226, 230);
  pdf.line(14, headerHeight, pageWidth - 14, headerHeight);

  const contentWidth = pageWidth - 28;
  const scaledHeight = (imgHeight / imgWidth) * contentWidth;
  const availableHeight = pageHeight - headerHeight - 14;

  if (scaledHeight <= availableHeight) {
    pdf.addImage(imgData, "PNG", 14, headerHeight + 4, contentWidth, scaledHeight);
  } else {
    let remainingHeight = scaledHeight;
    let yOffset = 0;
    let isFirstPage = true;

    while (remainingHeight > 0) {
      if (!isFirstPage) {
        pdf.addPage();
      }

      const startY = isFirstPage ? headerHeight + 4 : 14;
      const sliceAvailableHeight = isFirstPage ? availableHeight : pageHeight - 28;

      const sourceY = (yOffset / scaledHeight) * imgHeight;
      const sourceSliceHeight = (sliceAvailableHeight / scaledHeight) * imgHeight;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgWidth;
      sliceCanvas.height = Math.min(sourceSliceHeight, imgHeight - sourceY);
      const ctx = sliceCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          canvas,
          0, sourceY,
          imgWidth, sliceCanvas.height,
          0, 0,
          imgWidth, sliceCanvas.height
        );
        const sliceData = sliceCanvas.toDataURL("image/png");
        const sliceScaledHeight = (sliceCanvas.height / imgWidth) * contentWidth;
        pdf.addImage(sliceData, "PNG", 14, startY, contentWidth, sliceScaledHeight);
      }

      yOffset += sliceAvailableHeight;
      remainingHeight -= sliceAvailableHeight;
      isFirstPage = false;
    }
  }

  pdf.save(`${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

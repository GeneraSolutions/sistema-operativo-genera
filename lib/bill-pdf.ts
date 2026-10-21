"use client";

export function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export async function renderBillPdf(
  file: File,
  maxPages: number
): Promise<{ pages: { dataUrl: string; fileName: string }[]; text: string }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const count = Math.min(pdf.numPages, Math.max(1, maxPages));
  const pages: { dataUrl: string; fileName: string }[] = [];
  const textParts: string[] = [];

  for (let n = 1; n <= count; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1.45 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo dibujar el PDF.");
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    }).promise;
    pages.push({
      dataUrl: canvas.toDataURL("image/jpeg", 0.78),
      fileName: `${file.name} · p.${n}`,
    });
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .filter(Boolean)
      .join(" ");
    if (line.trim()) textParts.push(`— Página ${n} —\n${line}`);
  }

  return { pages, text: textParts.join("\n\n") };
}

"use client";

export function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} tardó demasiado. Intente de nuevo o use una foto.`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Renderiza páginas de un PDF a JPEG + texto embebido.
 * Usa worker local (/pdf.worker.min.mjs) para no depender de CDN.
 */
export async function renderBillPdf(
  file: File,
  maxPages: number
): Promise<{ pages: { dataUrl: string; fileName: string }[]; text: string }> {
  const pdfjs = await import("pdfjs-dist");
  // Worker local (evita cuelgues por unpkg/CDN)
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null;
  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]> | null =
    null;

  try {
    loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
    });
    pdf = await withTimeout(
      loadingTask.promise,
      45_000,
      "La lectura del PDF"
    );

    const count = Math.min(pdf.numPages, Math.max(1, maxPages));
    const pages: { dataUrl: string; fileName: string }[] = [];
    const textParts: string[] = [];

    for (let n = 1; n <= count; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1.1 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo dibujar el PDF.");

      await withTimeout(
        page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        }).promise,
        30_000,
        `La página ${n} del PDF`
      );

      let dataUrl = canvas.toDataURL("image/jpeg", 0.68);
      if (dataUrl.length > 1_600_000) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.48);
      }
      if (dataUrl.length > 1_600_000) {
        const small = page.getViewport({ scale: 0.85 });
        canvas.width = Math.round(small.width);
        canvas.height = Math.round(small.height);
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport: small,
        }).promise;
        dataUrl = canvas.toDataURL("image/jpeg", 0.45);
      }

      pages.push({
        dataUrl,
        fileName: `${file.name} · p.${n}`,
      });

      try {
        const content = await page.getTextContent();
        const line = content.items
          .map((item) => ("str" in item ? String(item.str) : ""))
          .filter(Boolean)
          .join(" ");
        if (line.trim()) textParts.push(`— Página ${n} —\n${line}`);
      } catch {
        /* texto opcional */
      }

      try {
        page.cleanup();
      } catch {
        /* ignore */
      }
    }

    return { pages, text: textParts.join("\n\n") };
  } finally {
    try {
      pdf?.cleanup();
    } catch {
      /* ignore */
    }
    try {
      await loadingTask?.destroy();
    } catch {
      /* ignore */
    }
  }
}

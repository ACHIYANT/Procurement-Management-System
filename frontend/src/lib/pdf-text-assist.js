let pdfjsPromise = null;
let pdfWorkerPort = null;

const loadPdfJs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?worker&inline"),
    ]).then(([pdfjs, workerModule]) => {
      if (!pdfWorkerPort) {
        const PdfWorker = workerModule.default;
        pdfWorkerPort = new PdfWorker();
      }
      pdfjs.GlobalWorkerOptions.workerPort = pdfWorkerPort;
      return pdfjs;
    });
  }

  return pdfjsPromise;
};

export const extractTextFromPdfFile = async (file, { maxPages = 30 } = {}) => {
  if (!file) return "";

  const pdfjs = await loadPdfJs();
  let sourceUrl = "";
  let loadingTask = null;
  let pdf = null;

  try {
    sourceUrl = URL.createObjectURL(file);
    loadingTask = pdfjs.getDocument({ url: sourceUrl });
    pdf = await loadingTask.promise;
    const pageLimit = Math.min(pdf.numPages || 0, maxPages);
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = (content.items || [])
        .map((item) => String(item?.str || "").trim())
        .filter(Boolean)
        .join(" ");
      if (text) pages.push(text);
    }

    return pages.join("\n");
  } finally {
    await pdf?.destroy?.();
    loadingTask?.destroy?.();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }
};

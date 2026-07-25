import * as pdfjsLib from 'pdfjs-dist';
// Vite-specific: bundles the worker file and gives us a URL to point pdf.js at.
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Hard cap so one huge scanned textbook can't blow up Firestore writes or
// hang a browser tab during upload. Most chapter PDFs are well under this.
export const MAX_INDEXABLE_PAGES = 200;

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  totalPages: number;
  truncated: boolean;
}

/**
 * Extracts plain text per page from a PDF file entirely client-side.
 * Scanned/image-only PDFs will yield empty or near-empty text per page —
 * that's a real limitation (no OCR here), not a bug.
 */
export async function extractPdfText(file: File, onProgress?: (done: number, total: number) => void): Promise<ExtractionResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const totalPages = pdf.numPages;
  const pagesToIndex = Math.min(totalPages, MAX_INDEXABLE_PAGES);

  const pages: ExtractedPage[] = [];
  for (let pageNumber = 1; pageNumber <= pagesToIndex; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
    pages.push({ pageNumber, text });
    onProgress?.(pageNumber, pagesToIndex);
  }

  return { pages, totalPages, truncated: totalPages > MAX_INDEXABLE_PAGES };
}

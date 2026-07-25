import { jsPDF } from 'jspdf';
import type { Question, TestResult } from '../types';

const MARGIN = 15;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function newPageIfNeeded(doc: jsPDF, y: number, needed = 20): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export function exportResultToPdf(
  studentName: string,
  questions: Question[],
  result: TestResult
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const answersById = new Map(result.answers.map((a) => [a.questionId, a]));
  let y = MARGIN;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('WordCraft — Test Result', MARGIN, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${studentName} · ${new Date(result.submittedAt).toLocaleString()}`, MARGIN, y);
  doc.setTextColor(0);
  y += 10;

  // Score summary
  const pct = Math.round((result.score / result.maxScore) * 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(`${result.score} / ${result.maxScore}  (${pct}%)`, MARGIN, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(
    `Correct: ${result.correctCount}    Incorrect: ${result.incorrectCount}    Skipped: ${result.skippedCount}    Time: ${Math.round(result.timeTakenSeconds / 60)} min`,
    MARGIN,
    y
  );
  y += 10;

  // Difficulty breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Difficulty breakdown', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  (['easy', 'medium', 'hard'] as const).forEach((d) => {
    const stats = result.difficultyBreakdown[d];
    if (stats.total === 0) return;
    doc.text(`${d[0].toUpperCase()}${d.slice(1)}: ${stats.correct}/${stats.total}`, MARGIN, y);
    y += 5;
  });
  y += 5;

  // Answer review
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  y = newPageIfNeeded(doc, y);
  doc.text('Answer review', MARGIN, y);
  y += 8;

  questions.forEach((q, i) => {
    const answer = answersById.get(q.id);
    const isSkipped = answer?.selectedIndex === null || answer?.selectedIndex === undefined;
    const isCorrect = answer?.selectedIndex === q.correctAnswerIndex;
    const status = isSkipped ? 'Skipped' : isCorrect ? 'Correct' : 'Incorrect';

    y = newPageIfNeeded(doc, y, 35);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const qLines = doc.splitTextToSize(`${i + 1}. ${q.questionText}`, CONTENT_WIDTH - 25);
    doc.text(qLines, MARGIN, y);
    doc.setTextColor(isSkipped ? 120 : isCorrect ? 20 : 180, isSkipped ? 120 : isCorrect ? 130 : 30, isSkipped ? 120 : isCorrect ? 20 : 30);
    doc.text(status, PAGE_WIDTH - MARGIN - 20, y);
    doc.setTextColor(0);
    y += qLines.length * 4.5 + 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    q.options.forEach((opt, oi) => {
      y = newPageIfNeeded(doc, y, 10);
      const marker = oi === q.correctAnswerIndex ? '✓' : oi === answer?.selectedIndex ? '✗' : ' ';
      const optLines = doc.splitTextToSize(`  ${marker} ${opt}`, CONTENT_WIDTH - 10);
      doc.text(optLines, MARGIN + 3, y);
      y += optLines.length * 4;
    });

    if (q.explanation) {
      y = newPageIfNeeded(doc, y, 12);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(90);
      const expLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, CONTENT_WIDTH - 6);
      doc.text(expLines, MARGIN + 3, y);
      doc.setTextColor(0);
      y += expLines.length * 4;
    }
    y += 4;
  });

  const fileName = `wordcraft-result-${new Date(result.submittedAt).toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

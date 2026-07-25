import type { Handler } from '@netlify/functions';
import { verifyAdmin } from './_lib/firebaseAdmin';

interface RequestBody {
  class: 'XI' | 'XII';
  chapter: string;
  topicTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
  context?: string; // optional: e.g. the text of a flagged question, to generate a replacement for
}

interface DraftQuestion {
  questionText: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

function buildPrompt(body: RequestBody): string {
  const base = `Write ${body.count} multiple-choice questions for WBCHSE Class ${body.class} English, chapter "${body.chapter}" (topic: "${body.topicTitle}"), at ${body.difficulty} difficulty.`;
  const contextNote = body.context
    ? `\n\nThis question was flagged as likely broken and needs a good replacement covering the same idea: "${body.context}"`
    : '';
  return `${base}${contextNote}

Return ONLY a JSON object (no markdown fences, no commentary) of this exact shape:
{"questions": [{"questionText": string, "options": [string, string, string, string], "correctAnswerIndex": 0|1|2|3, "explanation": string}, ...]}

Rules:
- Exactly ${body.count} questions in the array.
- Exactly 4 options per question, plausible distractors, one clearly correct answer.
- explanation should be 1-3 sentences, written for a Class ${body.class} student.
- Do not repeat the same question twice.
- Output must be valid JSON and nothing else.`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    await verifyAdmin(event.headers.authorization);
  } catch (err) {
    return { statusCode: 403, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Forbidden' }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'AI is not configured. Set OPENAI_API_KEY in Netlify environment variables.' }),
    };
  }

  let body: RequestBody;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!body.chapter || !body.topicTitle || !body.count) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing chapter, topicTitle, or count' }) };
  }
  const count = Math.min(Math.max(body.count, 1), 10); // hard cap so one click can't run up a huge bill

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You write exam-quality WBCHSE English MCQs. You always respond with raw JSON only, matching the requested schema exactly.',
          },
          { role: 'user', content: buildPrompt({ ...body, count }) },
        ],
        max_tokens: 1800,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'AI provider error', detail }) };
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '[]';

    // gpt-4o-mini's json_object mode requires a top-level object, not an
    // array, so we ask it to wrap the array — but stay defensive here in
    // case the model returns the array directly anyway.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { statusCode: 502, body: JSON.stringify({ error: 'AI returned invalid JSON', raw }) };
    }
    const questions: DraftQuestion[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { questions?: DraftQuestion[] }).questions ?? [];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }) };
  }
};

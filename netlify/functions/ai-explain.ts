import type { Handler } from '@netlify/functions';

// This function is the ONLY place your OpenAI/Gemini API key is used.
// It never reaches the browser bundle. Set OPENAI_API_KEY (or GEMINI_API_KEY)
// in Netlify: Site settings -> Environment variables.

type Mode = 'easy' | 'bengali' | 'grammar' | 'similar' | 'voice';

interface RequestBody {
  mode: Mode;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  voiceQuestion?: string;
}

function buildPrompt(body: RequestBody): string {
  const base = `Question: ${body.questionText}\nOptions: ${body.options.join(' | ')}\nCorrect answer: ${body.correctAnswer}\nTeacher's explanation: ${body.explanation}`;

  switch (body.mode) {
    case 'easy':
      return `${base}\n\nExplain why this is the correct answer in simple, easy English suitable for a WBCHSE Class XI-XII student who is still building confidence in the subject. Keep it under 120 words.`;
    case 'bengali':
      return `${base}\n\nExplain in Bengali why this is the correct answer, in a friendly and clear way for a WBCHSE Class XI-XII student. Keep it under 120 words.`;
    case 'grammar':
      return `${base}\n\nIdentify and explain the underlying English grammar rule this question tests, with one additional example sentence. Keep it under 120 words.`;
    case 'similar':
      return `${base}\n\nWrite 3 new multiple-choice questions of similar difficulty and topic, each with 4 options, and mark the correct option clearly. Keep the whole response concise.`;
    case 'voice':
      return `${base}\n\nThe student asked out loud: "${body.voiceQuestion ?? ''}"\n\nAnswer their question clearly and conversationally, as if speaking to them — this response will be read aloud. Keep it under 100 words and avoid formatting like bullet points or markdown.`;
    default:
      return base;
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'AI is not configured yet. Set OPENAI_API_KEY in Netlify environment variables.',
      }),
    };
  }

  let body: RequestBody;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!body.questionText || !body.correctAnswer) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing question data' }) };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a patient WBCHSE English tutor for Class XI-XII students. Be concise, encouraging, and accurate.',
          },
          { role: 'user', content: buildPrompt(body) },
        ],
        max_tokens: 400,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'AI provider error', detail }) };
    }

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? 'No explanation was returned.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
    };
  }
};

/* Minimal wrapper around the Google Gemini API (generateContent) using Node's built-in
   fetch (Node 18+, matches this project's package.json "engines": { "node": ">=18.0.0" }). */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'; // low-latency, cost-effective — good fit for a chat widget

// Gemini's REST API uses 'user' / 'model' roles (not 'user' / 'assistant'), and each
// turn's text lives under parts: [{ text }] rather than a plain content string.
function toGeminiContents(history, userMessage) {
  const turns = history.map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }]
  }));
  turns.push({ role: 'user', parts: [{ text: userMessage }] });
  return turns;
}

async function askGemini({ systemPrompt, history, userMessage, model, maxTokens }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in backend/.env');
  }

  const chosenModel = model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/${chosenModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: toGeminiContents(history, userMessage),
        generationConfig: {
          maxOutputTokens: maxTokens || 400
        }
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const candidate = (data.candidates || [])[0];

  // A candidate can be blocked/empty (finishReason "SAFETY", "RECITATION", etc.) with no parts.
  if (!candidate || !candidate.content || !candidate.content.parts) {
    return '';
  }

  return candidate.content.parts
    .map((p) => p.text || '')
    .join('')
    .trim();
}

module.exports = { askGemini };
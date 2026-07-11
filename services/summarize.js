const axios = require('axios');

const GEMINI_MODELS = (process.env.GEMINI_MODELS || 'gemini-2.0-flash,gemini-1.5-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const PROMPT_TEMPLATE = (title, description) => `You are a news editor writing a short digest for a Kenyan news app.
Summarize the following article in exactly 3 short bullet points (plain text,
start each line with "- "), plain and factual, no speculation, no hashtags.
Then, on a final line starting with "WHY: ", write one sentence on why this
matters to a Kenyan reader. Keep the whole thing under 80 words total.

Title: ${title}
Details: ${description || 'No further details provided.'}`;

/**
 * Tries each configured Gemini model in order until one succeeds.
 * Returns null (never throws) if every model fails, so a failed summary
 * never blocks the news fetch pipeline.
 */
async function summarizeArticle(title, description) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = PROMPT_TEMPLATE(title, description);

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const { data } = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 200 }
        },
        { timeout: 15000 }
      );

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (err) {
      const status = err.response?.status;
      console.warn(`[summarize] Model "${model}" failed (${status || err.message}). Trying next fallback...`);
      // 404/400 usually means the model name is deprecated/renamed - move on.
      // 429 means rate-limited - also move on to the next model.
      continue;
    }
  }

  console.warn('[summarize] All Gemini models failed for article:', title);
  return null;
}

module.exports = { summarizeArticle };

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY, GEMINI_MODEL_LIST, LLM_TIMEOUT_MS } = require('./config');

const gemini =
  GEMINI_API_KEY && String(GEMINI_API_KEY).trim()
    ? new GoogleGenerativeAI(String(GEMINI_API_KEY).trim())
    : null;

function hasGemini() {
  return Boolean(gemini);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('LLM call timed out')), ms)),
  ]);
}

/**
 * Generates a grounded answer with Gemini, cycling through the configured
 * model list so a retired/blocked model doesn't kill the chat.
 */
async function generateWithGemini(prompt, timeoutMs = LLM_TIMEOUT_MS) {
  if (!gemini) throw new Error('Gemini API Key not configured');

  let lastErr = null;
  for (const model of GEMINI_MODEL_LIST) {
    try {
      const modelHandle = gemini.getGenerativeModel({ model });
      const result = await withTimeout(modelHandle.generateContent(prompt), timeoutMs);
      const text = result.response.text();
      if (text && text.trim()) return text.trim();
    } catch (err) {
      lastErr = err;
      console.warn(`[RAG] Gemini model "${model}" failed:`, err.message);
    }
  }
  throw lastErr || new Error('All Gemini models failed');
}

module.exports = { generateWithGemini, hasGemini };
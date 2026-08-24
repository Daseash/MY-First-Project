const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY, EMBEDDING_MODEL, EMBEDDING_MODEL_LOCAL } = require('./config');
const { embedText: embedLocal } = require('../utils/embeddings');

/**
 * Embedding abstraction, faithful to the guide.
 * Uses Gemini `text-embedding-004` when GEMINI_API_KEY is set, otherwise a
 * free local model (`@xenova/transformers`) so the app works with zero API
 * keys if desired.
 */
class EmbeddingManager {
  constructor() {
    this.useGemini = Boolean(GEMINI_API_KEY && String(GEMINI_API_KEY).trim());
    if (this.useGemini) {
      const genAI = new GoogleGenerativeAI(String(GEMINI_API_KEY).trim());
      this.model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    }
    console.log(
      `[RAG] Embedding backend: ${this.useGemini ? 'Gemini (' + EMBEDDING_MODEL + ')' : 'Local (' + EMBEDDING_MODEL_LOCAL + ')'}`,
    );
  }

  get modelName() {
    return this.useGemini ? EMBEDDING_MODEL : EMBEDDING_MODEL_LOCAL;
  }

  /** Embed a single string -> number[] */
  async embedText(text) {
    if (this.useGemini) {
      const result = await this.model.embedContent(text);
      return result.embedding.values;
    }
    return embedLocal(text);
  }

  /** Embed many strings, batched to respect rate limits. */
  async embedBatch(texts, batchSize = 20) {
    const embeddings = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((t) => this.embedText(t)));
      embeddings.push(...results);
      if (texts.length > batchSize) {
        console.log(`[RAG] Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
      }
    }
    return embeddings;
  }

  /** Pre-loads the local model so the first query doesn't pay the load cost. */
  async warmUp() {
    try {
      await this.embedText('wanderlust rag warmup');
    } catch (err) {
      console.warn('[RAG] Embedding warmup failed (will load lazily):', err.message);
    }
  }
}

module.exports = { EmbeddingManager };
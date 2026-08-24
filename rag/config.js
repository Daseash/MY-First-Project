require('dotenv').config();
const path = require('path');

function int(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

module.exports = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Comma-separated = automatic fallback order if a model is retired/blocked.
  GEMINI_MODEL_LIST: (process.env.GEMINI_MODEL || 'gemini-2.0-flash,gemini-1.5-flash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Gemini primary embedding model; falls back to a free local model when no key is set.
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-004',
  EMBEDDING_MODEL_LOCAL: process.env.EMBEDDING_MODEL_NAME || 'Xenova/all-MiniLM-L6-v2',

  CHUNK_SIZE: int(process.env.CHUNK_SIZE, 500),
  CHUNK_OVERLAP: int(process.env.CHUNK_OVERLAP, 50),
  TOP_K: int(process.env.RAG_TOP_K, 5),
  SCORE_THRESHOLD: parseFloat(process.env.RAG_SCORE_THRESHOLD || '0.25'),
  CANDIDATE_POOL: int(process.env.RAG_CANDIDATE_POOL, 60),

  VECTOR_STORE_PATH: path.join(__dirname, 'data', 'vector_store.json'),
  RAW_DOCS_DIR: path.join(__dirname, 'data', 'raw'),
  DB_URL: process.env.ATLASDB_URL || 'mongodb://127.0.0.1:27017/wanderlust',

  LLM_TIMEOUT_MS: int(process.env.LLM_TIMEOUT_MS, 9000),
  INGEST_BATCH_SIZE: int(process.env.INGEST_BATCH_SIZE, 20),
};
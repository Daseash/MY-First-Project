const { pipeline, env } = require('@xenova/transformers');

// Keep the (free, local) model cache inside the project so it persists reliably.
env.cacheDir = require('path').join(__dirname, '..', '.cache', 'transformers');

let embedder;
let warmPromise = null;

async function getEmbedder() {
  if (!embedder) {
    const modelName = process.env.EMBEDDING_MODEL_NAME || 'Xenova/all-MiniLM-L6-v2';
    embedder = await pipeline('feature-extraction', modelName);
  }
  return embedder;
}

async function embedText(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data); // 384-dim vector
}

// Pre-load the model so the first user query doesn't pay the load cost.
// Safe to call at server startup — fails silently if the model can't load.
async function warmUpEmbeddings() {
  if (!warmPromise) {
    warmPromise = getEmbedder()
      .then(() => embedText('wanderlust warmup'))
      .catch((err) => {
        console.warn('Embedding model warmup failed (will retry lazily):', err.message);
        warmPromise = null;
      });
  }
  return warmPromise;
}

module.exports = { embedText, warmUpEmbeddings };

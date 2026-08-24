const { VectorStore } = require('./vectorStore');
const { EmbeddingManager } = require('./embeddingManager');
const { RAGRetriever } = require('./ragRetriever');
const { RAGSearch } = require('./ragSearch');
const { ingestDocuments } = require('./storeBuilder');
const { VECTOR_STORE_PATH } = require('./config');

// Shared singletons — reuse across every request (guide Task 9).
const vectorStore = new VectorStore(VECTOR_STORE_PATH);
const embeddingManager = new EmbeddingManager();
const retriever = new RAGRetriever(vectorStore, embeddingManager);
const search = new RAGSearch(retriever);

let ready = false;

/**
 * Initializes the RAG engine at server startup:
 * - loads an existing vector store, or
 * - auto-builds it from the database on first run, and
 * - warms up the (possibly local) embedding model.
 * Never throws — logs and keeps the server alive.
 */
async function initRag() {
  try {
    if (vectorStore.exists()) {
      vectorStore.load();
      if (vectorStore.model && vectorStore.model !== embeddingManager.modelName) {
        console.warn(
          `[RAG] Store built with "${vectorStore.model}" but current backend is "${embeddingManager.modelName}" — rebuilding.`,
        );
        await ingestDocuments({ vectorStore, embeddingManager });
      }
    } else {
      console.log('[RAG] No vector store found — building it from the database...');
      await ingestDocuments({ vectorStore, embeddingManager });
    }
  } catch (err) {
    console.error('[RAG] initRag failed:', err.message);
  }

  if (!ready) {
    embeddingManager.warmUp();
    ready = true;
  }
  return vectorStore.size;
}

function isRagReady() {
  return ready;
}

module.exports = {
  vectorStore,
  embeddingManager,
  retriever,
  search,
  initRag,
  isRagReady,
  ingestDocuments,
};
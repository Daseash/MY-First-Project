require('dotenv').config();
const mongoose = require('mongoose');
const { DB_URL } = require('./config');
const { vectorStore, embeddingManager, ingestDocuments } = require('./engine');

/**
 * One-time/CLI ingestion (guide Task 6). Rebuild the vector store whenever
 * your data changes:
 *
 *   node rag/ingest.js
 */
async function ingest() {
  console.log(`[RAG] Connecting to database...`);
  await mongoose.connect(DB_URL);

  console.log('[RAG] Step 1/3: Loading raw documents from DB + policy files...');
  const { docs, chunks } = await ingestDocuments({ vectorStore, embeddingManager });
  console.log(`[RAG] Step 2/3: Created ${chunks} chunk(s) from ${docs} document(s).`);
  console.log('[RAG] Step 3/3: Saved vector store. Ingestion complete.');
}

ingest()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error('[RAG] Ingestion failed:', err);
    process.exit(1);
  });
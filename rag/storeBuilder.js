const fs = require('fs');
const { chunkDocuments } = require('./chunker');
const { loadListingsFromDB } = require('./loaders/dbLoader');
const { loadTextFiles } = require('./loaders/textLoader');
const { RAW_DOCS_DIR, CHUNK_SIZE, CHUNK_OVERLAP, INGEST_BATCH_SIZE } = require('./config');

/**
 * Full ingestion pipeline (guide Task 6): DB listings + policy text files →
 * chunk → embed → vector store. Used by both `node rag/ingest.js` and the
 * lazy auto-build on server startup.
 */
async function ingestDocuments({ vectorStore, embeddingManager }) {
  const Listing = require('../models/listing');
  const listingDocs = await loadListingsFromDB(Listing);
  const textDocs = fs.existsSync(RAW_DOCS_DIR) ? loadTextFiles(RAW_DOCS_DIR) : [];

  const allDocs = [...listingDocs, ...textDocs];
  if (allDocs.length === 0) {
    console.warn('[RAG] No documents to ingest (database empty?).');
    return { docs: 0, chunks: 0 };
  }

  console.log(
    `[RAG] Ingesting → ${allDocs.length} document(s) (${listingDocs.length} listings, ${textDocs.length} policy files).`,
  );

  const chunks = chunkDocuments(allDocs, CHUNK_SIZE, CHUNK_OVERLAP);
  console.log(`[RAG] Chunking → ${chunks.length} chunk(s).`);

  vectorStore.clear();
  vectorStore.model = embeddingManager.modelName;

  for (let i = 0; i < chunks.length; i += INGEST_BATCH_SIZE) {
    const batch = chunks.slice(i, i + INGEST_BATCH_SIZE);
    const embeddings = await embeddingManager.embedBatch(
      batch.map((c) => c.pageContent),
      INGEST_BATCH_SIZE,
    );
    vectorStore.addDocuments(batch, embeddings);
  }

  vectorStore.save();
  return { docs: allDocs.length, chunks: chunks.length };
}

module.exports = { ingestDocuments };
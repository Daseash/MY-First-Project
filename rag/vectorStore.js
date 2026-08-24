const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const { VECTOR_STORE_PATH } = require('./config');
const { cosineSimilarity } = require('./scoring');

/**
 * From-scratch, JSON-backed vector store (no external vector DB needed),
 * mirroring the guide's FAISS equivalent. Records are chunk-level docs that
 * also carry enough listing metadata to support hard-filtering + grouping.
 */
class VectorStore {
  constructor(storePath = VECTOR_STORE_PATH) {
    this.storePath = storePath;
    this.records = []; // { id, listingId, embedding, pageContent, metadata }
    this.model = null; // embedding model used to build the store
  }

  /** Add chunks + their pre-computed embeddings. */
  addDocuments(chunks, embeddings) {
    chunks.forEach((chunk, i) => {
      this.records.push({
        id: uuid(),
        listingId: chunk.metadata.listingId ? String(chunk.metadata.listingId) : null,
        embedding: embeddings[i],
        pageContent: chunk.pageContent,
        metadata: {
          ...chunk.metadata,
          chunkIndex: chunk.metadata.chunkIndex ?? i,
        },
      });
    });
  }

  /** Replace all chunks belonging to one listing (update path). */
  upsertListing(listingId, chunks, embeddings) {
    this.removeByListingId(listingId);
    this.addDocuments(chunks, embeddings);
  }

  /** Remove every chunk belonging to a listing. Returns true if any removed. */
  removeByListingId(listingId) {
    const key = String(listingId);
    const before = this.records.length;
    this.records = this.records.filter((r) => r.listingId !== key);
    return this.records.length !== before;
  }

  clear() {
    this.records = [];
  }

  /** Persist to disk so we don't re-embed on every server restart. */
  save() {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify({ model: this.model, records: this.records }));
    console.log(`[RAG] Saved ${this.records.length} chunk(s) → ${this.storePath}`);
  }

  load() {
    if (!fs.existsSync(this.storePath)) {
      throw new Error('No vector store found — run `node rag/ingest.js` first.');
    }
    const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
    this.model = data.model || this.model;
    this.records = data.records || [];
    console.log(`[RAG] Loaded ${this.records.length} chunk(s) from ${this.storePath}`);
  }

  exists() {
    return fs.existsSync(this.storePath);
  }

  get size() {
    return this.records.length;
  }

  /** Core similarity search — brute force is fine at this dataset size. */
  search(queryEmbedding, topK = 4, scoreThreshold = 0) {
    const scored = this.records.map((r) => ({
      ...r,
      score: cosineSimilarity(queryEmbedding, r.embedding),
    }));

    return scored
      .filter((r) => Number.isFinite(r.score) && r.score >= scoreThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

module.exports = { VectorStore };
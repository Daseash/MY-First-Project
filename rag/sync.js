const { vectorStore, embeddingManager } = require('./engine');
const { chunkDocuments } = require('./chunker');
const { listingToDocument } = require('./loaders/dbLoader');
const { CHUNK_SIZE, CHUNK_OVERLAP } = require('./config');

/**
 * Incremental sync (guide Task 10): keep the vector store fresh the moment a
 * listing is created/updated — no full re-ingestion needed.
 */
async function refreshListingChunks(listing) {
  const doc = listingToDocument(listing);
  const chunks = chunkDocuments([doc], CHUNK_SIZE, CHUNK_OVERLAP);
  try {
    const embeddings = await embeddingManager.embedBatch(
      chunks.map((c) => c.pageContent),
      chunks.length,
    );
    vectorStore.upsertListing(doc.metadata.listingId, chunks, embeddings);
    vectorStore.model = embeddingManager.modelName;
    vectorStore.save();
    console.log(`[RAG] Synced "${listing.title}" (${chunks.length} chunk(s)) to vector store.`);
  } catch (err) {
    console.warn('[RAG] Could not update vector store for listing:', err.message);
  }
}

/** Removes a deleted listing's chunks from the vector store. */
function removeListingChunks(listingId) {
  try {
    const removed = vectorStore.removeByListingId(listingId);
    if (removed) {
      vectorStore.save();
      console.log(`[RAG] Removed listing ${listingId} from vector store.`);
    }
  } catch (err) {
    console.warn('[RAG] Could not remove listing from vector store:', err.message);
  }
}

module.exports = { refreshListingChunks, removeListingChunks };
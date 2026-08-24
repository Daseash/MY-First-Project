const { answerWithLlm } = require('./generate');

/**
 * RAG Search (guide Task 8): wraps the retriever so a single entry point does
 *  retrieve → augment → generate for the vector-store path.
 */
class RAGSearch {
  constructor(retriever) {
    this.retriever = retriever;
  }

  async search(query, filters = {}, history = [], opts = {}) {
    const retrieval = await this.retriever.retrieve(query, filters, opts);

    const { answer, degraded } = await answerWithLlm(
      query,
      retrieval.items,
      history,
      retrieval.relaxed,
      filters,
    );

    return {
      answer,
      items: retrieval.items,
      relaxed: retrieval.relaxed,
      relaxedReason: retrieval.relaxedReason,
      degraded,
      sources: retrieval.items.map((i) => ({
        listingId: i.listingId,
        title: i.title,
        score: i.score,
      })),
      vectorEmpty: retrieval.vectorEmpty,
    };
  }
}

module.exports = { RAGSearch };
const { TOP_K, SCORE_THRESHOLD, CANDIDATE_POOL } = require('./config');
const { keywordScore } = require('./scoring');

/**
 * Retriever (guide Task 7): query → top chunk candidates → hybrid re-rank →
 * one best chunk per listing, with hard filters applied (and relaxed if too strict).
 */
class RAGRetriever {
  constructor(vectorStore, embeddingManager) {
    this.vectorStore = vectorStore;
    this.embeddingManager = embeddingManager;
  }

  matchesFilters(rec, filters) {
    // When listing-specific hard filters are set, non-listing docs (policies,
    // website help) must not compete for the same slots.
    if (
      !rec.metadata.listingId &&
      (filters.maxPrice != null ||
        filters.minPrice != null ||
        filters.minGuests != null ||
        filters.location ||
        filters.propertyType ||
        (filters.amenities && filters.amenities.length))
    ) {
      return false;
    }

    if (filters.maxPrice != null && Number(rec.metadata.price) > filters.maxPrice) return false;
    if (filters.minPrice != null && Number(rec.metadata.price) < filters.minPrice) return false;

    if (filters.propertyType && rec.metadata.propertyType !== filters.propertyType) {
      return false;
    }
    if (filters.amenities && filters.amenities.length) {
      const feats = rec.metadata.features || [];
      if (!filters.amenities.every((a) => feats.includes(a))) return false;
    }

    const loc = filters.location ? String(filters.location).toLowerCase() : '';
    if (loc) {
      const place = [rec.metadata.city, rec.metadata.country, rec.metadata.title]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!place.includes(loc) && !rec.pageContent.toLowerCase().includes(loc)) return false;
    }
    return true;
  }

  keywordHaystack(rec) {
    return [
      rec.pageContent,
      rec.metadata.title,
      rec.metadata.city,
      rec.metadata.country,
    ]
      .filter(Boolean)
      .join(' ');
  }

  async retrieve(query, filters = {}, opts = {}) {
    const topK = opts.topK || TOP_K;

    if (this.vectorStore.size === 0) {
      return { items: [], relaxed: false, relaxedReason: '', vectorEmpty: true };
    }

    const queryEmbedding = await this.embeddingManager.embedText(query);

    // When hard filters (price/location/type) are present, recall beats
    // precision — numeric constraints mean little to an embedding, so bypass
    // the similarity threshold and let the filters pick from the full pool.
    const hasHardFilters = Boolean(
      filters.maxPrice != null ||
        filters.minPrice != null ||
        filters.minGuests != null ||
        filters.location ||
        filters.propertyType ||
        (filters.amenities && filters.amenities.length),
    );
    const threshold = hasHardFilters ? 0 : (opts.threshold ?? SCORE_THRESHOLD);

    // 1. Vector candidate pool (generous so filters can still prune).
    let candidates = this.vectorStore.search(
      queryEmbedding,
      Math.max(topK * 5, CANDIDATE_POOL),
      threshold,
    );

    // 2. Hybrid scoring: vector similarity + lexical overlap boost, plus a small
    //    intent boost so policy/website questions prefer their own doc kinds.
    const lowerQuery = query.toLowerCase();
    const policyBoost = /cancel|refund|pet|check.?in|check.?out|house rule|policy|deposit/i.test(lowerQuery)
      ? 0.12
      : 0;
    const websiteBoost = /account|sign ?up|log ?in|log ?out|how (do|can) i|how to|review|payment|reserve|booking widget|host|create/.test(
      lowerQuery,
    )
      ? 0.1
      : 0;

    candidates = candidates.map((rec) => {
      let kindBoost = 0;
      if (rec.metadata.kind === 'policy') kindBoost += policyBoost;
      if (rec.metadata.kind === 'website') kindBoost += websiteBoost;
      return {
        ...rec,
        combined: rec.score + keywordScore(query, this.keywordHaystack(rec)) * 0.12 + kindBoost,
      };
    });

    // 3. Enforce hard filters. Price/location filters relax gracefully when too
    //    strict; amenity & property-type filters never relax (honest "we don't
    //    have that"). Non-listing docs are kept out of listing-filter searches.
    const hasPriceLocFilters = Boolean(
      filters.maxPrice != null ||
        filters.minPrice != null ||
        filters.minGuests != null ||
        filters.location,
    );
    const hasStrictFilters =
      Boolean(filters.amenities && filters.amenities.length) || Boolean(filters.propertyType);

    let relaxed = false;
    let relaxedReason = '';
    let matched = candidates.filter((rec) => this.matchesFilters(rec, filters));
    if (matched.length === 0 && candidates.length > 0) {
      if (hasStrictFilters) {
        // Keep the amenity/type requirement, but drop price/location so the
        // closest stays with that feature still surface.
        const relaxedFilters = {
          ...filters,
          maxPrice: undefined,
          minPrice: undefined,
          minGuests: undefined,
          location: undefined,
        };
        matched = candidates.filter((rec) => this.matchesFilters(rec, relaxedFilters));
        if (matched.length > 0 && hasPriceLocFilters) {
          relaxed = true;
          relaxedReason = filters.location ? 'location' : 'price';
        }
      } else if (hasPriceLocFilters) {
        relaxed = true;
        relaxedReason = filters.location
          ? 'location'
          : filters.maxPrice != null
            ? 'price'
            : 'guests';
        matched = candidates.filter((rec) => rec.listingId); // listings only
      } else {
        matched = candidates;
      }
    }
    const pool = matched;

    // 4. Keep the best chunk per listing (policy docs have no listingId, so
    //    treat each of their chunks as its own item).
    const byListing = new Map();
    for (const rec of pool) {
      const key =
        rec.listingId ||
        `doc:${rec.metadata.source || 'unknown'}:${rec.metadata.chunkIndex ?? 0}`;
      const existing = byListing.get(key);
      if (!existing || rec.combined > existing.combined) {
        byListing.set(key, rec);
      }
    }

    const items = [...byListing.values()]
      .sort((a, b) => b.combined - a.combined)
      .slice(0, topK)
      .map((rec) => ({
        listingId: rec.listingId,
        kind: rec.metadata.kind || (rec.listingId ? 'listing' : 'docs'),
        title: rec.metadata.title || null,
        city: rec.metadata.city || '',
        country: rec.metadata.country || '',
        price: rec.metadata.price,
        content: rec.pageContent,
        score: rec.combined,
      }));

    return { items, relaxed, relaxedReason, vectorEmpty: false };
  }
}

module.exports = { RAGRetriever };
/** Cosine similarity between two numeric vectors. */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Simple token-overlap keyword score used to hybrid-boost vector hits. */
function keywordScore(query, haystack) {
  const q = String(query || '').toLowerCase().trim();
  const text = String(haystack || '').toLowerCase();
  if (!q) return 0;

  let score = 0;
  if (text.includes(q)) score += 1.0;

  const tokens = q.split(/[\s,]+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    if (text.includes(token)) score += 0.4;
  }
  return score;
}

module.exports = { cosineSimilarity, keywordScore };
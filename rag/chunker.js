const { CHUNK_SIZE, CHUNK_OVERLAP } = require('./config');

/**
 * Recursively splits text on the largest separator that keeps chunks under
 * chunkSize, falling back to smaller separators when needed — a JS port of
 * LangChain's RecursiveCharacterTextSplitter.
 */
function splitText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text) return [];
  const separators = ['\n\n', '\n', '. ', ' ', ''];
  return recursiveSplit(String(text), separators, chunkSize, overlap);
}

function recursiveSplit(text, separators, chunkSize, overlap) {
  if (text.length <= chunkSize) return [text];

  const [sep, ...rest] = separators;
  const parts = sep ? text.split(sep) : text.split('');

  const chunks = [];
  let current = '';

  for (const part of parts) {
    const candidate = current ? current + sep + part : part;
    if (candidate.length > chunkSize) {
      if (current) chunks.push(current);
      if (part.length > chunkSize && rest.length) {
        chunks.push(...recursiveSplit(part, rest, chunkSize, overlap));
        current = '';
      } else {
        current = part;
      }
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return addOverlap(chunks, overlap);
}

function addOverlap(chunks, overlap) {
  if (overlap <= 0) return chunks;
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    return chunks[i - 1].slice(-overlap) + chunk;
  });
}

/**
 * Turns raw documents (from loaders) into chunked documents,
 * preserving metadata + adding a chunk index.
 */
function chunkDocuments(documents, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunked = [];
  for (const doc of documents) {
    const pieces = splitText(doc.pageContent, chunkSize, overlap);
    pieces.forEach((piece, idx) => {
      chunked.push({
        pageContent: piece,
        metadata: { ...(doc.metadata || {}), chunkIndex: idx },
      });
    });
  }
  return chunked;
}

module.exports = { splitText, chunkDocuments };
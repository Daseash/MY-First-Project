const fs = require('fs');
const path = require('path');

/**
 * Loads knowledge `.md` / `.txt` files (policies, website help, FAQs) into RAG
 * documents so they are searchable alongside listings. The `kind` lets the
 * retriever/answer engine label them (website help vs policy vs docs).
 */
function loadTextFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.txt') || f.endsWith('.md'));

  return files.map((file) => {
    const lower = file.toLowerCase();
    const kind = /website|help|howto/.test(lower)
      ? 'website'
      : /polic|faq|rule|terms/.test(lower)
        ? 'policy'
        : 'docs';
    return {
      pageContent: fs.readFileSync(path.join(dirPath, file), 'utf-8'),
      metadata: { kind, source: file, listingId: null },
    };
  });
}

module.exports = { loadTextFiles };
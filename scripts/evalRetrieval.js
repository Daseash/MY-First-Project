require('dotenv').config();
const mongoose = require('mongoose');
const golden = require('../eval/goldenQueries.json');
const { initRag, retriever } = require('../rag/engine');
const { parseQueryFilters } = require('../rag/filterParser');
const { DB_URL } = require('../rag/config');

async function run() {
  await mongoose.connect(DB_URL);
  await initRag();

  for (const item of golden) {
    const filters = parseQueryFilters(item.query);
    const { items } = await retriever.retrieve(item.query, filters, { topK: 5 });
    console.log(
      `\nQuery: "${item.query}" -> ${items.length} result(s) [filters: ${JSON.stringify(filters)}]`,
    );
    items.forEach((r, idx) => {
      console.log(
        `  ${idx + 1}. ${r.title} (${r.city}, ${r.country}) - ${
          r.price != null ? '₹' + r.price : ''
        }/night [Score: ${r.score ? r.score.toFixed(3) : 'N/A'}]`,
      );
    });
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
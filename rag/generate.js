const { generateWithGemini, hasGemini } = require('./llm');
const { prettyFeature } = require('./features');

const PROPERTY_LABELS = {
  villa: 'villas',
  cabin: 'cabins',
  cottage: 'cottages',
  apartment: 'apartments',
  house: 'houses',
  treehouse: 'treehouses',
  castle: 'castles',
  chalet: 'chalets',
  lodge: 'lodges',
  island: 'island stays',
  resort: 'resorts',
  bnb: 'bed & breakfasts',
};

const SYSTEM_PROMPT = `You are E.D.I.T.H. (Even Dead, I'm The Hero), WanderLust's AI Travel Assistant & Booking Concierge.
Your mission is to help travelers and users of the WanderLust website based ONLY on the provided context.
- Always be warm, helpful, energetic, and professional.
- The context contains: [Listing] stays (recommend these — highlight title, location, price per night in ₹, and standout features), [Policy] rules (cancellation, pets, house rules) and [Website Help] info about how the site works (accounts, booking, reviews).
- Answer using ONLY the context below. If an answer isn't in the context, say you don't have that information — never invent listings, prices, or policies.
- For a listing request, suggest specific stays; for a how-to/policy question, give a clear step-by-step or rule-based answer.
- Keep answers structured, clear, and easy to read.`;

function contextLabel(kind) {
  if (kind === 'listing') return 'Listing';
  if (kind === 'policy') return 'Policy';
  if (kind === 'website') return 'Website Help';
  return 'Context';
}

function buildPrompt(query, contextItems, history) {
  const context = contextItems.map((c, i) => `[${contextLabel(c.kind)} ${i + 1}] ${c.content}`).join('\n\n');
  const historyText = (history || []).map((h) => `${h.role}: ${h.content}`).join('\n');

  return `${SYSTEM_PROMPT}

Conversation History:
${historyText || 'None'}

Context:
${context}

Question: ${query}

Answer clearly and concisely, based only on the context above.`;
}

function formatPrice(price) {
  const num = Number(price);
  return Number.isFinite(num) ? num.toLocaleString('en-IN') : String(price || '');
}

/** Zero-cost human-readable answer engine (no API key needed). */
function buildLocalAnswer(query, items, relaxed = false, filters = {}) {
  const { amenities, propertyType } = filters || {};

  if (!items || items.length === 0) {
    if (amenities && amenities.length) {
      const want = amenities.map(prettyFeature).join(' or ');
      const label = PROPERTY_LABELS[propertyType] || `${propertyType}s`;
      return `I searched WanderLust but we don't currently have any **${label}** with **${want}**. Try another feature or raise your budget — I can check again any time!`;
    }
    if (propertyType) {
      return `I searched WanderLust but couldn't find any **${propertyType}** stays matching that right now. Try a different destination or budget, or ask about a different type — I'll scan our listings again!`;
    }
    return `I searched WanderLust but couldn't find anything matching that right now. Try a different destination, budget, or feature — or ask me about the site itself, like *"how do I create an account?"* or *"what's your cancellation policy?"*`;
  }

  const listingItems = items.filter((i) => i.kind === 'listing');
  const docItems = items.filter((i) => i.kind !== 'listing');
  const hasListings = listingItems.length > 0;

  let answer = '';

  if (hasListings) {
    const intro = relaxed
      ? `We couldn't find an exact match for "<em>${query}</em>", so here are the **closest stays** we currently have:`
      : `Here are the **best matches** for "<em>${query}</em>":`;
    answer += `I found **${listingItems.length} stay(s)** for you.\n\n${intro}\n\n`;

    listingItems.slice(0, 3).forEach((item, index) => {
      const icon = index === 0 ? '🏆' : '✨';
      answer += `${icon} **${item.title}**\n`;
      answer += `📍 ${item.city || 'Featured location'}${item.country ? `, ${item.country}` : ''}\n`;
      answer += `💰 ${formatPrice(item.price)} / night\n`;
      if (item.content) {
        const short =
          item.content.length > 150 ? item.content.substring(0, 147) + '...' : item.content;
        answer += `ℹ️ ${short}\n`;
      }
      answer += '\n';
    });
    answer += 'Tap any card below to view photos, reviews, and book your stay!\n';
  }

  for (const item of docItems) {
    const label = item.kind === 'website' ? '🌐' : '📄';
    const short =
      item.content.length > 240 ? item.content.substring(0, 237) + '...' : item.content;
    answer += `${answer ? '\n' : ''}${label} ${short}\n`;
  }

  if (docItems.length) {
    answer += '\nIs there anything else you\'d like to know about our stays or the site?';
  }
  return answer;
}

/**
 * Augmentation + Generation (guide Task 8): stuffed context → Gemini →
 * grounded answer, with a local fallback when no key is set or the call fails.
 */
async function answerWithLlm(query, items, history, relaxed = false, filters = {}) {
  const localAnswer = buildLocalAnswer(query, items, relaxed, filters);

  if (!items || items.length === 0) {
    return { answer: localAnswer, degraded: !hasGemini() };
  }

  if (!hasGemini()) {
    return { answer: localAnswer, degraded: true };
  }

  try {
    const prompt = buildPrompt(query, items, history);
    const generated = await generateWithGemini(prompt);
    return { answer: generated || localAnswer, degraded: false };
  } catch (err) {
    console.warn('[RAG] Gemini generation failed, using local engine:', err.message);
    return { answer: localAnswer, degraded: true };
  }
}

module.exports = { answerWithLlm, buildLocalAnswer, buildPrompt };
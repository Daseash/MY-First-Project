const Listing = require('../models/listing');
const Booking = require('../models/booking');
const User = require('../models/user');
const { parseQueryFilters } = require('./filterParser');
const { search, vectorStore } = require('./engine');
const { answerWithLlm, buildLocalAnswer } = require('./generate');
const { detectIntent, CANNED_ANSWERS } = require('./intent');
const { keywordScore } = require('./scoring');
const { listingToDocument } = require('./loaders/dbLoader');
const { getHistory, addTurn } = require('../utils/sessionMemory');

// Strip any legacy embedding fields before listing data leaves the server.
function sanitize(listing) {
  const { embedding, embeddingModel, __v, ...rest } = listing;
  return rest;
}

/**
 * Keyword-only fallback used when no vector store exists yet (or it's empty).
 * Scans the live listings collection with lexical scoring + hard filters.
 */
async function keywordFallback(query, filters) {
  const allListings = await Listing.find({}).lean();
  const loc = filters.location ? String(filters.location).toLowerCase() : '';

  let candidates = allListings.filter((l) => {
    if (filters.maxPrice != null && Number(l.price) > filters.maxPrice) return false;
    if (filters.minPrice != null && Number(l.price) < filters.minPrice) return false;

    const doc = listingToDocument(l);
    if (filters.propertyType && doc.metadata.propertyType !== filters.propertyType) return false;
    if (filters.amenities && filters.amenities.length) {
      const feats = doc.metadata.features || [];
      if (!filters.amenities.every((a) => feats.includes(a))) return false;
    }

    if (loc) {
      const place = [l.location, l.country].filter(Boolean).join(' ').toLowerCase();
      if (!place.includes(loc)) return false;
    }
    return true;
  });

  // Amenity / property-type filters never auto-relax.
  const canRelax =
    filters.maxPrice != null || filters.minPrice != null || filters.minGuests != null || loc;
  let relaxed = false;
  let relaxedReason = '';
  if (candidates.length === 0 && allListings.length > 0 && canRelax) {
    candidates = allListings;
    relaxed = true;
    relaxedReason = loc ? 'location' : filters.maxPrice != null ? 'price' : 'criteria';
  }

  const items = candidates
    .map((l) => {
      const haystack = [l.title, l.location, l.country, l.description].filter(Boolean).join(' ');
      return {
        listingId: String(l._id),
        kind: 'listing',
        title: l.title,
        city: l.location || '',
        country: l.country || '',
        price: l.price,
        content: buildFallbackContent(l),
        score: keywordScore(query, haystack),
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { items, relaxed, relaxedReason, vectorEmpty: true };
}

function buildFallbackContent(listing) {
  const doc = listingToDocument(listing);
  return doc.pageContent;
}

function cannedResponse(intent) {
  const answer = CANNED_ANSWERS[intent] || CANNED_ANSWERS.empty;
  return {
    answer,
    listings: [],
    sources: [],
    degraded: true,
    relaxedFilters: false,
    relaxedReason: '',
    intent,
  };
}

// "Do I have a trip in Bali?" — answers from the user's real bookings.
const TRIPS_INTENT_RE =
  /\bmy\s+(trips?|bookings?|stays?|reservations?)\b|do i (?:have|have got)|upcoming\b|where (?:am i|is my stay)|am i going (?:anywhere|on a trip)/i;

async function tripsResponse(question, userId) {
  if (!userId) {
    return {
      answer:
        "I'd love to check that for you! **Log in** to your WanderLust account (top-right menu) and I'll be able to pull up your trips. 😊",
      listings: [],
      sources: [],
      degraded: true,
      relaxedFilters: false,
      relaxedReason: '',
      intent: 'trips',
    };
  }

  const user = await User.findById(userId).lean();
  const now = new Date();
  const upcoming = await Booking.find({
    user: userId,
    status: 'confirmed',
    checkOut: { $gt: now },
  })
    .populate('listing')
    .sort({ checkIn: 1 })
    .lean();

  const name = user ? user.username : 'there';
  if (!upcoming.length) {
    return {
      answer: `No upcoming trips, **${name}**! When you're ready, ask me like *"find a beachfront villa"* and I'll help you plan your next getaway. 🌴`,
      listings: [],
      sources: [],
      degraded: true,
      relaxedFilters: false,
      relaxedReason: '',
      intent: 'trips',
    };
  }

  const lines = upcoming.map((b) => {
    const inDate = new Date(b.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const outDate = new Date(b.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `• **${b.listing.title}** — ${inDate} to ${outDate}, ${b.nights} night(s), ₹${Number(b.total).toLocaleString('en-IN')}`;
  });

  const answer = `Here are your upcoming trips, **${name}**:\n\n${lines.join('\n')}\n\nWant me to plan the next one? Ask me for a stay — e.g. *"villa with a pool in Phuket"*. ✈️`;

  return {
    answer,
    listings: upcoming.map((b) => b.listing).filter(Boolean).map(sanitize),
    sources: upcoming.map((b) => ({ listingId: String(b.listing._id), title: b.listing.title, score: 1 })),
    degraded: true,
    relaxedFilters: false,
    relaxedReason: '',
    intent: 'trips',
  };
}

// Simple extractive review summary from stored reviews (no LLM needed).
function buildReviewSummary(listings) {
  const parts = [];
  for (const l of listings) {
    if (!l || !l.reviews || !l.reviews.length) continue;
    const avg = (l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length).toFixed(1);
    const top = l.reviews
      .slice()
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 2)
      .map((r) => `"${String(r.comment || '').slice(0, 110)}"`);
    parts.push(
      `**${l.title}** — ⭐ ${avg}/5 from ${l.reviews.length} review(s).` +
        (top.length ? ` Guests say: ${top.join(' · ')}` : '')
    );
  }
  return parts.join('\n\n');
}

/**
 * Orchestrates the full RAG flow: intent → filter-parse → retrieve (vector or
 * keyword fallback) → augment + generate → attach full listing cards → history.
 */
async function ragAnswer(question, sessionId, context = {}) {
  const { userId } = context;
  const intent = detectIntent(question);
  if (intent !== 'search') {
    const resp = cannedResponse(intent);
    addTurn(sessionId, 'user', question);
    addTurn(sessionId, 'assistant', resp.answer);
    return resp;
  }

  // Personal concierge: answer from the user's actual bookings.
  if (TRIPS_INTENT_RE.test(question)) {
    const resp = await tripsResponse(question, userId);
    addTurn(sessionId, 'user', question);
    addTurn(sessionId, 'assistant', resp.answer);
    return resp;
  }

  const filters = parseQueryFilters(question);
  const history = getHistory(sessionId);
  const reviewIntent = /reviews?|rating|what do (?:guests|people|travelers) (?:say|think)|feedback|comments about/i.test(question);

  let retrieval;
  if (vectorStore.size > 0) {
    retrieval = await search.search(question, filters, history);
  } else {
    const fallback = await keywordFallback(question, filters);
    const { answer, degraded } = await answerWithLlm(
      question,
      fallback.items,
      history,
      fallback.relaxed,
      filters,
    );
    retrieval = {
      ...fallback,
      answer,
      degraded,
      sources: fallback.items.map((i) => ({
        listingId: i.listingId,
        title: i.title,
        score: i.score,
      })),
    };
  }

  // Fetch full listing docs for the UI cards, preserving retrieval order.
  const ids = retrieval.items.map((i) => i.listingId).filter(Boolean);
  const listings = ids.length ? await Listing.find({ _id: { $in: ids } }).lean() : [];
  const byId = new Map(listings.map((l) => [String(l._id), l]));
  const ordered = retrieval.items
    .map((i) => byId.get(i.listingId))
    .filter(Boolean)
    .map(sanitize);

  let answer =
    retrieval.answer ||
    buildLocalAnswer(question, retrieval.items, retrieval.relaxed, filters);

  // Review-focused question → surface an extractive review summary.
  if (reviewIntent && ordered.length) {
    const withReviews = await Listing.find({ _id: { $in: ids } })
      .select('title reviews')
      .populate('reviews')
      .lean();
    const summary = buildReviewSummary(withReviews);
    if (summary) {
      answer = `Here's what guests think:\n\n${summary}\n\n`;
    }
  }

  addTurn(sessionId, 'user', question);
  addTurn(sessionId, 'assistant', answer);

  return {
    answer,
    listings: ordered,
    sources: retrieval.sources || [],
    degraded: retrieval.degraded ?? true,
    relaxedFilters: retrieval.relaxed,
    relaxedReason: retrieval.relaxedReason || '',
  };
}

module.exports = { ragAnswer };
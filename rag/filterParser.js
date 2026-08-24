// Words people use to describe a *type* of stay rather than a *place name*.
// If a captured "location" only contains these, it is a descriptive term,
// not a destination — so we should NOT hard-filter on it (e.g. "villa in mountains").
const LOCATION_STOPWORDS = new Set([
  'beach', 'beaches', 'beachfront', 'beach side', 'ocean', 'sea', 'seaside', 'coast', 'coastal',
  'mountain', 'mountains', 'mountainous', 'hills', 'hill', 'valley', 'alps',
  'city', 'cities', 'downtown', 'urban', 'city centre', 'city center',
  'nature', 'forest', 'woods', 'jungle', 'wilderness', 'countryside',
  'lake', 'lakeside', 'river', 'riverbank', 'riverside',
  'island', 'islands', 'island resort', 'private island',
  'luxury', 'luxurious', 'budget', 'cheap', 'affordable', 'expensive', 'economy',
  'villa', 'villas', 'cottage', 'cottages', 'cabin', 'cabins', 'chalet', 'penthouse',
  'loft', 'apartment', 'apartments', 'condo', 'house', 'home', 'bungalow', 'treehouse',
  'castle', 'resort', 'hotel', 'hideaway', 'retreat', 'oasis', 'paradise', 'haven',
  'stay', 'stays', 'place', 'places', 'accommodation', 'property', 'getaway',
  'ski', 'skiing', 'ski resort', 'night', 'weekend', 'trip', 'holiday', 'vacation',
  'trending', 'featured', 'top', 'best', 'nice', 'great', 'good', 'somewhere', 'someplace',
  'the', 'a', 'an', 'some', 'any', 'in', 'at', 'near', 'around', 'close', 'to', 'with', 'for', 'under',
]);

const { extractQueryFeatureTags, extractPropertyType } = require('./features');

function isDescriptive(loc) {
  const tokens = loc.split(/\s+/).filter(Boolean);
  // "New York", "Los Angeles", "San Francisco" are proper places → keep.
  const multiWordProper = tokens.filter((t) => /^[A-Z]/.test(t));
  if (tokens.length >= 2 && multiWordProper.length >= 2) return false;
  return tokens.every((t) => LOCATION_STOPWORDS.has(t));
}

/**
 * Extracts hard constraints (price range, min guests, destination, amenities,
 * property type) from a natural-language query so the retriever can enforce
 * them precisely.
 */
function parseQueryFilters(question) {
  const filters = {};
  const q = String(question || '');

  const priceMatch =
    q.match(/(?:under|below|less than|max|budget|upto|up to|within)\s*(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]*(?:\.\d+)?)/i) ||
    q.match(/(?:₹|rs\.?|inr|\$)\s*(\d[\d,]*(?:\.\d+)?)/i);
  if (priceMatch) filters.maxPrice = parseFloat(priceMatch[1].replace(/,/g, ''));

  const overMatch = q.match(/(?:over|above|more than|at least|minimum|min|costly|expensive|premium)\s*(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]*(?:\.\d+)?)/i);
  if (overMatch) filters.minPrice = parseFloat(overMatch[1].replace(/,/g, ''));

  const rangeMatch = q.match(/between\s*(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:and|to|-|–)\s*(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]*(?:\.\d+)?)/i);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1].replace(/,/g, ''));
    const hi = parseFloat(rangeMatch[2].replace(/,/g, ''));
    filters.minPrice = Math.min(lo, hi);
    filters.maxPrice = Math.max(lo, hi);
  }

  const guestsMatch = q.match(/(\d+)\s*(?:people|guests|guest|persons|person|pax|travellers|travelers)/i);
  if (guestsMatch) filters.minGuests = parseInt(guestsMatch[1], 10);

  const inMatch = q.match(
    /\b(?:in|at|near|around|close to)\s+([A-Za-z][A-Za-z\s]*?)(?:\s+for|\s+under|\s+below|\s+less than|\s+within|\s+with|\s+that|\s+which|$)/i,
  );
  if (inMatch) {
    let loc = inMatch[1].trim().replace(/^(the|a|an|some)\s+/i, '');
    if (loc && !isDescriptive(loc.toLowerCase())) {
      filters.location = loc;
    }
  }

    // Amenities become HARD filters only when the user explicitly asks for the
  // facility ("villa with a pool", "pet friendly", "has wifi"). Setting-style
  // words ("mountain", "beachfront") stay soft — the vector search handles them.
  const wantsFeature = /(?:with|has|have|having|featuring|need|want|wanted|includes?|offers?|allowing|allows|looking for|places?\s+(?:with|having)|stays?\s+(?:with|having)|pet\s*friendly|pet\s*allowed|pet\s*welcome)/i.test(
    q,
  );
  const amenityTags = extractQueryFeatureTags(q);
  if (amenityTags.length && wantsFeature) {
    filters.amenities = amenityTags;
  }

  // e.g. "a pet friendly villa" -> tag the stay type for a hard filter.
  const propertyType = extractPropertyType(q);
  if (propertyType) filters.propertyType = propertyType;

  return filters;
}

module.exports = { parseQueryFilters };
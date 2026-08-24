// Shared feature/property detection used by BOTH the document builder (so
// features get embedded into the vector store) and the filter parser (so a
// user's "with a pool" / "pet friendly" query turns into a hard filter).

// Canonical tag -> phrases that imply it. Phrase matching is lowercase-includes.
const FEATURE_TAGS = {
  beachfront: ['beachfront', 'beach front', 'seafront', 'sea front', 'ocean front', 'on the beach', 'sandy shore'],
  beach: ['beach', 'coastal', 'seaside', 'shore', 'surfing', 'surf break', 'pacific coast'],
  mountain: ['mountain', 'alpine', 'alps', 'highlands', 'rockies', 'mountain view', 'hills', 'vineyards'],
  lake: ['lake', 'lakefront', 'lake view', 'riverside', 'river view', 'kayaking', 'fishing'],
  cityview: ['city view', 'city views', 'skyline', 'downtown', 'heart of the city', 'urban'],
  pool: ['pool', 'swimming pool', 'infinity pool', 'plunge pool', 'private pool'],
  garden: ['garden', 'courtyard', 'terrace', 'veranda', 'patio'],
  historic: ['historic', 'heritage', 'restored', 'brownstone', 'canal house', 'cobblestone', 'castle'],
  luxury: ['luxury', 'luxurious', 'opulent', 'exclusive', 'private island', 'premium', 'indulge', 'panoramic'],
  eco: ['eco-friendly', 'eco friendly', 'sustainable', 'off-grid', 'organic', 'solar'],
  nature: ['nature', 'forest', 'woodland', 'wilderness', 'secluded', 'treetop', 'treehouse', 'nature lovers'],
  view: ['view', 'views', 'scenic', 'stunning', 'breathtaking'],
  ski: ['ski', 'slopes', 'ski-in', 'ski-out'],
  petfriend: ['pet friendly', 'pet-friendly', 'pets allowed', 'dog friendly', 'cat friendly', 'pets welcome'],
  wifi: ['wifi', 'wi-fi', 'internet', 'broadband', 'high-speed'],
  kitchen: ['kitchen', 'full kitchen', 'cooking', 'stove', 'microwave'],
  parking: ['parking', 'garage', 'driveway'],
  spa: ['spa', 'sauna', 'hot tub', 'jacuzzi'],
  gym: ['gym', 'fitness center', 'workout'],
  aircon: ['air conditioning', 'air-conditioning', 'climate control', 'ceiling fan'],
  familyfriendly: ['family friendly', 'family-friendly', 'kids', 'children', 'child friendly'],
};

// Canonical property type -> phrases that imply it.
const PROPERTY_TAGS = {
  villa: ['villa'],
  cabin: ['cabin', 'log cabin'],
  cottage: ['cottage'],
  apartment: ['apartment', 'loft', 'condo', 'penthouse', 'brownstone'],
  house: ['house', 'home', 'bungalow'],
  treehouse: ['treehouse', 'tree house'],
  castle: ['castle'],
  chalet: ['chalet'],
  lodge: ['lodge'],
  island: ['island', 'private island'],
  resort: ['resort'],
  bnb: ['b&b', 'bed and breakfast', 'inn'],
};

// Order matters for property detection (e.g. "log cabin" before "cabin").
const PROPERTY_ORDER = ['villa', 'cabin', 'cottage', 'apartment', 'house', 'treehouse', 'castle', 'chalet', 'lodge', 'island', 'resort', 'bnb'];

// For QUERY filtering we avoid overly-generic tags/phrases that would false
// positive on locations ("stays in New York CITY" must not mean "city view").
const QUERY_FEATURE_TAGS = Object.keys(FEATURE_TAGS).reduce((acc, tag) => {
  if (tag === 'view') return acc; // too generic ("great views", "the views")
  const phrases = FEATURE_TAGS[tag].filter(
    (p) => !(tag === 'cityview' && (p === 'city' || p === 'urban')),
  );
  acc[tag] = phrases;
  return acc;
}, {});

function matchesAny(text, phrases) {
  const lower = text.toLowerCase();
  return phrases.some((p) => lower.includes(p));
}

/** Returns the canonical feature tags present in some text (listing or query). */
function extractFeatureTags(text) {
  if (!text) return [];
  return Object.keys(FEATURE_TAGS).filter((tag) => matchesAny(text, FEATURE_TAGS[tag]));
}

/** Feature tags for QUERIES — skips generic tags that could mis-classify. */
function extractQueryFeatureTags(text) {
  if (!text) return [];
  return Object.keys(QUERY_FEATURE_TAGS).filter((tag) =>
    matchesAny(text, QUERY_FEATURE_TAGS[tag]),
  );
}

/** Returns the first property type present in some text (listing or query). */
function extractPropertyType(text) {
  if (!text) return null;
  for (const tag of PROPERTY_ORDER) {
    if (matchesAny(text, PROPERTY_TAGS[tag])) return tag;
  }
  return null;
}

function prettyFeature(tag) {
  const labels = {
    beachfront: 'Beachfront',
    beach: 'Beach access',
    mountain: 'Mountain views',
    lake: 'Lake/river',
    cityview: 'City views',
    pool: 'Pool',
    garden: 'Garden/terrace',
    historic: 'Historic charm',
    luxury: 'Luxury',
    eco: 'Eco-friendly',
    nature: 'Nature escape',
    view: 'Great views',
    ski: 'Ski access',
    petfriend: 'Pet friendly',
    wifi: 'WiFi',
    kitchen: 'Kitchen',
    parking: 'Parking',
    spa: 'Spa/hot tub',
    gym: 'Gym',
    aircon: 'Air conditioning',
    familyfriendly: 'Family friendly',
  };
  return labels[tag] || tag;
}

module.exports = {
  FEATURE_TAGS,
  PROPERTY_TAGS,
  extractFeatureTags,
  extractQueryFeatureTags,
  extractPropertyType,
  prettyFeature,
};
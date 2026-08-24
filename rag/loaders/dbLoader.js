const { extractFeatureTags, extractPropertyType, prettyFeature } = require('../features');

/**
 * Converts a Mongoose listing into a RAG "document" (natural-language
 * paragraph + searchable metadata). Uses the title AND description to detect
 * features/property type so queries like "villa with a pool" match precisely.
 */
function listingToDocument(listing) {
  const title = listing.title || '';
  const description = listing.description || '';

  const reviewText = (listing.reviews || [])
    .slice(-3)
    .map((r) => (typeof r === 'object' && r ? r.comment : ''))
    .filter(Boolean)
    .join(' ');

  const featureTags = extractFeatureTags(`${title}. ${description}`);
  const propertyType = extractPropertyType(`${title}. ${description}`);

  const featureLine = featureTags.length
    ? ` Features: ${featureTags.map(prettyFeature).join(', ')}.`
    : '';
  const typeLine = propertyType ? ` Type: ${propertyType}.` : '';

  return {
    pageContent:
      `Listing: ${title}. Location: ${listing.location || ''}, ${listing.country || ''}. ` +
      `Price: ₹${listing.price || 0} per night.${typeLine} Description: ${description}.${featureLine}` +
      ` Recent guest feedback: ${reviewText || 'No reviews yet.'}`,
    metadata: {
      kind: 'listing',
      source: 'mongodb',
      listingId: String(listing._id || listing.id),
      title,
      city: listing.location || '',
      country: listing.country || '',
      price: listing.price,
      propertyType,
      features: featureTags,
    },
  };
}

/**
 * Pulls listings live from MongoDB. Pass in the Mongoose model so this stays
 * decoupled from the schema (guide Task 4's dbLoader).
 */
async function loadListingsFromDB(ListingModel) {
  const listings = await ListingModel.find({}).populate('reviews').lean();
  return listings.map(listingToDocument);
}

module.exports = { loadListingsFromDB, listingToDocument };
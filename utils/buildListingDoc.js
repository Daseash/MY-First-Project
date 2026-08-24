function buildListingDoc(listing) {
  const reviewText = (listing.reviews || [])
    .slice(-3)
    .map(r => typeof r === 'object' ? r.comment : '')
    .filter(Boolean)
    .join(" ");

  return `Title: ${listing.title}
Location: ${listing.location || ''}, ${listing.country || ''}
Price: ₹${listing.price || 0} per night
Description: ${listing.description || ''}
Recent guest feedback: ${reviewText || "No reviews yet"}`.trim();
}

module.exports = { buildListingDoc };

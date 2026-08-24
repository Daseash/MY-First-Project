const Review = require("../models/review.js");

// Reviews are referenced by listing.reviews[], so a single query can fetch
// every rating for a page of listings and bucket it back to each stay.
async function attachRatings(listings) {
  if (!listings || listings.length === 0) return listings;

  const reviewToListing = new Map();
  listings.forEach((l) => {
    (l.reviews || []).forEach((rid) => {
      reviewToListing.set(String(rid), String(l._id));
    });
  });

  const stats = new Map();
  if (reviewToListing.size > 0) {
    const reviews = await Review.find({ _id: { $in: [...reviewToListing.keys()] } })
      .select("rating")
      .lean();
    for (const r of reviews) {
      const lid = reviewToListing.get(String(r._id));
      if (!lid) continue;
      const cur = stats.get(lid) || { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += r.rating;
      stats.set(lid, cur);
    }
  }

  for (const l of listings) {
    const s = stats.get(String(l._id));
    const count = s ? s.count : 0;
    l._reviewCount = count;
    l._avgRating = count ? s.sum / count : null;
  }
  return listings;
}

module.exports = { attachRatings };
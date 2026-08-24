// Lightweight intent detection so pure conversational turns (greetings, thanks,
// help) get a friendly reply instantly instead of a pointless DB/embedding run.

const GREETING_RE = /^\s*(hi+|hii+|hello+|hey+|yo|namaste|hola|bonjour|good\s*(morning|afternoon|evening))\b/i;
const THANKS_RE = /^\s*(thanks|thank\s*you+|thx|ty|dhanyavaad)\b/i;
const HELP_RE =
  /^(?:help|what should i (?:ask|do|say)|what can i ask|how (?:do|can) i use (?:you|this|edith))\b/i;
const HELP_PHRASE_RE =
  /who are you|what can you do|what do you do|what are you|tell me about yourself|instructions|capabilities|how does (?:this|the|your)\s*(?:chat|assistant|bot|ai|edith|concierge)\s*work/i;
// General knowledge / off-topic — EDITH only knows WanderLust, so answer politely.
const OFFTOPIC_RE =
  /\bweather\b|\bforecast\b|temperature(?: in| of)?\b|what time is it|current time|what(?:\'|’)?s? the date|todays? date|\bnews\b|football|soccer|cricket (?:score|match)|stock (?:market|price)|translate\b|recipe for|capital of|president of|prime minister of|who (?:wrote|invented|directed|won)|population of|currency of|\bhack(?:er|ing)?\b|password of|university (?:offer|chance)|resume\b|job (?:interview|offer)\b|tell me a joke|make me laugh/i;

function detectIntent(question) {
  const q = String(question || '').trim();
  if (!q) return 'empty';
  if (GREETING_RE.test(q)) return 'greeting';
  if (THANKS_RE.test(q)) return 'thanks';
  if (HELP_RE.test(q) || HELP_PHRASE_RE.test(q)) return 'help';
  if (OFFTOPIC_RE.test(q)) return 'offtopic';
  return 'search';
}

const CANNED_ANSWERS = {
  greeting:
    "Hi! 👋 I'm **E.D.I.T.H.** — WanderLust's AI travel concierge.\n\nI can help you with:\n• Finding stays — try *\"villa with a pool in Phuket\"*, *\"cabin under ₹1500\"* or *\"beachfront stay in Bali\"*\n• Our policies — *\"what's your cancellation policy?\"*\n• How the site works — *\"how do I create an account?\"* or *\"how do reviews work?\"*\n\nWhat are you looking for today?",
  thanks: "You're most welcome! 😊 Tap me anytime you need a stay recommendation or have a question — happy travels! ✈️",
  help:
    "I'm here to answer anything about **WanderLust** — finding stays or understanding the site.\n\n**Try asking me things like:**\n• \"Find a luxury beachfront villa\"\n• \"stays under ₹1500 in Goa\"\n• \"places with a pool near the mountains\"\n• \"what's your pet policy?\"\n• \"can I cancel my booking?\"\n• \"how do I leave a review?\" or \"how do I create an account?\"\n\nFire away! 🔥",
  offtopic:
    "Hmm, that's outside my knowledge — I'm **E.D.I.T.H.**, the WanderLust concierge, and I only know about *our stays, policies, and how the site works*. 🌍\n\nTry something like *\"villa with a pool\"*, *\"what's your cancellation policy?\"*, or *\"how do I book a stay?\"*.",
  empty: 'Say "hello" or ask me something like *"find me a villa with a pool"* and I\'ll get searching!',
};

module.exports = { detectIntent, CANNED_ANSWERS };
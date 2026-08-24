const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { ragAnswer } = require('../rag/pipeline');
const { getSessionUserId } = require('../utils/auth');

const ragLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests — please slow down.' }
});

router.post('/ask', ragLimiter, async (req, res) => {
  try {
    let { question, sessionId } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }
    question = question.trim().slice(0, 300);
    sessionId = sessionId || 'anonymous';

    const result = await ragAnswer(question, sessionId, { userId: getSessionUserId(req) });
    res.json(result);
  } catch (err) {
    console.error('RAG route error:', err);
    res.status(500).json({ error: 'Something went wrong processing your request. Please try again.' });
  }
});

module.exports = router;

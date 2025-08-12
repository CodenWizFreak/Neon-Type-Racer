// backend/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas and Models ---
const scoreSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    wpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    mode: { type: String, required: true },
    timeLimit: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});
scoreSchema.index({ createdAt: 1 });
const Score = mongoose.model('Score', scoreSchema);

const dailyContestSchema = new mongoose.Schema({
    text: { type: String, required: true },
    date: { type: String, required: true, unique: true, index: true }
});
const DailyContest = mongoose.model('DailyContest', dailyContestSchema);

// --- Load Texts from JSON file ---
let typingTexts = {};
try {
    const textsPath = path.join(__dirname, 'texts.json');
    const textsData = fs.readFileSync(textsPath, 'utf8');
    typingTexts = JSON.parse(textsData);
    console.log('Successfully loaded typing texts from texts.json');
} catch (error) {
    console.error('Could not load texts.json.', error);
}

// --- Gemini API Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

async function fetchTextFromGemini(prompt) {
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
            return null;
        }
        return response.text().trim();
    } catch (error) {
        console.error("Error during Gemini API call:", error);
        return null;
    }
}

// --- API Endpoints ---

/**
 * POST /api/generate-text (for Practice and Test modes)
 */
app.post('/api/generate-text', async (req, res) => {
    try {
        const { timeLimit } = req.body;

        const topics = [
            "the history of video games", "the science of sleep", "the process of making chocolate",
            "the architecture of skyscrapers", "the basics of quantum physics", "a journey through the Amazon rainforest",
            "the life of a honeybee", "the art of storytelling", "the impact of social media",
            "the exploration of Mars", "the creation of a coral reef"
        ];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];

        const wordCountMap = { "1": 100, "2": 200, "5": 450 };
        const wordCount = wordCountMap[String(timeLimit)] || 100;

        const prompt = `Generate a paragraph of about ${wordCount} words for a typing test. The topic is ${randomTopic}. The text should be engaging, grammatically correct, and contain no special characters or quotes.`;
        
        console.log(`Generated prompt for practice/test: "${prompt}"`);
        let text = await fetchTextFromGemini(prompt);

        if (!text || text.trim().length === 0) {
            console.log('Gemini failed, using fallback from texts.json.');
            const fallbackOptions = typingTexts[String(timeLimit)];
            if (fallbackOptions && fallbackOptions.length > 0) {
                text = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
            } else {
                text = "The quick brown fox jumps over the lazy dog.";
            }
        }
        res.json({ text: text.trim() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate text' });
    }
});

/**
 * GET /api/daily-contest/status
 */
app.get('/api/daily-contest/status', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.status(400).json({ error: 'User name is required.' });
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const existingScore = await Score.findOne({
            name: name,
            mode: 'contest',
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });
        res.json({ hasPlayed: !!existingScore });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check contest status.' });
    }
});

/**
 * GET /api/daily-contest/text
 */
app.get('/api/daily-contest/text', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const contest = await DailyContest.findOne({ date: today });
        if (contest) {
            return res.json({ text: contest.text });
        } else {
            return res.status(404).json({ error: "Today's contest is not yet available." });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch daily contest text.' });
    }
});

/**
 * POST /api/submit-score
 */
app.post('/api/submit-score', async (req, res) => {
    try {
        const { name, wpm, accuracy, mode, timeLimit } = req.body;
        
        // Validate required fields
        if (!name || wpm === undefined || accuracy === undefined) {
            return res.status(400).json({ error: 'Invalid score data.' });
        }

        // Check mode BEFORE saving to database
        if (mode !== 'contest') {
            return res.status(200).json({ message: 'Practice/Test score received but not saved.' });
        }
        
        // Only save contest mode scores
        const newScore = new Score({ name, wpm, accuracy, mode, timeLimit });
        await newScore.save();
        
        res.status(201).json({ message: 'Contest score submitted successfully!', entry: newScore });
    } catch (error) {
        console.error('Error submitting score:', error);
        res.status(500).json({ error: 'Failed to submit score' });
    }
});

/**
 * GET /api/leaderboard
 */
app.get('/api/leaderboard', async (req, res) => {
    try {
        const { name: currentUserName } = req.query;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const top10 = await Score.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            mode: 'contest'
        }).sort({ wpm: -1, accuracy: -1 }).limit(10);
        let userRankData = null;
        if (currentUserName) {
            const userBestScore = await Score.findOne({
                name: currentUserName,
                mode: 'contest',
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            }).sort({ wpm: -1, accuracy: -1 });
            if (userBestScore) {
                const userInTop10 = top10.some(score => score._id.equals(userBestScore._id));
                if (!userInTop10) {
                    const higherScoresCount = await Score.countDocuments({
                        mode: 'contest',
                        createdAt: { $gte: startOfDay, $lte: endOfDay },
                        $or: [
                            { wpm: { $gt: userBestScore.wpm } },
                            { wpm: userBestScore.wpm, accuracy: { $gt: userBestScore.accuracy } }
                        ]
                    });
                    userRankData = { rank: higherScoresCount + 1, ...userBestScore.toObject() };
                }
            }
        }
        res.json({ top10, userRank: userRankData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});

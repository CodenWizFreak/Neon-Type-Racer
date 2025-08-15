// backend/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OAuth2Client } = require('google-auth-library'); // Import Google Auth Library

const app = express();
const PORT = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Google Auth Client ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // Add this to your .env file
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas and Models ---

// NEW: User Profile Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    yearOfBirth: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// MODIFIED: Score Schema now includes email
const scoreSchema = new mongoose.Schema({
    email: { type: String, required: true, index: true }, // Changed from name to email
    name: { type: String, required: true, trim: true }, // Keep name for display purposes
    wpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    mode: { type: String, required: true },
    timeLimit: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});
scoreSchema.index({ createdAt: 1, email: 1 });
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
        if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) return null;
        return response.text().trim();
    } catch (error) {
        console.error("Error during Gemini API call:", error);
        return null;
    }
}

// --- API Endpoints ---

// NEW: Google Sign-In Endpoint
app.post('/api/auth/google/signin', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name } = payload;

        let user = await User.findOne({ email });

        if (user) {
            // User exists, log them in
            res.json({ isNewUser: false, user: { name: user.name, email: user.email } });
        } else {
            // User is new, signal frontend to ask for more details
            res.json({ isNewUser: true, user: { name, email } });
        }
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        res.status(401).json({ error: 'Invalid Google token.' });
    }
});

// NEW: New User Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, name, yearOfBirth } = req.body;
        
        let user = await User.findOne({ email });
        if (user) {
            return res.status(409).json({ error: 'User already exists.' });
        }

        user = new User({ email, name, yearOfBirth });
        await user.save();

        res.status(201).json({ user: { name: user.name, email: user.email } });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ error: 'Failed to register user.' });
    }
});


app.post('/api/generate-text', async (req, res) => {
    try {
        const { timeLimit } = req.body;
        const topics = ["the history of video games", "the science of sleep", "the process of making chocolate", "the exploration of Mars"];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        const wordCountMap = { "1": 100, "2": 200, "5": 450 };
        const wordCount = wordCountMap[String(timeLimit)] || 100;
        const prompt = `Generate a paragraph of about ${wordCount} words for a typing test on the topic of ${randomTopic}.`;
        let text = await fetchTextFromGemini(prompt);
        if (!text || text.trim().length === 0) {
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

// MODIFIED: Checks status by email
app.get('/api/daily-contest/status', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: 'User email is required.' });
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const existingScore = await Score.findOne({
            email: email,
            mode: 'contest',
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });
        res.json({ hasPlayed: !!existingScore });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check contest status.' });
    }
});

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

// MODIFIED: Saves score with email
app.post('/api/submit-score', async (req, res) => {
    try {
        const { email, name, wpm, accuracy, mode, timeLimit } = req.body;
        if (!email || !name || wpm === undefined || accuracy === undefined) {
            return res.status(400).json({ error: 'Invalid score data.' });
        }
        if (mode !== 'contest') {
            return res.status(200).json({ message: 'Practice/Test score received but not saved.' });
        }
        const newScore = new Score({ email, name, wpm, accuracy, mode, timeLimit });
        await newScore.save();
        res.status(201).json({ message: 'Contest score submitted successfully!', entry: newScore });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit score' });
    }
});

// MODIFIED: Fetches leaderboard and user rank by email
app.get('/api/leaderboard', async (req, res) => {
    try {
        const { email: currentUserEmail } = req.query;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const top10 = await Score.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            mode: 'contest'
        }).sort({ wpm: -1, accuracy: -1 }).limit(10);
        let userRankData = null;
        if (currentUserEmail) {
            const userBestScore = await Score.findOne({
                email: currentUserEmail,
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

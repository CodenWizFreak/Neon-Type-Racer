// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- In-Memory Storage (Replace with a database for production) ---
let leaderboard = [
    { name: 'Alice', wpm: 95, accuracy: 98, mode: 'contest', timestamp: new Date().toISOString() },
    { name: 'Bob', wpm: 88, accuracy: 96, mode: 'contest', timestamp: new Date().toISOString() }
];

// --- Gemini API Setup ---
// Make sure you have a .env file with your GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

async function fetchTextFromGemini(prompt) {
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Error fetching from Gemini API:", error);
        // Return a reliable fallback text if the API fails
        return "The quick brown fox jumps over the lazy dog. The world is full of amazing adventures waiting to be discovered. Please try again in a moment as we are experiencing technical difficulties with our text generation service.";
    }
}

// --- API Endpoints ---

/**
 * POST /api/generate-text
 * Generates text for typing tests using the Gemini API.
 */
app.post('/api/generate-text', async (req, res) => {
    try {
        const { mode, timeLimit } = req.body;

        let wordCount;
        if (timeLimit === 1) wordCount = 90;
        else if (timeLimit === 2) wordCount = 180;
        else if (timeLimit === 5) wordCount = 300;
        else wordCount = 100; // Default

        const prompt = `Generate a paragraph of about ${wordCount} words in plain English for a typing speed test.
        The text should have a mix of common and slightly advanced vocabulary, be grammatically correct, engaging, and coherent.
        Do not include numbers, special characters (like *, #, @), or quotation marks.
        Return only the text itself without any additional formatting, titles, or quotes.`;

        const text = await fetchTextFromGemini(prompt);

        if (!text || text.trim().length === 0) {
            throw new Error('Empty response from Gemini API');
        }

        res.json({ text: text.trim() });

    } catch (error) {
        console.error('Error generating text:', error);
        res.status(500).json({ error: 'Failed to generate text' });
    }
});

/**
 * POST /api/submit-score
 * Receives a score from the frontend and adds it to the in-memory leaderboard.
 */
app.post('/api/submit-score', (req, res) => {
    try {
        const { name, wpm, accuracy, mode, timeLimit, timestamp } = req.body;

        if (!name || wpm === undefined || accuracy === undefined) {
            return res.status(400).json({ error: 'Invalid score data. Name, WPM, and accuracy are required.' });
        }
        
        const scoreEntry = {
            name: name.trim(),
            wpm: parseInt(wpm),
            accuracy: parseFloat(accuracy),
            mode: mode || 'unknown',
            timeLimit: timeLimit || 0,
            timestamp: timestamp || new Date().toISOString()
        };
        
        leaderboard.push(scoreEntry);
        
        res.status(201).json({ 
            message: 'Score submitted successfully!',
            entry: scoreEntry
        });
        
    } catch (error) {
        console.error('Error submitting score:', error);
        res.status(500).json({ error: 'Failed to submit score' });
    }
});

/**
 * GET /api/leaderboard
 * Returns the sorted leaderboard.
 */
app.get('/api/leaderboard', (req, res) => {
    try {
        const { mode, limit = 10 } = req.query;
        
        let filteredLeaderboard = [...leaderboard];
        
        if (mode && mode !== 'all') {
            filteredLeaderboard = filteredLeaderboard.filter(entry => entry.mode === mode);
        }
        
        // Sort by WPM (desc), then by accuracy (desc)
        const sortedLeaderboard = filteredLeaderboard.sort((a, b) => {
            if (b.wpm !== a.wpm) return b.wpm - a.wpm;
            return b.accuracy - a.accuracy;
        });
        
        const limitedLeaderboard = sortedLeaderboard.slice(0, parseInt(limit));
        
        res.json({ leaderboard: limitedLeaderboard });
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});

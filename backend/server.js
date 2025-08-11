// backend/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Load Texts from JSON file ---
let typingTexts = {};
try {
    const textsPath = path.join(__dirname, 'texts.json');
    const textsData = fs.readFileSync(textsPath, 'utf8');
    typingTexts = JSON.parse(textsData);
    console.log('Successfully loaded typing texts from texts.json');
} catch (error) {
    console.error('Could not load texts.json. Make sure the file exists and is valid JSON.', error);
}


// --- In-Memory Storage (Replace with a database for production) ---
let leaderboard = [
    { name: 'Alice', wpm: 95, accuracy: 98, mode: 'contest', timestamp: new Date().toISOString() },
    { name: 'Bob', wpm: 88, accuracy: 96, mode: 'contest', timestamp: new Date().toISOString() }
];

// --- Gemini API Setup ---
// Make sure you have a .env file with your GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// *** ROBUST GEMINI FETCH FUNCTION ***
async function fetchTextFromGemini(prompt) {
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;

        // Check if the prompt or response was blocked for safety reasons
        if (response.promptFeedback && response.promptFeedback.blockReason) {
            console.warn(`Prompt was blocked by Gemini API. Reason: ${response.promptFeedback.blockReason}`);
            return null; // Return null to indicate failure
        }

        // Check if the API returned any text candidates
        if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
            console.warn('Gemini API returned no candidates. Finish reason:', response.candidates?.[0]?.finishReason);
            return null; // Return null to indicate failure
        }
        
        // If everything is okay, return the text
        return response.text().trim();

    } catch (error) {
        // Catch network errors or other issues during the API call
        console.error("Error during Gemini API call:", error);
        return null;
    }
}

// --- API Endpoints ---

/**
 * POST /api/generate-text
 * Generates text for typing tests using the Gemini API, with a robust JSON fallback.
 */
app.post('/api/generate-text', async (req, res) => {
    try {
        const { mode, timeLimit } = req.body;

        const prompt = `Generate a paragraph for a typing speed test. It should be appropriate for a ${timeLimit}-minute test. The text should be engaging, grammatically correct, and contain no special characters or quotes.`;

        let text = await fetchTextFromGemini(prompt);

        // *** MODIFIED LOGIC: USE JSON FALLBACK IF GEMINI FAILS ***
        if (!text || text.trim().length === 0) {
            console.log('Gemini failed to generate valid text, using fallback from texts.json.');
            
            const timeKey = String(timeLimit);
            const fallbackOptions = typingTexts[timeKey];

            if (fallbackOptions && fallbackOptions.length > 0) {
                // Select a random text from the appropriate category
                const randomIndex = Math.floor(Math.random() * fallbackOptions.length);
                text = fallbackOptions[randomIndex];
            } else {
                // Final fallback if the time limit isn't in the JSON file
                text = "The quick brown fox jumps over the lazy dog. This is a default text because no specific fallback was found for the selected time limit.";
            }
        }

        res.json({ text: text.trim() });

    } catch (error) {
        console.error('Error in /api/generate-text endpoint:', error);
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

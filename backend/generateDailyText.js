// backend/generateDailyText.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Mongoose Schemas and Models (must match server.js) ---
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
    console.log('Successfully loaded typing texts from texts.json for fallback.');
} catch (error) {
    console.error('Could not load texts.json for fallback.', error);
}

// --- Gemini API Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// *** MORE ROBUST GEMINI FETCH FUNCTION (from server.js) ***
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

const generateAndStoreText = async () => {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to MongoDB.');

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // 1. Check if text for today already exists
    const existingContest = await DailyContest.findOne({ date: today });
    if (existingContest) {
        console.log(`A text for today (${today}) already exists. Exiting.`);
        await mongoose.disconnect();
        return;
    }

    // 2. If no text exists, generate a new one
    console.log("No text found for today. Generating a new daily contest text...");
    const prompt = "Generate a paragraph of about 100 words for a competitive daily typing contest. The text should be engaging, with a mix of common and slightly complex words, and contain no special characters or quotes.";
    let newText = await fetchTextFromGemini(prompt);

    // Use texts.json if Gemini fails for any reason
    if (!newText || newText.trim().length === 0) {
        console.log('Gemini failed, using fallback from texts.json (1-minute texts).');
        
        const fallbackOptions = typingTexts["1"]; // Get the array of 1-minute texts

        if (fallbackOptions && fallbackOptions.length > 0) {
            // Select a random text from the 1-minute category
            const randomIndex = Math.floor(Math.random() * fallbackOptions.length);
            newText = fallbackOptions[randomIndex];
        } else {
            // A final, hardcoded fallback in case texts.json is missing or empty
            newText = "The quick brown fox jumps over the lazy dog. This is a default text because the primary fallback file could not be read.";
        }
    }

    // 3. Save the new text to the database
    const contest = new DailyContest({ date: today, text: newText });
    await contest.save();
    console.log(`Successfully saved new text for ${today}.`);

    // 4. Disconnect from the database
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
};

// Run the function
generateAndStoreText().catch(err => {
    console.error("An error occurred in the script:", err);
    mongoose.disconnect();
});

// Neon Type-Racer JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // Make sure your backend is running on this port
    const BASE_URL = 'http://localhost:3000'; 

    // State Management
    let user = { name: '' };
    let currentMode = '';
    let timeLimit = 0;
    let timeRemaining = 0;
    let timerInterval = null;
    let testText = '';
    let currentIndex = 0;
    let errors = 0;
    let testStartTime = null;
    let isTestActive = false;

    // DOM Elements
    const screens = {
        landing: document.getElementById('landing-screen'),
        login: document.getElementById('login-screen'),
        modeSelection: document.getElementById('mode-selection-screen'),
        typing: document.getElementById('typing-screen'),
        results: document.getElementById('results-screen')
    };

    // Landing Screen Elements
    const getStartedBtn = document.getElementById('get-started-btn');

    // Login Screen Elements
    const nameInput = document.getElementById('name-input');
    const proceedButton = document.getElementById('proceed-button');

    // Mode Selection Elements
    const userNameDisplay = document.getElementById('user-name');
    const modeCards = document.querySelectorAll('.mode-card');
    const timeSelector = document.getElementById('time-selector');
    const timeButtons = document.querySelectorAll('.time-btn');
    const backToModesBtn = document.getElementById('back-to-modes');
    const logoutButton = document.getElementById('logout-button');

    // Typing Screen Elements
    const textDisplay = document.getElementById('text-display');
    const hiddenInput = document.getElementById('hidden-input');
    const timerDisplay = document.getElementById('timer');
    const wpmLiveDisplay = document.getElementById('wpm-live');
    const accuracyLiveDisplay = document.getElementById('accuracy-live');

    // Results Screen Elements
    const performanceBadge = document.getElementById('performance-badge');
    const performanceLevel = document.getElementById('performance-level');
    const resultsWPM = document.getElementById('results-wpm');
    const resultsAccuracy = document.getElementById('results-accuracy');
    const resultsErrors = document.getElementById('results-errors');
    const certificateSection = document.getElementById('certificate-section');
    const leaderboardSection = document.getElementById('leaderboard-section');
    const tryAgainBtn = document.getElementById('try-again-btn');
    const downloadCertBtn = document.getElementById('download-cert-btn');

    // --- Utility Functions ---
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
        });
        screens[screenName].classList.add('active');
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    function getPerformanceLevel(wpm) {
        if (wpm >= 80) return { level: 'Elite', color: 'yellow' };
        if (wpm >= 60) return { level: 'Expert', color: 'green' };
        if (wpm >= 40) return { level: 'Advanced', color: 'cyan' };
        return { level: 'Beginner', color: 'cyan' };
    }

    // --- Backend Integration ---
    async function fetchTextFromBackend(minutes, mode) {
        try {
            const response = await fetch(`${BASE_URL}/api/generate-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timeLimit: minutes, mode })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data.text || '';
        } catch (error) {
            console.error('Error fetching text from backend:', error);
            // Fallback text if the API fails
            return "The quick brown fox jumps over the lazy dog. The world is full of amazing adventures waiting to be discovered. Please try again in a moment as we are experiencing technical difficulties with our text generation service.";
        }
    }

    // --- Screen Logic ---

    // Landing Screen
    getStartedBtn.addEventListener('click', () => showScreen('login'));

    // Login Screen
    nameInput.addEventListener('input', () => {
        const isNameValid = nameInput.value.trim() !== '';
        proceedButton.disabled = !isNameValid;
        proceedButton.classList.toggle('btn-disabled', !isNameValid);
    });

    proceedButton.addEventListener('click', () => {
        user.name = nameInput.value.trim();
        userNameDisplay.textContent = user.name;
        showScreen('modeSelection');
    });

    logoutButton.addEventListener('click', () => {
        user.name = '';
        nameInput.value = '';
        proceedButton.disabled = true;
        proceedButton.classList.add('btn-disabled');
        timeSelector.classList.add('hidden');
        document.querySelector('.mode-grid').style.display = 'grid';
        showScreen('login');
    });

    // Mode Selection
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            currentMode = card.dataset.mode;
            if (currentMode === 'contest') {
                startTest(1); // Contest is always 1 minute
            } else {
                timeSelector.classList.remove('hidden');
                document.querySelector('.mode-grid').style.display = 'none';
            }
        });
    });

    timeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const minutes = parseInt(button.dataset.time);
            startTest(minutes);
        });
    });

    backToModesBtn.addEventListener('click', () => {
        timeSelector.classList.add('hidden');
        document.querySelector('.mode-grid').style.display = 'grid';
        currentMode = '';
    });

    // --- Typing Test Core Logic ---
    function resetTestState() {
        clearInterval(timerInterval);
        timerInterval = null;
        timeLimit = 0;
        timeRemaining = 0;
        testText = '';
        currentIndex = 0;
        errors = 0;
        testStartTime = null;
        isTestActive = false;
        
        timerDisplay.textContent = '00:00';
        wpmLiveDisplay.textContent = '0';
        accuracyLiveDisplay.textContent = '100%';
        hiddenInput.value = '';
        textDisplay.innerHTML = `<p class="loader">Generating text...</p>`;
    }

    async function startTest(minutes) {
        resetTestState();
        timeLimit = minutes * 60;
        timeRemaining = timeLimit;
        timerDisplay.textContent = formatTime(timeLimit);
        showScreen('typing');
        
        testText = await fetchTextFromBackend(minutes, currentMode);
        renderText();
        hiddenInput.focus();
    }

    // *** SIMPLIFIED AND CORRECTED RENDER FUNCTION ***
    function renderText() {
        if (!testText.trim()) {
            textDisplay.innerHTML = '<p class="error-message">Failed to load text. Please try again.</p>';
            return;
        }
        
        // Simply render the text as a flat sequence of characters.
        // The browser's natural word wrapping will handle the lines correctly.
        textDisplay.innerHTML = testText.split('').map(char => `<span class="char">${char}</span>`).join('');
        
        // Set the first character as current
        const firstChar = textDisplay.querySelector('.char');
        if (firstChar) {
            firstChar.classList.add('char-current');
        }
    }


    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeRemaining--;
            timerDisplay.textContent = formatTime(timeRemaining);
            updateLiveStats();
            if (timeRemaining <= 0) {
                endTest();
            }
        }, 1000);
    }

    function updateLiveStats() {
        if (!testStartTime || !isTestActive) return;
        const elapsedTime = (Date.now() - testStartTime) / 1000 / 60; // in minutes
        if (elapsedTime > 0) {
            const grossWPM = Math.round((currentIndex / 5) / elapsedTime);
            wpmLiveDisplay.textContent = grossWPM.toString();
            const accuracy = currentIndex > 0 ? Math.round(((currentIndex - errors) / currentIndex) * 100) : 100;
            accuracyLiveDisplay.textContent = `${Math.max(0, accuracy)}%`;
        }
    }

    // *** MODIFIED FUNCTION FOR SMARTER AUTO-SCROLLING ***
    function autoScroll() {
        const currentCharacter = textDisplay.querySelector('.char-current');
        if (currentCharacter) {
            const textDisplayRect = textDisplay.getBoundingClientRect();
            const charRect = currentCharacter.getBoundingClientRect();

            // Check if the character's line is in the bottom half of the text box
            if (charRect.top > textDisplayRect.top + textDisplayRect.height / 2) {
                // 'center' is a good option to keep the active line in the middle
                currentCharacter.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }


    hiddenInput.addEventListener('keydown', (e) => {
        if (timeRemaining <= 0 || currentIndex >= testText.length) {
            e.preventDefault();
            return;
        }

        if (!isTestActive) {
            testStartTime = Date.now();
            isTestActive = true;
            startTimer();
        }

        const chars = textDisplay.querySelectorAll('.char');
        
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (currentIndex > 0) {
                currentIndex--;
                // If the character we are moving back to was marked incorrect, we can optionally adjust the error count
                if (chars[currentIndex].classList.contains('char-incorrect')) {
                    // This part can be complex. For now, we'll just reset the class.
                    // The main goal is visual correction.
                }
                chars[currentIndex].className = 'char char-current';
                if(chars[currentIndex + 1]) {
                    chars[currentIndex + 1].className = 'char';
                }
            }
            autoScroll(); // Scroll on backspace too
            return;
        }

        if (e.key.length > 1) return; 

        e.preventDefault();
        
        const expectedChar = testText[currentIndex];
        
        if (e.key === expectedChar) {
            chars[currentIndex].className = 'char char-correct';
        } else {
            chars[currentIndex].className = 'char char-incorrect';
            errors++;
        }
        
        currentIndex++;
        
        if (currentIndex < testText.length) {
            chars[currentIndex].classList.add('char-current');
        } else {
            endTest();
        }
        updateLiveStats();
        autoScroll(); // Scroll after every key press
    });

    async function submitScore(wpm, accuracy) {
        try {
            await fetch(`${BASE_URL}/api/submit-score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: user.name,
                    wpm,
                    accuracy,
                    mode: currentMode,
                    timeLimit: timeLimit / 60,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    }

    function endTest() {
        isTestActive = false;
        clearInterval(timerInterval);
        
        const timeElapsedInMinutes = (timeLimit - timeRemaining) / 60;
        if (timeElapsedInMinutes === 0) return;

        const netWPM = Math.round(((currentIndex - errors) / 5) / timeElapsedInMinutes);
        const accuracy = currentIndex > 0 ? Math.round(((currentIndex - errors) / currentIndex) * 100) : 0;
        
        submitScore(netWPM, accuracy);
        
        resultsWPM.textContent = netWPM.toString();
        resultsAccuracy.textContent = `${accuracy}%`;
        resultsErrors.textContent = errors.toString();
        
        const performance = getPerformanceLevel(netWPM);
        performanceLevel.textContent = `${performance.level} Typist`;
        performanceBadge.className = `performance-badge ${performance.color}`;
        
        certificateSection.classList.add('hidden');
        leaderboardSection.classList.add('hidden');
        
        if (currentMode === 'test') {
            showCertificateSection(netWPM, accuracy);
        }
        
        showScreen('results');
    }

    function showCertificateSection(wpm, accuracy) {
        certificateSection.classList.remove('hidden');
        document.getElementById('cert-name').textContent = user.name;
        document.getElementById('cert-wpm').textContent = `${wpm} WPM`;
        document.getElementById('cert-accuracy').textContent = `${accuracy}% accuracy`;
        const today = new Date();
        document.getElementById('cert-date').textContent = today.toLocaleDateString('en-GB');
    }

    downloadCertBtn.addEventListener('click', () => {
        const wpm = resultsWPM.textContent;
        const accuracy = resultsAccuracy.textContent;
        generateCertificate(user.name, wpm, accuracy);
    });

    function generateCertificate(name, wpm, accuracy) {
        const canvas = document.getElementById('certificateCanvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.src = 'Neon Type Racer Certificate.png'; 
        img.crossOrigin = "Anonymous";

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            ctx.textAlign = "center";
            ctx.fillStyle = "#000000";

            ctx.font = "bold 60px 'Russo One'";
            ctx.fillText(name, img.width / 2, 630);

            ctx.font = "bold 100px 'Russo One'";
            ctx.fillText(wpm, img.width * 0.255, img.height * 0.75);

            ctx.font = "bold 100px 'Russo One'";
            ctx.fillText(accuracy, img.width * 0.51, img.height * 0.75);

            const today = new Date();
            const dateString = today.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            ctx.font = "bold 60px 'Russo One'";
            ctx.fillText(dateString, img.width * 0.756, img.height * 0.75);

            const link = document.createElement('a');
            link.download = `Typing_Certificate_${name.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.onerror = () => {
            alert("Could not load the certificate image. Make sure 'Neon Type Racer Certificate.png' is in the frontend folder and you are running the project from a local server.");
        }
    }

    tryAgainBtn.addEventListener('click', () => {
        resetTestState();
        timeSelector.classList.add('hidden');
        document.querySelector('.mode-grid').style.display = 'grid';
        currentMode = '';
        showScreen('modeSelection');
    });

    textDisplay.addEventListener('click', () => hiddenInput.focus());

    hiddenInput.addEventListener('blur', () => {
        if (screens.typing.classList.contains('active')) {
            setTimeout(() => hiddenInput.focus(), 0);
        }
    });

    showScreen('landing');
});

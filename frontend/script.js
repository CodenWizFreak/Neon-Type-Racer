// Neon Type-Racer JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
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
    const getStartedBtn = document.getElementById('get-started-btn');
    const nameInput = document.getElementById('name-input');
    const proceedButton = document.getElementById('proceed-button');
    const userNameDisplay = document.getElementById('user-name');
    const modeCards = document.querySelectorAll('.mode-card');
    const timeSelector = document.getElementById('time-selector');
    const timeButtons = document.querySelectorAll('.time-btn');
    const backToModesBtn = document.getElementById('back-to-modes');
    const logoutButton = document.getElementById('logout-button');
    const textDisplay = document.getElementById('text-display');
    const hiddenInput = document.getElementById('hidden-input');
    const timerDisplay = document.getElementById('timer');
    const wpmLiveDisplay = document.getElementById('wpm-live');
    const accuracyLiveDisplay = document.getElementById('accuracy-live');
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
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
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

    // --- Main Application Flow ---
    
    // Initialize
    showScreen('landing');
    getStartedBtn.addEventListener('click', () => showScreen('login'));

    // Login
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

    // --- REFACTORED: Centralized Test Starting Logic ---

    // Mode Selection
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.dataset.mode;
            currentMode = mode; // Set the current mode IMMEDIATELY

            if (mode === 'contest') {
                // For contest, the time is always 1 minute
                startTest(mode, 1);
            } else {
                // For other modes, show the time selector
                timeSelector.classList.remove('hidden');
                document.querySelector('.mode-grid').style.display = 'none';
            }
        });
    });

    // Time Selection for Practice/Test modes
    timeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const minutes = parseInt(button.dataset.time);
            // The `currentMode` was already set when the user clicked "Practice" or "Test"
            startTest(currentMode, minutes);
        });
    });

    backToModesBtn.addEventListener('click', () => {
        timeSelector.classList.add('hidden');
        document.querySelector('.mode-grid').style.display = 'grid';
        currentMode = '';
    });

    // --- Typing Test Logic ---
    function resetTestState() {
        clearInterval(timerInterval);
        timerInterval = null;
        timeRemaining = 0;
        currentIndex = 0;
        errors = 0;
        isTestActive = false;
        testStartTime = null;
        timerDisplay.textContent = '00:00';
        wpmLiveDisplay.textContent = '0';
        accuracyLiveDisplay.textContent = '100%';
        hiddenInput.value = '';
        textDisplay.innerHTML = `<p class="loader">Getting ready...</p>`;
    }

    // *** MODIFIED for better UI responsiveness ***
    async function startTest(mode, minutes) {
        resetTestState();
        timeLimit = minutes * 60;
        timeRemaining = timeLimit;
        timerDisplay.textContent = formatTime(timeLimit);
        
        // 1. Show the typing screen immediately with a loading message
        showScreen('typing');
        textDisplay.innerHTML = `<p class="loader">Generating text...</p>`;

        try {
            let textToUse;

            if (mode === 'contest') {
                const statusResponse = await fetch(`${BASE_URL}/api/daily-contest/status?name=${encodeURIComponent(user.name)}`);
                if (!statusResponse.ok) throw new Error('Could not check contest status.');
                const { hasPlayed } = await statusResponse.json();

                if (hasPlayed) {
                    alert("You have already completed today's contest. Check back tomorrow!");
                    showScreen('modeSelection');
                    timeSelector.classList.add('hidden');
                    document.querySelector('.mode-grid').style.display = 'grid';
                    return;
                }

                const textResponse = await fetch(`${BASE_URL}/api/daily-contest/text`);
                if (!textResponse.ok) throw new Error('Could not fetch daily contest text.');
                const { text } = await textResponse.json();
                textToUse = text;

            } else {
                const response = await fetch(`${BASE_URL}/api/generate-text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ timeLimit: minutes, mode })
                });
                if (!response.ok) throw new Error('Could not fetch practice text.');
                const { text } = await response.json();
                textToUse = text;
            }

            // 2. Once text is fetched, render it and focus the input
            testText = textToUse;
            renderText();
            hiddenInput.focus();

        } catch (error) {
            console.error('Error starting test:', error);
            textDisplay.innerHTML = `<p class="error-message">Could not start the test: ${error.message}</p>`;
        }
    }

    function renderText() {
        if (!testText || !testText.trim()) {
            textDisplay.innerHTML = '<p class="error-message">Failed to load text. Please try again.</p>';
            return;
        }
        textDisplay.innerHTML = testText.split('').map(char => `<span class="char">${char}</span>`).join('');
        const firstChar = textDisplay.querySelector('.char');
        if (firstChar) {
            firstChar.classList.add('char-current');
        }
    }

    function autoScroll() {
        const currentCharacter = textDisplay.querySelector('.char-current');
        if (currentCharacter) {
            const textDisplayRect = textDisplay.getBoundingClientRect();
            const charRect = currentCharacter.getBoundingClientRect();
            if (charRect.top > textDisplayRect.top + textDisplayRect.height / 2) {
                currentCharacter.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    hiddenInput.addEventListener('keydown', (e) => {
        if (timeRemaining <= 0 || !testText || currentIndex >= testText.length) {
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
                chars[currentIndex].className = 'char char-current';
                if(chars[currentIndex + 1]) chars[currentIndex + 1].className = 'char';
            }
            autoScroll();
            return;
        }

        if (e.key.length > 1) return; 

        e.preventDefault();
        
        if (e.key === testText[currentIndex]) {
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
        autoScroll();
    });

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeRemaining--;
            timerDisplay.textContent = formatTime(timeRemaining);
            updateLiveStats();
            if (timeRemaining <= 0) endTest();
        }, 1000);
    }

    function updateLiveStats() {
        if (!testStartTime) return;
        const elapsedTime = (Date.now() - testStartTime) / 1000 / 60;
        if (elapsedTime > 0) {
            const grossWPM = Math.round((currentIndex / 5) / elapsedTime);
            wpmLiveDisplay.textContent = grossWPM.toString();
            const accuracy = currentIndex > 0 ? Math.round(((currentIndex - errors) / currentIndex) * 100) : 100;
            accuracyLiveDisplay.textContent = `${Math.max(0, accuracy)}%`;
        }
    }

    async function endTest() {
        isTestActive = false;
        clearInterval(timerInterval);
        
        const timeElapsedInMinutes = (timeLimit - (timeRemaining > 0 ? timeRemaining : 0)) / 60;
        if (timeElapsedInMinutes === 0) return;

        const netWPM = Math.round(((currentIndex - errors) / 5) / timeElapsedInMinutes);
        const accuracy = currentIndex > 0 ? Math.round(((currentIndex - errors) / currentIndex) * 100) : 0;
        
        await submitScore(netWPM, accuracy);
        
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
        } else if (currentMode === 'contest') {
            await showLeaderboardSection();
        }
        
        showScreen('results');
    }

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
                    timeLimit: timeLimit / 60
                })
            });
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    }

    // --- Results Screen Logic ---

    function showCertificateSection(wpm, accuracy) {
        certificateSection.classList.remove('hidden');
        document.getElementById('cert-name').textContent = user.name;
        document.getElementById('cert-wpm').textContent = `${wpm} WPM`;
        document.getElementById('cert-accuracy').textContent = `${accuracy}% accuracy`;
        document.getElementById('cert-date').textContent = new Date().toLocaleDateString('en-GB');
    }

    async function showLeaderboardSection() {
        leaderboardSection.classList.remove('hidden');
        const leaderboardBody = document.getElementById('leaderboard-body');
        leaderboardBody.innerHTML = '<p class="loader">Loading leaderboard...</p>';

        try {
            const response = await fetch(`${BASE_URL}/api/leaderboard?name=${encodeURIComponent(user.name)}`);
            if (!response.ok) throw new Error('Failed to fetch leaderboard');
            
            const { top10, userRank } = await response.json();
            displayLeaderboard(top10, userRank);

        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            leaderboardBody.innerHTML = '<p class="error-message">Could not load leaderboard.</p>';
        }
    }

    function displayLeaderboard(top10, userRank) {
        const leaderboardBody = document.getElementById('leaderboard-body');
        leaderboardBody.innerHTML = '';

        top10.forEach((entry, index) => {
            const row = document.createElement('div');
            const isCurrentUser = entry.name === user.name;
            row.className = `leaderboard-row ${isCurrentUser ? 'current-user' : ''}`;
            
            const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

            row.innerHTML = `
                <div class="rank ${rankClass}">${index + 1}</div>
                <div>${entry.name}</div>
                <div>${entry.wpm}</div>
                <div>${entry.accuracy}%</div>
            `;
            leaderboardBody.appendChild(row);
        });

        if (userRank && !top10.some(score => score.name === user.name)) {
            if (top10.length >= 10) {
                const separator = document.createElement('div');
                separator.className = 'leaderboard-separator';
                separator.textContent = '...';
                leaderboardBody.appendChild(separator);
            }

            const userRow = document.createElement('div');
            userRow.className = 'leaderboard-row current-user';
            userRow.innerHTML = `
                <div class="rank">${userRank.rank}</div>
                <div>${userRank.name}</div>
                <div>${userRank.wpm}</div>
                <div>${userRank.accuracy}%</div>
            `;
            leaderboardBody.appendChild(userRow);
        }
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
            
            // Name
            ctx.font = "bold 60px 'Russo One'";
            ctx.fillText(name, img.width / 2, 630);
            
            // WPM and Accuracy
            ctx.font = "bold 100px 'Russo One'";
            ctx.fillText(wpm, img.width * 0.255, img.height * 0.75);
            
            // Use accuracy as-is since it already contains the % symbol
            ctx.fillText(accuracy, img.width * 0.51, img.height * 0.75);
            
            // Date
            const dateString = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            ctx.font = "bold 60px 'Russo One'";
            ctx.fillText(dateString, img.width * 0.756, img.height * 0.75);
            
            // Download
            const link = document.createElement('a');
            link.download = `Typing_Certificate_${name.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.onerror = () => alert("Could not load certificate image. Ensure it's in the frontend folder and you're using a local server.");
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
});

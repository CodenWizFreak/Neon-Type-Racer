// Neon Type-Racer JavaScript

// Make the Google Sign-In handler globally accessible
function handleGoogleSignIn(response) {
    // This function is called by the Google Sign-In library.
    // It creates a custom event that our main script can listen for.
    const event = new CustomEvent('google-signin', { detail: response });
    document.dispatchEvent(event);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const BASE_URL = 'http://localhost:3000'; 

    // State Management
    let user = { name: '', email: '' }; // User object now includes email
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
        newUser: document.getElementById('new-user-screen'), // New screen for registration
        modeSelection: document.getElementById('mode-selection-screen'),
        typing: document.getElementById('typing-screen'),
        results: document.getElementById('results-screen')
    };
    const getStartedBtn = document.getElementById('get-started-btn');
    const userNameDisplay = document.getElementById('user-name');
    const logoutButton = document.getElementById('logout-button');
    const modeCards = document.querySelectorAll('.mode-card');
    const timeSelector = document.getElementById('time-selector');
    const timeButtons = document.querySelectorAll('.time-btn');
    const backToModesBtn = document.getElementById('back-to-modes');
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
    
    // New User Screen Elements
    const newUserDisplayName = document.getElementById('new-user-name-display');
    const newUserNameInput = document.getElementById('new-user-name-input');
    const yearOfBirthSelect = document.getElementById('year-of-birth-select');
    const completeRegBtn = document.getElementById('complete-registration-btn');


    // --- Utility Functions ---
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
        }
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

    function checkForSavedUser() {
        const savedUser = localStorage.getItem('typingUser');
        if (savedUser) {
            user = JSON.parse(savedUser);
            userNameDisplay.textContent = user.name;
            showScreen('modeSelection');
        } else {
            showScreen('landing');
        }
    }

    // Listen for the custom event from the global sign-in handler
    document.addEventListener('google-signin', async (event) => {
        const idToken = event.detail.credential;
        try {
            const res = await fetch(`${BASE_URL}/api/auth/google/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: idToken })
            });

            if (!res.ok) throw new Error('Authentication failed.');
            
            const data = await res.json();
            
            if (data.isNewUser) {
                // Store temporary user info and show registration screen
                user = data.user;
                newUserDisplayName.textContent = user.name;
                newUserNameInput.value = user.name;
                showScreen('newUser');
            } else {
                // Existing user, log them in
                user = data.user;
                localStorage.setItem('typingUser', JSON.stringify(user));
                userNameDisplay.textContent = user.name;
                showScreen('modeSelection');
            }
        } catch (error) {
            console.error('Sign-in error:', error);
            alert('Google Sign-In failed. Please try again.');
        }
    });

    function populateYearSelect() {
        // Generate years from 2022 down to 1940
        for (let year = 2022; year >= 1940; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearOfBirthSelect.appendChild(option);
        }
    }

    function validateNewUserInfo() {
        const name = newUserNameInput.value.trim();
        const year = yearOfBirthSelect.value;
        completeRegBtn.disabled = !(name && year);
    }

    newUserNameInput.addEventListener('input', validateNewUserInfo);
    yearOfBirthSelect.addEventListener('change', validateNewUserInfo);

    completeRegBtn.addEventListener('click', async () => {
        const name = newUserNameInput.value.trim();
        const yearOfBirth = yearOfBirthSelect.value;

        try {
            const res = await fetch(`${BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, name, yearOfBirth })
            });

            if (!res.ok) throw new Error('Registration failed.');
            
            const data = await res.json();
            user = data.user;
            localStorage.setItem('typingUser', JSON.stringify(user));
            userNameDisplay.textContent = user.name;
            showScreen('modeSelection');

        } catch (error) {
            console.error('Registration error:', error);
            alert('Could not complete registration. Please try again.');
        }
    });

    logoutButton.addEventListener('click', () => {
        user = { name: '', email: '' };
        localStorage.removeItem('typingUser');
        showScreen('login');
    });
    
    getStartedBtn.addEventListener('click', () => showScreen('login'));

    // --- Test Starting Logic ---
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.dataset.mode;
            currentMode = mode;
            if (mode === 'contest') {
                startTest(mode, 1);
            } else {
                timeSelector.classList.remove('hidden');
                document.querySelector('.mode-grid').style.display = 'none';
            }
        });
    });

    timeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const minutes = parseInt(button.dataset.time);
            startTest(currentMode, minutes);
        });
    });

    backToModesBtn.addEventListener('click', () => {
        timeSelector.classList.add('hidden');
        document.querySelector('.mode-grid').style.display = 'grid';
        currentMode = '';
    });
    
    async function startTest(mode, minutes) {
        resetTestState();
        timeLimit = minutes * 60;
        timeRemaining = timeLimit;
        timerDisplay.textContent = formatTime(timeLimit);
        
        showScreen('typing');
        textDisplay.innerHTML = `<p class="loader">Generating text...</p>`;

        try {
            let textToUse;

            if (mode === 'contest') {
                const statusResponse = await fetch(`${BASE_URL}/api/daily-contest/status?email=${encodeURIComponent(user.email)}`);
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

            testText = textToUse;
            renderText();
            hiddenInput.focus();

        } catch (error) {
            console.error('Error starting test:', error);
            textDisplay.innerHTML = `<p class="error-message">Could not start the test: ${error.message}</p>`;
        }
    }

    function resetTestState() {
        currentIndex = 0;
        errors = 0;
        testStartTime = null;
        isTestActive = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        wpmLiveDisplay.textContent = '0';
        accuracyLiveDisplay.textContent = '100%';
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
                    email: user.email,
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

    async function showLeaderboardSection() {
        leaderboardSection.classList.remove('hidden');
        const leaderboardBody = document.getElementById('leaderboard-body');
        leaderboardBody.innerHTML = '<p class="loader">Loading leaderboard...</p>';

        try {
            const response = await fetch(`${BASE_URL}/api/leaderboard?email=${encodeURIComponent(user.email)}`);
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
            const isCurrentUser = entry.email === user.email;
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

        if (userRank && !top10.some(score => score.email === user.email)) {
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

    function showCertificateSection(wpm, accuracy) {
        certificateSection.classList.remove('hidden');
        document.getElementById('cert-name').textContent = user.name;
        document.getElementById('cert-wpm').textContent = `${wpm} WPM`;
        document.getElementById('cert-accuracy').textContent = `${accuracy} accuracy`;
        document.getElementById('cert-date').textContent = new Date().toLocaleDateString('en-GB');
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
            ctx.fillText(`${accuracy}`, img.width * 0.51, img.height * 0.75);
            const dateString = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            ctx.font = "bold 60px 'Russo One'";
            ctx.fillText(dateString, img.width * 0.756, img.height * 0.75);
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

    // Initialize the application
    populateYearSelect();
    checkForSavedUser();
});
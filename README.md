
# ⌨️💨 Neon Type Racer

A web-based Typing Speed Test application with Practice, Typing Test, and Contest modes. Features real-time text highlighting, WPM and accuracy calculation, leaderboards, Gemini-generated paragraphs, and a downloadable certificate for Typing Test mode, built with pure HTML, CSS, JavaScript, and Node.js backend.

## 🌟 Features

-   **Three Modes:** Practice (1/2/5 min), Typing Test (1/2/5 min + certificate), Daily Live Contest (1 min fixed)
-   ** Google Auth 2.0:** Google authentication for hassle free sign-in sign-up experience.
-   **Gemini API Integration:** Dynamic paragraph generation for varied typing experiences.
-   **Real-time Feedback:** Color-coded highlights (correct/incorrect/current) for immediate typing feedback.
-   **Accurate Metrics:** WPM and accuracy calculation for performance tracking.
-   **Contest Leaderboard:** Backend storage and ranking for competitive typing.
-   **Downloadable Certificate:** Generate and download a certificate using Canvas API for the Typing Test mode.
-   **Responsive Design:** Clean, card-style UI that adapts to different screen sizes.
-   **Lightweight Frontend:** Built with pure HTML, CSS, and JavaScript (no frameworks).
-   **Node.js Backend:** Express backend with in-memory storage (DB-ready).
-   **CORS Enabled:** API endpoints for seamless frontend-backend communication.

## 🛠️ Technologies Used

-   **Frontend:** HTML, CSS, JavaScript - For building the user interface and handling user interactions.
-   **Backend:** Node.js, Express - For handling API requests, data processing, and server-side logic.
-   **Database:** MongoDB - For storing and managing leaderboard data.
-   **Gemini API:** For generating dynamic paragraphs for typing tests.
-   **Canvas API:** For generating the downloadable certificate in Typing Test mode.

## ⚙️ Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/CodenWizFreak/Neon-Type-Racer.git
    ```

2.  Navigate to the project directory:
    ```bash
    cd neon-type-racer
    ```
3. Navigate to backend directory and create a .env file and start daily contest server:
   ```bash
   cd backend
   ```
   In the .env file, fill the following:
   ```bash
   GEMINI_API_KEY = "your_api_key"
   PORT = 3000
   NODE_ENV = development
   MONGODB_URI = "your_mongodb_uri"
   ```
   ```bash
   npm install
   node generateDailyText.js
   node server.js
   ```

4.  Navigate to the frontend directory and serve the application:
    ```bash
    cd frontend
    npx serve
    ```

5.  Open the link provided by `npx serve` in your browser.


## 🚀 How to Use

1.  **Select a Mode:** Choose between Practice, Typing Test, and Daily Live Contest modes.
2.  **Start Typing:** Begin typing the displayed text.
3.  **Monitor Progress:** Watch the real-time feedback, WPM, and accuracy calculations.
4.  **Compete (Contest Mode):** See your ranking on the leaderboard after completing a contest.
5.  **Download Certificate (Typing Test):** Download a certificate upon completion of the Typing Test mode.

## 🤝 Contribution

Feel free to fork this repository, raise issues, or submit pull requests to add features, improve the design, or fix bugs. We welcome contributions from the community!

## 📜 License

This project is licensed under the [MIT License](LICENSE).

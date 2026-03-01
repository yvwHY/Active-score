# Active Score: A Collective Sonic Archive

**Active Score** is an interactive web-based installation that explores the transformation of personal biometric data (voice) into a collective visual and auditory archive. By capturing real-time pitch data and aggregating it into a shared musical staff, the project investigates the boundaries between individual expression and big data accumulation.

---

## 📝 Concept: Big Data, Small Data
In this project, the human voice is treated as **"Small Data"**—personal, intimate, and ephemeral. The system extracts specific metadata (MIDI-mapped frequencies) using a pre-trained Machine Learning model (CREPE) and stores it in a centralized Node.js server. As more users contribute, these individual "Small Data" fragments coalesce into a complex **"Big Data"** visualization, forming a permanent (yet anonymized) record of a collective moment.



## 🚀 Key Features
* **Real-time Pitch Extraction:** Utilizes `ml5.js` (CREPE model) to analyze vocal frequencies from the user's microphone.
* **Linear Data Visualization:** Maps pitch history to a horizontal timeline, creating organic, flowing trajectories using `p5.js` and `curveVertex`.
* **Collaborative Choir:** A networked experience where users can play back the entire archive of uploaded voices simultaneously (The "Distributed Choir" logic).
* **Data Persistence:** Uses a Node.js backend to manage a JSON-based archive of pitch metadata and audio files.

## 🛠️ Technical Stack
* **Frontend:** `p5.js` (Creative Coding), `ml5.js` (Machine Learning), `Socket.io-client`.
* **Backend:** `Node.js`, `Express` (Web Server), `Socket.io` (WebSockets).
* **Deployment:** Hosted on **Render** with a JSON-based data collection system.

---

## ⚖️ Data Ethics & GDPR
Adhering to the **"Big Data, Small Data"** brief and GDPR principles:
1.  **Anonymization:** No personal identifiers (names, emails) are stored. Users are represented only by temporary socket IDs.
2.  **Data Transparency:** The process of data extraction (pitch analysis) is visualized in real-time to the user during recording.
3.  **Ephemeral Storage:** On Render's free tier, the file system is temporary. This ensures that personal audio data is not stored indefinitely, respecting the ephemeral nature of the "Small Data" brief.

## 🔧 Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yvwHY/Active-score.git](https://github.com/yvwHY/Active-score.git)
   cd Active-score
2. **Install dependencies:**
   ```bash
   npm install
3. **Run the server:**
   ```bash
   node server.js
4. **Open in browser:**
   Navigate to http://localhost:10000

# Active-score

Active Score: A Collective Sonic Archive
Active Score is an interactive web-based installation that explores the transformation of personal biometric data (voice) into a collective visual and auditory archive. By capturing real-time pitch data and aggregating it into a shared musical staff, the project investigates the boundaries between individual expression and big data accumulation.

📝 Concept: Big Data, Small Data
In this project, the human voice is treated as "Small Data"—personal, intimate, and ephemeral. The system extracts specific metadata (MIDI-mapped frequencies) using a pre-trained Machine Learning model (CREPE) and stores it in a centralized Node.js server. As more users contribute, these individual "Small Data" fragments coalesce into a complex "Big Data" visualization, forming a permanent (yet anonymized) record of a collective moment.

🚀 Key Features
Real-time Pitch Extraction: Utilizes ml5.js (CREPE model) to analyze vocal frequencies from the user's microphone.

Linear Data Visualization: Maps pitch history to a horizontal timeline, creating organic, flowing trajectories using p5.js and curveVertex.

Collaborative Choir: A networked experience where users can play back the entire archive of uploaded voices simultaneously.

Data Persistence: Uses a Node.js backend to manage a JSON-based archive of pitch metadata and audio files.

🛠️ Technical Stack
Frontend: p5.js (Creative Coding), ml5.js (Machine Learning), Socket.io-client (Real-time communication).

Backend: Node.js, Express (Web Server), Socket.io (WebSockets).

Deployment: Hosted on Render with a persistent (session-based) JSON archive.

⚖️ Data Ethics & GDPR
Adhering to the "Big Data, Small Data" brief and GDPR principles:

Anonymization: No personal identifiers (names, emails) are stored. Users are identified only by temporary socket IDs.

Data Transparency: The process of data extraction (pitch analysis) is visualized in real-time to the user during the recording process.

Security: Audio files and metadata are stored in a structured but anonymized manner.

🔧 Installation & Local Setup
Clone the repository:

Bash
git clone https://github.com/yvwHY/Active-score.git
cd Active-score
Install dependencies:

Bash
npm install
Run the server:

Bash
node server.js
Open in browser:
Navigate to http://localhost:10000

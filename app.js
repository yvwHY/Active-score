import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";

// 1. Basic paths and environment setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 10000; // Default Port 10000 for Render deployment

const app = express();
const httpServer = createServer(app);

// 2. Socket.io Configuration: Increased buffer limits to handle audio data
const io = new Server(httpServer, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e7 // Set limit to 10MB for high-quality .wav files
});

// 3. Automated directory structure creation
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");
const dataFilePath = path.join(__dirname, "audio_data.json");

[publicDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[System] Created directory: ${dir}`);
    }
});

app.use(express.static(publicDir));

// 4. Global Data Storage: Archive of recorded audio and pitch metadata
let audioLibrary = [];

// [Archive] Load historical data from JSON if it exists
if (fs.existsSync(dataFilePath)) {
    try {
        audioLibrary = JSON.parse(fs.readFileSync(dataFilePath));
        console.log(`[Archive] Successfully loaded ${audioLibrary.length} records.`);
    } catch (e) {
        console.log("[Archive] No existing data found. Starting a new archive.");
    }
}

// 5. Socket.io Core Logic
io.on("connection", (socket) => {
    console.log(`[Connection] User connected: ${socket.id}`);

    // [Initialization] Sync the full score history for the new user
    socket.emit("init-score-history", audioLibrary);

    socket.on("upload-audio", (data) => {
        if (!data || !data.audio) {
            console.error("[Upload] Invalid data received.");
            return;
        }

        const fileName = `voice-${Date.now()}.wav`;
        const filePath = path.join(uploadDir, fileName);

        // Save the audio file to the local directory
        fs.writeFile(filePath, data.audio, (err) => {
            // Note: On Render free tier, file system is ephemeral and may return errors on restart
            if (err) {
                console.error("[Storage] Write error (Note: Render disk is temporary):", err);
            }

            // Create a new data entry containing the URL and the analyzed pitch array
            const newDataEntry = {
                url: `/uploads/${fileName}`,
                pitches: data.pitches || [],
                timestamp: Date.now()
            };

            audioLibrary.push(newDataEntry);

            // [Persistence] Attempt to update the JSON archive file
            fs.writeFile(dataFilePath, JSON.stringify(audioLibrary), (err) => {
                if (err) console.error("[Storage] JSON update failed.");
            });

            // A. Confirm successful upload to the sender to update their UI
            socket.emit("upload-success");

            // B. Broadcast the new score data to ALL connected users in real-time
            io.emit("new-score-line", newDataEntry);

            console.log(`[File Saved] Processed upload: ${fileName}`);
        });
    });

    socket.on("disconnect", () => {
        console.log(`[Disconnect] User disconnected: ${socket.id}`);
    });
});

// 6. Start the Server
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`  Musical Score Server is running!`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Public Path: ${publicDir}`);
    console.log(`=========================================`);
});
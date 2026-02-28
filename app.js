import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";

// 1. Basic paths and environment setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);

// Updated Server Config: Fixed the "stuck on upload" issue by increasing buffer size
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Increase limit to 10MB to handle high-quality .wav files from mobile
    maxHttpBufferSize: 1e7,
    // Extend timeouts for more stable connections on external networks
    pingTimeout: 60000,
    pingInterval: 25000
});

// 2. Automated directory structure creation
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");

[publicDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[System] Created directory: ${dir}`);
    }
});

app.use(express.static(publicDir));

// 3. Global variable: Stores the list of all recorded audio URLs
let audioFiles = [];

// 4. Socket.io core logic
io.on("connection", (socket) => {
    console.log(`[Connection] User connected: ${socket.id}`);

    // [Initialization] Sync history for the new user
    socket.emit("init-audio-list", audioFiles);

    socket.on("upload-audio", (data) => {
        if (!data || !data.audio) {
            console.error("Invalid audio data received");
            return;
        }

        const fileName = `voice-${Date.now()}-${socket.id.substring(0, 4)}.wav`;
        const filePath = path.join(uploadDir, fileName);

        fs.writeFile(filePath, data.audio, (err) => {
            if (err) {
                console.error("Storage failed:", err);
                socket.emit("upload-error");
                return;
            }

            const fileUrl = `/uploads/${fileName}`;
            console.log(`[File Saved] ${fileName} by ${socket.id}`);

            audioFiles.push(fileUrl);

            // A. Confirm success to sender
            socket.emit("upload-success", { url: fileUrl });

            // B. Sync the new ball/voice to EVERYONE else in real-time
            io.emit("new-voice", {
                url: fileUrl,
                id: socket.id,
                total: audioFiles.length
            });
        });
    });

    socket.on("disconnect", () => {
        console.log(`[Disconnect] User disconnected: ${socket.id}`);
    });
});

// 5. Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`  Distributed Choir Server is running!`);
    console.log(`  Port: ${PORT}`);
    console.log(`  Public Path: ${publicDir}`);
    console.log(`=========================================`);
});
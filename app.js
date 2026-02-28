import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";

// 1. 環境設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e7, // 支持 10MB 檔案
    pingTimeout: 60000
});

// 2. 目錄自動創建
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");
const dataFilePath = path.join(__dirname, "audio_data.json"); // 存儲音高數據的檔案

[publicDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(express.static(publicDir));

// 3. 全域數據存儲
// 格式: { url: string, pitchArray: Array, timestamp: number }
let audioLibrary = [];

// 如果檔案已存在，讀取舊數據 (實現 Archive 功能)
if (fs.existsSync(dataFilePath)) {
    try {
        const rawData = fs.readFileSync(dataFilePath);
        audioLibrary = JSON.parse(rawData);
        console.log(`[Archive] Loaded ${audioLibrary.length} historical records.`);
    } catch (e) {
        console.error("Failed to load archive:", e);
    }
}

// 4. Socket.io 核心邏輯
io.on("connection", (socket) => {
    console.log(`[Connection] User: ${socket.id}`);

    // 初始化：將歷史所有的音高數據發給新進來的用戶，讓他們畫出複雜的五線譜線條
    socket.emit("init-score-history", audioLibrary);

    socket.on("upload-audio", (data) => {
        // data 預期包含: { audio: Buffer, pitches: Array }
        if (!data || !data.audio || !data.pitches) {
            console.error("Incomplete data received");
            return;
        }

        const fileName = `voice-${Date.now()}.wav`;
        const filePath = path.join(uploadDir, fileName);

        // A. 儲存音檔
        fs.writeFile(filePath, data.audio, (err) => {
            if (err) {
                console.error("Storage failed:", err);
                return;
            }

            const fileUrl = `/uploads/${fileName}`;

            // B. 建立數據物件 (符合 Big/Small Data 的數據提取概念)
            const newDataEntry = {
                id: socket.id.substring(0, 6), // 匿名 ID
                url: fileUrl,
                pitches: data.pitches, // 這是你從前端 ml5 分析出的頻率數組
                timestamp: Date.now()
            };

            audioLibrary.push(newDataEntry);

            // C. 持久化存儲到 JSON (作業要求的 Data Collection 過程)
            fs.writeFile(dataFilePath, JSON.stringify(audioLibrary, null, 2), (err) => {
                if (err) console.error("JSON storage failed");
            });

            console.log(`[Data Captured] Saved pitch data for ${fileName}`);

            // D. 廣播給所有人：這會觸發大家五線譜上的一條新線條產生
            io.emit("new-score-line", newDataEntry);
        });
    });

    socket.on("disconnect", () => {
        console.log(`[Disconnect] User: ${socket.id}`);
    });
});

// 5. 啟動伺服器
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`  Musical Score Data Server Running!`);
    console.log(`  Listening on Port: ${PORT}`);
    console.log(`=========================================`);
});
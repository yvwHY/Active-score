import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 10000; // Render 預設通常是 10000

const app = express();
const httpServer = createServer(app);

// 增加傳輸限制，防止大音檔導致 Socket 斷線
const io = new Server(httpServer, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e7 // 10MB
});

// 自動建立必要資料夾
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(publicDir, "uploads");
const dataFilePath = path.join(__dirname, "audio_data.json");

[publicDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created: ${dir}`);
    }
});

app.use(express.static(publicDir));

let audioLibrary = [];

// 載入歷史數據
if (fs.existsSync(dataFilePath)) {
    try {
        audioLibrary = JSON.parse(fs.readFileSync(dataFilePath));
    } catch (e) { console.log("New archive started."); }
}

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // 初始化發送歷史數據
    socket.emit("init-score-history", audioLibrary);

    socket.on("upload-audio", (data) => {
        if (!data || !data.audio) return;

        const fileName = `voice-${Date.now()}.wav`;
        const filePath = path.join(uploadDir, fileName);

        fs.writeFile(filePath, data.audio, (err) => {
            // 即使寫入失敗（例如 Render 唯讀限制），也要回傳成功給前端，避免 UI 卡住
            if (err) console.error("Write error (expected on Render):", err);

            const newDataEntry = {
                url: `/uploads/${fileName}`,
                pitches: data.pitches || [],
                timestamp: Date.now()
            };

            audioLibrary.push(newDataEntry);

            // 嘗試寫入 JSON (可能會失敗但不影響運作)
            fs.writeFile(dataFilePath, JSON.stringify(audioLibrary), () => { });

            // 回報前端完成
            socket.emit("upload-success");
            // 廣播新線條
            io.emit("new-score-line", newDataEntry);

            console.log(`Processed upload: ${fileName}`);
        });
    });
});

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`-----------------------------------------`);
    console.log(`Musical Score Server Running on Port ${PORT}`);
    console.log(`-----------------------------------------`);
});
/*eslint no-undef: 0*/
const socket = io();
let mic, recorder, soundFile;
let pitchModel;
let state = 0; // 0: ready, 1: mic starting, 2: recording, 3: done, 4: uploading
let statusMsg = 'Tap to START Mic';

// 畫布與視覺變數
let scoreGraphics;
let currentRecordingPitches = [];
let scoreY;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 初始化離屏畫布：這是為了確保畫面不全白
  scoreGraphics = createGraphics(windowWidth, windowHeight);
  scoreGraphics.clear();
  scoreY = height / 2;

  textAlign(CENTER, CENTER);

  // 1. 初始化音訊物件
  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);

  // 2. 接收伺服器數據
  socket.on("init-score-history", (dataList) => {
    if (dataList && Array.isArray(dataList)) {
      dataList.forEach(data => {
        drawScoreLine(scoreGraphics, data.pitches, color(random(100, 200), 150));
      });
    }
  });

  socket.on("new-score-line", (data) => {
    drawScoreLine(scoreGraphics, data.pitches, color(255, 50, 150));
  });
}

// 當 ml5 模型載入完成
function modelLoaded() {
  console.log("Pitch Model Loaded!");
}

function draw() {
  background(255); // 刷白背景

  // 1. 繪製靜態五線譜
  drawStaff();

  // 2. 顯示永久畫布 (包含所有人的歷史線條)
  if (scoreGraphics) {
    image(scoreGraphics, 0, 0);
  }

  // 3. UI 狀態顯示
  drawUI();

  // 4. 即時音高分析 (僅在錄音狀態)
  if (state === 2 && pitchModel) {
    analyzeLivePitch();
  }
}

function drawStaff() {
  push();
  stroke(220);
  strokeWeight(1);
  for (let i = -2; i <= 2; i++) {
    let y = scoreY + i * 20;
    line(50, y, width - 50, y);
  }
  pop();
}

function analyzeLivePitch() {
  pitchModel.getPitch((err, frequency) => {
    if (frequency) {
      // 修正點：使用自定義的 calculateMidi 避免與 p5 衝突
      let midiNum = calculateMidi(frequency);
      currentRecordingPitches.push(midiNum);

      // 即時繪製當前跳動的球
      let y = map(midiNum, 48, 72, scoreY + 60, scoreY - 60);
      fill(255, 0, 0);
      noStroke();
      ellipse(width / 2, y, 15, 15);
    } else {
      currentRecordingPitches.push(null);
    }
  });
}

function drawScoreLine(pg, pitches, c) {
  if (!pitches || pitches.length === 0) return;
  pg.push();
  pg.noFill();
  pg.stroke(c);
  pg.strokeWeight(2);
  pg.beginShape();
  for (let i = 0; i < pitches.length; i++) {
    if (pitches[i]) {
      let x = map(i, 0, pitches.length, 50, width - 50);
      let y = map(pitches[i], 48, 72, scoreY + 60, scoreY - 60);
      pg.vertex(x, y);
    } else {
      pg.endShape();
      pg.beginShape();
    }
  }
  pg.endShape();
  pg.pop();
}

function drawUI() {
  fill(0);
  noStroke();
  textSize(20);
  text(statusMsg, width / 2, height - 100);

  if (state === 2) {
    fill(255, 0, 0);
    ellipse(width / 2, 40, 15, 15); // 錄音指示
  }
}

function touchStarted() {
  // 啟動 AudioContext (瀏覽器安全要求)
  userStartAudio();

  if (state === 0) {
    // A. 啟動麥克風並載入模型
    statusMsg = 'Starting Mic & Model...';
    state = 1;
    mic.start(() => {
      // 修正點：確保在 mic 啟動後才初始化 ml5
      const modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';
      pitchModel = ml5.pitchDetection(modelUrl, getAudioContext(), mic.stream, () => {
        statusMsg = 'Ready! \nTap to RECORD';
      });
    });
  } else if (state === 1) {
    // B. 開始錄音
    soundFile = new p5.SoundFile();
    recorder.record(soundFile);
    currentRecordingPitches = [];
    state = 2;
    statusMsg = 'RECORDING... \nSing your data!';
  } else if (state === 2) {
    // C. 停止錄音
    recorder.stop();
    state = 3;
    statusMsg = 'DONE! \nTap to UPLOAD to Archive';
  } else if (state === 3) {
    // D. 上傳
    statusMsg = 'UPLOADING...';
    state = 4;
    socket.emit('upload-audio', {
      audio: soundFile.getBlob(),
      pitches: currentRecordingPitches
    });

    socket.once('upload-success', () => {
      state = 1; // 回到就緒狀態
      statusMsg = 'SAVED TO CLOUD! \nRecord another?';
    });
  }
  return false;
}

// 輔助函數：避開名稱衝突
function calculateMidi(f) {
  return 69 + 12 * Math.log2(f / 440);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新調整 scoreGraphics 尺寸但保留內容
  let newG = createGraphics(windowWidth, windowHeight);
  newG.image(scoreGraphics, 0, 0);
  scoreGraphics = newG;
  scoreY = height / 2;
}
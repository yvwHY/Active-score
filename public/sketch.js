/*eslint no-undef: 0*/
const socket = io();
let mic, recorder, soundFile;
let pitchModel; // ml5 pitch detection
let state = 0; // 0: ready, 1: recording, 2: analyzing/done, 3: uploading
let statusMsg = 'Tap to START Mic';

// 畫布與視覺變數
let scoreGraphics; // 用於永久保存所有人的線條 (off-screen buffer)
let currentRecordingPitches = []; // 當前錄音的音高數據
let scoreY; // 五線譜的基準 Y 坐標

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 初始化離屏畫布
  scoreGraphics = createGraphics(windowWidth, windowHeight);
  scoreGraphics.clear(); // 確保透明
  scoreY = height / 2;

  textAlign(CENTER, CENTER);

  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);

  // 修正點：使用 getAudioContext() 替代 audioContext
  const modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';

  // 確保 mic 開始後再初始化 pitch，或者直接傳入串流
  pitchModel = ml5.pitchDetection(modelUrl, getAudioContext(), mic.stream, modelLoaded);

  socket.on("init-score-history", (dataList) => {
    dataList.forEach(data => {
      drawScoreLine(scoreGraphics, data.pitches, color(random(100, 200), 150));
    });
  });

  socket.on("new-score-line", (data) => {
    drawScoreLine(scoreGraphics, data.pitches, color(255, 50, 150));
  });
}

function modelLoaded() {
  console.log("Pitch Model Loaded!");
}

function draw() {
  background(255);

  // 1. 繪製背景五線譜
  drawStaff();

  // 2. 顯示已經存在的歷史線條 (由 scoreGraphics 提供)
  image(scoreGraphics, 0, 0);

  // 3. UI 狀態顯示
  drawUI();

  // 4. 即時音高追蹤 (錄音時顯示目前的跳動球)
  if (state === 1) {
    analyzeLivePitch();
  }
}

// 繪製靜態五線譜
function drawStaff() {
  stroke(200);
  strokeWeight(1);
  for (let i = -2; i <= 2; i++) {
    let y = scoreY + i * 20;
    line(50, y, width - 50, y);
  }
}

// 分析即時音高並存入陣列
function analyzeLivePitch() {
  pitchModel.getPitch((err, frequency) => {
    if (frequency) {
      let midiNum = freqToMidi(frequency);
      currentRecordingPitches.push(midiNum);

      // 畫一個即時跳動的球
      let y = map(midiNum, 48, 72, scoreY + 60, scoreY - 60); // 映射 C3-C5
      fill(255, 0, 0);
      noStroke();
      ellipse(width / 2, y, 20, 20);
    } else {
      currentRecordingPitches.push(null); // 代表無聲
    }
  });
}

// 將一組音高數據畫成五線譜上的線條
function drawScoreLine(pg, pitches, c) {
  pg.noFill();
  pg.stroke(c);
  pg.strokeWeight(3);
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
}

function drawUI() {
  fill(0);
  noStroke();
  textSize(24);
  text(statusMsg, width / 2, height - 150);

  if (state === 1) {
    fill(255, 0, 0, 100);
    ellipse(width / 2, 50, 20, 20); // 錄音指示燈
  }
}

function touchStarted() {
  userStartAudio();

  if (state === 0) {
    // 開始錄音
    mic.start(() => {
      soundFile = new p5.SoundFile();
      recorder.record(soundFile);
      currentRecordingPitches = [];
      state = 1;
      statusMsg = 'RECORDING... \nSing something!';
    });
  } else if (state === 1) {
    // 停止錄音
    recorder.stop();
    state = 2;
    statusMsg = 'DONE! \nTap to UPLOAD your data';
  } else if (state === 2) {
    // 上傳數據
    statusMsg = 'UPLOADING DATA...';
    let soundBlob = soundFile.getBlob();

    // 同時發送音檔與分析好的音高數據
    socket.emit('upload-audio', {
      audio: soundBlob,
      pitches: currentRecordingPitches
    });

    socket.once('upload-success', () => {
      state = 0;
      statusMsg = 'DATA SAVED! \nRecord again?';
    });
  }
  return false;
}

// 輔助函數：頻率轉 MIDI
function calculateMidi(f) {
  return 69 + 12 * Math.log2(f / 440);
}
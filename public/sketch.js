/*eslint no-undef: 0*/
const socket = io();
let mic, recorder, soundFile, pitchModel;
let state = 0; // 0: Start, 1: Ready, 2: Recording, 3: Done, 4: Uploading
let statusMsg = 'Tap to START Mic';

// 數據與視覺變數
let scoreGraphics;
let currentRecordingPitches = [];
let scoreY;
let allVoices = []; // 用於存放所有下載下來的聲音物件

function setup() {
  createCanvas(windowWidth, windowHeight);
  scoreGraphics = createGraphics(windowWidth, windowHeight);
  scoreGraphics.clear();
  scoreY = height / 2;
  textAlign(CENTER, CENTER);

  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);

  // 1. 初始化：載入歷史數據與音檔
  socket.on("init-score-history", (dataList) => {
    if (dataList) {
      dataList.forEach(d => {
        loadAndAddVoice(d.url); // 載入聲音
        drawScoreLine(scoreGraphics, d.pitches, color(150, 100)); // 繪製歷史線條
      });
    }
  });

  // 2. 接收即時的新數據
  socket.on("new-score-line", (data) => {
    loadAndAddVoice(data.url); // 即時下載新上傳的聲音
    drawScoreLine(scoreGraphics, data.pitches, color(255, 50, 150, 200));
  });
}

// 載入聲音並存入陣列 (保留你原本的集體播放邏輯)
function loadAndAddVoice(url) {
  loadSound(url, (s) => {
    s.setVolume(2.0); // 稍微放大音量
    allVoices.push(s);
  });
}

function draw() {
  background(255);
  drawStaff();

  // 繪製永久的線條畫布
  if (scoreGraphics) image(scoreGraphics, 0, 0);

  drawUI();

  // 3. 錄音時的線性跳動球
  if (state === 2 && pitchModel) {
    analyzeLivePitch();
  }
}

function drawStaff() {
  stroke(230);
  strokeWeight(1);
  for (let i = -2; i <= 2; i++) {
    line(50, scoreY + i * 20, width - 50, scoreY + i * 20);
  }
}

// 線性分析：讓球隨著錄音時間「向右跑」
function analyzeLivePitch() {
  pitchModel.getPitch((err, frequency) => {
    if (frequency) {
      let midiNum = 69 + 12 * Math.log2(frequency / 440);
      currentRecordingPitches.push(midiNum);

      // 計算當前 X 位置：隨著陣列長度（時間）增加而往右移
      let x = map(currentRecordingPitches.length, 0, 300, 50, width - 50); // 假設最長錄音 300 幀
      let y = map(midiNum, 48, 72, scoreY + 60, scoreY - 60);

      // 繪製當前的跳動紅球
      fill(255, 0, 0);
      noStroke();
      ellipse(x, y, 12, 12);
    } else {
      currentRecordingPitches.push(null);
    }
  });
}

// 繪製線性的軌跡
function drawScoreLine(pg, pitches, c) {
  if (!pitches) return;
  pg.push();
  pg.stroke(c);
  pg.strokeWeight(2);
  pg.noFill();
  pg.beginShape();
  for (let i = 0; i < pitches.length; i++) {
    if (pitches[i]) {
      // 關鍵：將索引值 i 映射到 X 軸，達成線性效果
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
  // 底部播放按鈕區塊
  fill(0, 150, 255, 200);
  rectMode(CENTER);
  rect(width / 2, height - 50, 200, 50, 10);
  fill(255);
  textSize(18);
  text("PLAY CHOIR", width / 2, height - 50);

  // 狀態文字
  fill(0);
  text(statusMsg, width / 2, height - 120);

  if (state === 2) {
    fill(255, 0, 0);
    ellipse(30, 30, 15, 15);
  }

  // 顯示目前載入的聲音數量
  textSize(14);
  text(`Total Voices: ${allVoices.length}`, width / 2, 30);
}

function touchStarted() {
  userStartAudio();

  // 點擊播放按鈕邏輯
  if (mouseY > height - 75 && mouseY < height - 25 && mouseX > width / 2 - 100 && mouseX < width / 2 + 100) {
    allVoices.forEach(v => {
      if (v.isLoaded()) v.play();
    });
    return false;
  }

  // 錄音流程控制
  if (state === 0) {
    statusMsg = 'Loading Model...';
    mic.start(() => {
      const modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';
      pitchModel = ml5.pitchDetection(modelUrl, getAudioContext(), mic.stream, () => {
        state = 1;
        statusMsg = 'Ready! Tap to Record';
      });
    });
  } else if (state === 1) {
    soundFile = new p5.SoundFile();
    recorder.record(soundFile);
    currentRecordingPitches = [];
    state = 2;
    statusMsg = 'Recording... Tap to Stop';
  } else if (state === 2) {
    recorder.stop();
    state = 3;
    statusMsg = 'Done! Tap to Upload';
  } else if (state === 3) {
    state = 4;
    statusMsg = 'Uploading Data...';
    socket.emit('upload-audio', {
      audio: soundFile.getBlob(),
      pitches: currentRecordingPitches
    });
    socket.once('upload-success', () => {
      state = 1;
      statusMsg = 'Saved! Tap to record another';
    });
  }
  return false;
}
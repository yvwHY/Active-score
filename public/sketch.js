/*eslint no-undef: 0*/
const socket = io();
let mic, recorder, soundFile, pitchModel;
let state = 0;
let statusMsg = 'Tap to START Mic';

let scoreGraphics;
let currentRecordingPitches = [];
let scoreY;
let allVoices = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  scoreGraphics = createGraphics(windowWidth, windowHeight);
  scoreGraphics.clear();
  scoreY = height / 2;
  textAlign(CENTER, CENTER);

  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);

  // 接收歷史數據：為每一條線分配隨機顏色
  socket.on("init-score-history", (dataList) => {
    if (dataList) {
      dataList.forEach(d => {
        loadAndAddVoice(d.url);
        // 產生隨機色並繪製
        let randColor = color(random(100, 255), random(100, 255), random(100, 255), 180);
        drawScoreLine(scoreGraphics, d.pitches, randColor);
      });
    }
  });

  // 接收新數據
  socket.on("new-score-line", (data) => {
    loadAndAddVoice(data.url);
    let activeColor = color(random(255), random(150), random(255), 220); // 新線條給比較亮的顏色
    drawScoreLine(scoreGraphics, data.pitches, activeColor);
  });
}

function loadAndAddVoice(url) {
  loadSound(url, (s) => {
    s.setVolume(2.0);
    allVoices.push(s);
  });
}

function draw() {
  background(255);
  drawStaff();

  if (scoreGraphics) image(scoreGraphics, 0, 0);

  drawUI();

  if (state === 2 && pitchModel) {
    analyzeLivePitch();
  }
}

function drawStaff() {
  stroke(240);
  strokeWeight(1);
  for (let i = -2; i <= 2; i++) {
    line(50, scoreY + i * 20, width - 50, scoreY + i * 20);
  }
}

function analyzeLivePitch() {
  pitchModel.getPitch((err, frequency) => {
    if (frequency) {
      let midiNum = 69 + 12 * Math.log2(frequency / 440);
      currentRecordingPitches.push(midiNum);

      let x = map(currentRecordingPitches.length, 0, 400, 50, width - 50);
      let y = map(midiNum, 48, 72, scoreY + 60, scoreY - 60);

      fill(255, 0, 0);
      noStroke();
      ellipse(x, y, 10, 10);
    } else {
      currentRecordingPitches.push(null);
    }
  });
}

// 核心修改：使用 curveVertex 達成圓滑軌跡
function drawScoreLine(pg, pitches, c) {
  if (!pitches || pitches.length < 2) return;

  pg.push();
  pg.stroke(c);
  pg.strokeWeight(2.5);
  pg.noFill();

  pg.beginShape();

  // curveVertex 需要第一個和最後一個點重複作為控制點
  for (let i = 0; i < pitches.length; i++) {
    if (pitches[i]) {
      let x = map(i, 0, pitches.length, 50, width - 50);
      let y = map(pitches[i], 48, 72, scoreY + 60, scoreY - 60);

      // 如果是第一個點或最後一個點，重複繪製一次以符合 curveVertex 的計算邏輯
      if (i === 0 || i === pitches.length - 1) {
        pg.curveVertex(x, y);
      }
      pg.curveVertex(x, y);
    } else {
      pg.endShape();
      pg.beginShape();
    }
  }

  pg.endShape();
  pg.pop();
}

function drawUI() {
  // 播放按鈕
  fill(0, 150, 255, 200);
  rectMode(CENTER);
  rect(width / 2, height - 50, 180, 45, 25);
  fill(255);
  textSize(16);
  text("PLAY ALL", width / 2, height - 50);

  fill(0);
  textSize(14);
  text(statusMsg, width / 2, height - 100);
  text(`Archives: ${allVoices.length}`, width / 2, 40);
}

function touchStarted() {
  userStartAudio();

  if (mouseY > height - 75 && mouseY < height - 25 && mouseX > width / 2 - 90 && mouseX < width / 2 + 90) {
    allVoices.forEach(v => { if (v.isLoaded()) v.play(); });
    return false;
  }

  if (state === 0) {
    statusMsg = 'Loading AI Model...';
    mic.start(() => {
      const modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';
      pitchModel = ml5.pitchDetection(modelUrl, getAudioContext(), mic.stream, () => {
        state = 1;
        statusMsg = 'Ready to Collect Voice';
      });
    });
  } else if (state === 1) {
    soundFile = new p5.SoundFile();
    recorder.record(soundFile);
    currentRecordingPitches = [];
    state = 2;
    statusMsg = 'Capturing Data...';
  } else if (state === 2) {
    recorder.stop();
    state = 3;
    statusMsg = 'Process Complete';
  } else if (state === 3) {
    state = 4;
    statusMsg = 'Sending to Archive...';
    socket.emit('upload-audio', {
      audio: soundFile.getBlob(),
      pitches: currentRecordingPitches
    });
    socket.once('upload-success', () => {
      state = 1;
      statusMsg = 'Data Stored! Tap to Repeat';
    });
  }
  return false;
}
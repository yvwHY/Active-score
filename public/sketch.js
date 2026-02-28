/*eslint no-undef: 0*/
const socket = io();
let mic, recorder, soundFile, pitchModel;
let state = 0; // 0: Start, 1: Ready, 2: Recording, 3: Done, 4: Uploading
let statusMsg = 'Tap to START Mic';

let scoreGraphics;
let currentRecordingPitches = [];
let scoreY;

function setup() {
  createCanvas(windowWidth, windowHeight);
  scoreGraphics = createGraphics(windowWidth, windowHeight);
  scoreGraphics.clear();
  scoreY = height / 2;
  textAlign(CENTER, CENTER);

  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);

  // 接收歷史與即時線條
  socket.on("init-score-history", (dataList) => {
    if (dataList) dataList.forEach(d => drawScoreLine(scoreGraphics, d.pitches, color(200, 150)));
  });

  socket.on("new-score-line", (data) => {
    drawScoreLine(scoreGraphics, data.pitches, color(255, 50, 150));
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
  stroke(230);
  for (let i = -2; i <= 2; i++) {
    line(50, scoreY + i * 20, width - 50, scoreY + i * 20);
  }
}

function analyzeLivePitch() {
  pitchModel.getPitch((err, frequency) => {
    if (frequency) {
      let midiNum = 69 + 12 * Math.log2(frequency / 440);
      currentRecordingPitches.push(midiNum);
      let y = map(midiNum, 48, 72, scoreY + 60, scoreY - 60);
      fill(255, 0, 0);
      noStroke();
      ellipse(width / 2, y, 10, 10);
    } else {
      currentRecordingPitches.push(null);
    }
  });
}

function drawScoreLine(pg, pitches, c) {
  if (!pitches) return;
  pg.stroke(c);
  pg.noFill();
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
  textSize(18);
  text(statusMsg, width / 2, height - 80);
  if (state === 2) {
    fill(255, 0, 0);
    ellipse(width / 2, 40, 10, 10);
  }
}

function touchStarted() {
  userStartAudio();
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
    statusMsg = 'Uploading...';
    socket.emit('upload-audio', {
      audio: soundFile.getBlob(),
      pitches: currentRecordingPitches
    });
    socket.once('upload-success', () => {
      state = 1;
      statusMsg = 'Success! Record again?';
    });
  }
  return false;
}
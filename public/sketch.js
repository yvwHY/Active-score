/*eslint no-undef: 0*/
const socket = io();
let mic, recorder, soundFile, pitchModel;
let state = 0;
let statusMsg = 'Tap to START Mic';

// Visual & Drawing Variables
let scoreGraphics; // Off-screen buffer to persist all users' score lines
let currentRecordingPitches = []; // Array to store real-time pitch data for the current recording
let scoreY; // Center Y-coordinate for the musical staff
let allVoices = []; // Array to store all loaded SoundFile objects for playback

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Initialize off-screen buffer to ensure the background persists
  scoreGraphics = createGraphics(windowWidth, windowHeight);
  scoreGraphics.clear();
  scoreY = height / 2;
  textAlign(CENTER, CENTER);

  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);

  // Sync: Receive historical data and assign random colors to each line
  socket.on("init-score-history", (dataList) => {
    if (dataList) {
      dataList.forEach(d => {
        loadAndAddVoice(d.url);
        // Generate a random color for each historical line
        let randColor = color(random(100, 255), random(100, 255), random(100, 255), 180);
        drawScoreLine(scoreGraphics, d.pitches, randColor);
      });
    }
  });

  // Sync: Receive new data in real-time from other users
  socket.on("new-score-line", (data) => {
    loadAndAddVoice(data.url);
    // Assign a brighter color for new incoming lines
    let activeColor = color(random(255), random(150), random(255), 220);
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

  // Render the persistent graphics buffer (all collected score lines)
  if (scoreGraphics) image(scoreGraphics, 0, 0);

  drawUI();

  // Perform real-time pitch analysis only during the recording state
  if (state === 2 && pitchModel) {
    analyzeLivePitch();
  }
}

// Draw the static musical staff lines
function drawStaff() {
  stroke(240);
  strokeWeight(1);
  for (let i = -2; i <= 2; i++) {
    line(50, scoreY + i * 20, width - 50, scoreY + i * 20);
  }
}

// Extract real-time frequency and map it to the staff
function analyzeLivePitch() {
  pitchModel.getPitch((err, frequency) => {
    if (frequency) {
      let midiNum = 69 + 12 * Math.log2(frequency / 440);
      currentRecordingPitches.push(midiNum);

      // Linear progression: Map array length to X-axis and MIDI number to Y-axis
      let x = map(currentRecordingPitches.length, 0, 400, 50, width - 50);
      let y = map(midiNum, 48, 72, scoreY + 60, scoreY - 60);

      // Visual feedback: Red dot indicating the current pitch position
      fill(255, 0, 0);
      noStroke();
      ellipse(x, y, 10, 10);
    } else {
      currentRecordingPitches.push(null); // Handle silence
    }
  });
}

// Core Visualization: Use curveVertex for smooth, organic trajectories
function drawScoreLine(pg, pitches, c) {
  if (!pitches || pitches.length < 2) return;

  pg.push();
  pg.stroke(c);
  pg.strokeWeight(2.5);
  pg.noFill();

  pg.beginShape();

  // curveVertex requires the first and last points to be doubled as control points
  for (let i = 0; i < pitches.length; i++) {
    if (pitches[i]) {
      let x = map(i, 0, pitches.length, 50, width - 50);
      let y = map(pitches[i], 48, 72, scoreY + 60, scoreY - 60);

      // Double the first and last points to ensure the curve starts/ends correctly
      if (i === 0 || i === pitches.length - 1) {
        pg.curveVertex(x, y);
      }
      pg.curveVertex(x, y);
    } else {
      // Break the shape if silence was recorded (null values)
      pg.endShape();
      pg.beginShape();
    }
  }

  pg.endShape();
  pg.pop();
}

function drawUI() {
  // Playback Button
  fill(0, 150, 255, 200);
  rectMode(CENTER);
  rect(width / 2, height - 50, 180, 45, 25);
  fill(255);
  textSize(16);
  text("PLAY ALL", width / 2, height - 50);

  // Status and Archive Info
  fill(0);
  textSize(14);
  text(statusMsg, width / 2, height - 100);
  text(`Archives: ${allVoices.length}`, width / 2, 40);
}

function touchStarted() {
  userStartAudio(); // Required by browsers to enable audio context

  // Logic for the "PLAY ALL" button
  if (mouseY > height - 75 && mouseY < height - 25 && mouseX > width / 2 - 90 && mouseX < width / 2 + 90) {
    allVoices.forEach(v => { if (v.isLoaded()) v.play(); });
    return false;
  }

  // Recording State Machine
  if (state === 0) {
    statusMsg = 'Loading AI Model...';
    mic.start(() => {
      // Initialize ml5 Pitch Detection (CREPE model)
      const modelUrl = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';
      pitchModel = ml5.pitchDetection(modelUrl, getAudioContext(), mic.stream, () => {
        state = 1;
        statusMsg = 'Ready to Collect Voice';
      });
    });
  } else if (state === 1) {
    // Start Recording
    soundFile = new p5.SoundFile();
    recorder.record(soundFile);
    currentRecordingPitches = [];
    state = 2;
    statusMsg = 'Capturing Data...';
  } else if (state === 2) {
    // Stop Recording
    recorder.stop();
    state = 3;
    statusMsg = 'Process Complete';
  } else if (state === 3) {
    // Upload Data to Server
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
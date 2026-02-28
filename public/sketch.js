/*eslint no-undef: 0*/
const socket = io();
let mic, recorder, soundFile;
let state = 0;
let isChoirStarted = false;
let allVoices = [];
let balls = [];
let statusMsg = 'Tap to START Mic';

// Collaborative prompts to encourage users
let hints = [
  "Record more sounds to enrich the choir!",
  "Invite friends nearby to join the recording.",
  "Each ball represents a unique soul's voice.",
  "Layer different tones to create a collaborative space.",
  "The more voices, the more vibrant the physics world!"
];
let currentHint = "";
let lastHintTime = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  currentHint = random(hints);

  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);
  soundFile = new p5.SoundFile();

  // Sync: Fetch existing history on connection
  socket.on("init-audio-list", (urls) => {
    urls.forEach(url => loadAndAddVoice(url));
  });

  // Sync: Receive new uploads from others in real-time
  socket.on("new-voice", (data) => {
    loadAndAddVoice(data.url);
  });

  socket.on('upload-success', () => {
    state = 0;
    statusMsg = 'Upload Success!\nRecord another?';
  });
}

// Amplification Logic: Boosting volume for mobile hardware limits
function loadAndAddVoice(url) {
  loadSound(url, (s) => {
    // Boosting playback volume to 5.0 to compensate for quiet mobile mics
    s.setVolume(5.0);
    allVoices.push(s);
    // Create a physics ball for the new voice
    balls.push(new Ball(random(width), -50, random(15, 30)));
  });
}

function draw() {
  background(state === 1 ? [255, 0, 0] : 220);

  // Update Hint every 5 seconds
  if (millis() - lastHintTime > 5000) {
    currentHint = random(hints);
    lastHintTime = millis();
  }

  // Update and Display Physics Balls
  for (let b of balls) {
    b.update();
    b.checkEdges();
    b.checkCollision(balls);
    b.display();
  }

  // UI Elements
  fill(0);
  noStroke();

  // Display Prompt
  textSize(16);
  fill(100);
  text(currentHint, width / 2, 25);

  // Stats
  fill(0);
  textSize(20);
  text(`Voices in Choir: ${allVoices.length}`, width / 2, 60);

  textSize(28);
  text(statusMsg, width / 2, height / 2 - 50);

  // Recording Volume Visualizer
  if (state === 1) {
    let level = mic.getLevel();
    let h = map(level, 0, 0.5, 0, height);
    fill(255, 255, 0, 150);
    rect(0, height, 30, -h);
  }

  // Play All Button
  fill(0, 150, 255);
  rectMode(CENTER);
  rect(width / 2, height - 100, 240, 70, 15);
  fill(255);
  text("PLAY CHOIR", width / 2, height - 100);
}

function handleUpload() {
  statusMsg = 'UPLOADING...';
  let soundBlob = soundFile.getBlob();

  // 建立一個安全機制：如果 10 秒內沒收到 upload-success，強制重置狀態
  setTimeout(() => {
    if (state === 2 && statusMsg === 'UPLOADING...') {
      state = 0;
      statusMsg = 'Upload Timeout. Please try again.';
      console.log("Upload timed out.");
    }
  }, 10000);

  socket.emit('upload-audio', { audio: soundBlob });
}

function touchStarted() {
  userStartAudio();

  // 1. Play Button Logic
  if (mouseY > height - 135 && mouseY < height - 65 && mouseX > width / 2 - 120 && mouseX < width / 2 + 120) {
    allVoices.forEach(v => {
      if (v.isLoaded()) {
        v.setVolume(5.0);
        v.play();
      }
    });
    // Visual feedback: Balls jump on play
    for (let b of balls) { b.vel.y -= random(5, 10); }
    return false;
  }

  // 2. Mic Initialization
  if (!isChoirStarted) {
    mic.start(() => {
      isChoirStarted = true;
      mic.amp(1.0); // Maximize input gain
      statusMsg = 'Mic Active!\nTap to RECORD';
    }, () => {
      statusMsg = 'Mic Denied!';
    });
    statusMsg = 'Connecting Mic...';
    return false;
  }

  // 3. Recording State Machine
  if (isChoirStarted) {
    if (state === 0) {
      soundFile = new p5.SoundFile();
      recorder.record(soundFile);
      state = 1;
      statusMsg = 'RECORDING...';
    } else if (state === 1) {
      recorder.stop();
      state = 2;
      statusMsg = 'DONE!\nTap to UPLOAD';
    } else if (state === 2) {
      statusMsg = 'UPLOADING...';
      socket.emit('upload-audio', { audio: soundFile.getBlob() });
    }
  }
  return false;
}

// Nature of Code: Ball Class
class Ball {
  constructor(x, y, r) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-1, 1), random(2, 5));
    this.acc = createVector(0, 0.25); // Gravity
    this.r = r;
    this.color = color(random(255), random(255), random(255), 180);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
  }

  display() {
    fill(this.color);
    ellipse(this.pos.x, this.pos.y, this.r * 2);
  }

  checkEdges() {
    if (this.pos.y > height - this.r) {
      this.pos.y = height - this.r;
      this.vel.y *= -0.6; // Bounciness
    }
    if (this.pos.x > width - this.r || this.pos.x < this.r) {
      this.vel.x *= -0.8;
    }
  }

  checkCollision(others) {
    for (let other of others) {
      if (other === this) continue;
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (d < this.r + other.r) {
        let pushForce = p5.Vector.sub(this.pos, other.pos);
        pushForce.setMag(0.1);
        this.vel.add(pushForce);
      }
    }
  }
}
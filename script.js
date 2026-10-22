const audio = document.getElementById("audio");
const cover = document.getElementById("cover");
const tonearm = document.getElementById("tonearm");
const trackInfo = document.querySelector(".track-info");
const songTitle = document.getElementById("songTitle");
const songArtist = document.getElementById("songArtist");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const seekBar = document.getElementById("seekBar");
const volumeBar = document.getElementById("volumeBar");
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
const fileInput = document.getElementById("fileInput");
const playlistEl = document.getElementById("playlist");
const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");

const PLAY_PATH = "M8 5v14l11-7z";
const PAUSE_PATH = "M6 5h4v14H6zM14 5h4v14h-4z";

let songs = [];
let currentIndex = -1;
let isShuffle = false;
let repeatMode = "off";

let audioCtx;
let analyser;
let dataArray;

function formatTime(sec) {
  if (isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function cleanName(fileName) {
  return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("musicflow-settings"));
    if (saved) {
      audio.volume = saved.volume ?? 0.7;
      isShuffle = saved.shuffle ?? false;
      repeatMode = saved.repeat ?? "off";
    }
  } catch (e) {
    audio.volume = 0.7;
  }
  volumeBar.value = audio.volume;
  shuffleBtn.classList.toggle("active", isShuffle);
  updateRepeatButton();
}

function saveSettings() {
  localStorage.setItem(
    "musicflow-settings",
    JSON.stringify({
      volume: audio.volume,
      shuffle: isShuffle,
      repeat: repeatMode,
    })
  );
}

function updateRepeatButton() {
  repeatBtn.classList.toggle("active", repeatMode !== "off");
  if (repeatMode === "off") repeatBtn.title = "Repeat: off";
  if (repeatMode === "all") repeatBtn.title = "Repeat: all";
  if (repeatMode === "one") repeatBtn.title = "Repeat: one";
}

function setPlayingUI(playing) {
  playIcon.firstElementChild.setAttribute("d", playing ? PAUSE_PATH : PLAY_PATH);
  cover.classList.toggle("playing", playing);
  tonearm.classList.toggle("playing", playing);
}

function renderPlaylist() {
  playlistEl.innerHTML = "";
  songs.forEach((song, i) => {
    const li = document.createElement("li");
    if (i === currentIndex) li.classList.add("active");

    const name = document.createElement("div");
    name.textContent = song.title;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeSong(i);
    });

    li.appendChild(name);
    li.appendChild(removeBtn);
    li.addEventListener("click", () => playSong(i));
    playlistEl.appendChild(li);
  });
}

function loadSong(index) {
  const song = songs[index];
  currentIndex = index;
  trackInfo.classList.add("fade");

  setTimeout(() => {
    songTitle.textContent = song.title;
    songArtist.textContent = song.artist;
    trackInfo.classList.remove("fade");
  }, 250);

  audio.src = song.url;
  seekBar.value = 0;
  currentTimeEl.textContent = "00:00";
  durationEl.textContent = "00:00";
  renderPlaylist();
}

function playSong(index) {
  loadSong(index);
  play();
}

function play() {
  if (currentIndex === -1) {
    if (songs.length === 0) return;
    loadSong(0);
  }
  setupVisualizer();
  if (audioCtx.state === "suspended") audioCtx.resume();
  audio.play();
}

function pause() {
  audio.pause();
}

function togglePlay() {
  if (audio.paused) {
    play();
  } else {
    pause();
  }
}

function getNextIndex() {
  if (isShuffle && songs.length > 1) {
    let r;
    do {
      r = Math.floor(Math.random() * songs.length);
    } while (r === currentIndex);
    return r;
  }
  return (currentIndex + 1) % songs.length;
}

function nextSong() {
  if (songs.length === 0) return;
  playSong(getNextIndex());
}

function prevSong() {
  if (songs.length === 0) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const prev = (currentIndex - 1 + songs.length) % songs.length;
  playSong(prev);
}

function removeSong(index) {
  URL.revokeObjectURL(songs[index].url);
  songs.splice(index, 1);

  if (songs.length === 0) {
    audio.pause();
    audio.removeAttribute("src");
    currentIndex = -1;
    songTitle.textContent = "No Track Loaded";
    songArtist.textContent = "Playlist is empty";
    currentTimeEl.textContent = "00:00";
    durationEl.textContent = "00:00";
    seekBar.value = 0;
    setPlayingUI(false);
  } else if (index === currentIndex) {
    playSong(index % songs.length);
    return;
  } else if (index < currentIndex) {
    currentIndex--;
  }
  renderPlaylist();
}

function setupVisualizer() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  const source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  drawVisualizer();
}

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  analyser.getByteFrequencyData(dataArray);

  const barCount = 24;
  const barWidth = canvas.width / barCount;

  for (let i = 0; i < barCount; i++) {
    const value = dataArray[i];
    const barHeight = (value / 255) * canvas.height;
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(i * barWidth + 1, canvas.height - barHeight, barWidth - 2, barHeight);
  }
}

fileInput.addEventListener("change", () => {
  const wasEmpty = songs.length === 0;

  Array.from(fileInput.files).forEach((file) => {
    songs.push({
      title: cleanName(file.name),
      artist: "Local file",
      url: URL.createObjectURL(file),
    });
  });

  fileInput.value = "";
  renderPlaylist();

  if (wasEmpty && songs.length > 0) {
    loadSong(0);
  }
});

playBtn.addEventListener("click", togglePlay);
nextBtn.addEventListener("click", nextSong);
prevBtn.addEventListener("click", prevSong);

shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active", isShuffle);
  saveSettings();
});

repeatBtn.addEventListener("click", () => {
  if (repeatMode === "off") repeatMode = "all";
  else if (repeatMode === "all") repeatMode = "one";
  else repeatMode = "off";
  updateRepeatButton();
  saveSettings();
});

volumeBar.addEventListener("input", () => {
  audio.volume = volumeBar.value;
  saveSettings();
});

seekBar.addEventListener("input", () => {
  if (audio.duration) {
    audio.currentTime = (seekBar.value / 100) * audio.duration;
  }
});

audio.addEventListener("loadedmetadata", () => {
  durationEl.textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  if (audio.duration) {
    seekBar.value = (audio.currentTime / audio.duration) * 100;
  }
  currentTimeEl.textContent = formatTime(audio.currentTime);
});

audio.addEventListener("play", () => setPlayingUI(true));
audio.addEventListener("pause", () => setPlayingUI(false));

audio.addEventListener("ended", () => {
  if (repeatMode === "one") {
    audio.currentTime = 0;
    audio.play();
    return;
  }
  const isLast = currentIndex === songs.length - 1;
  if (isLast && repeatMode === "off" && !isShuffle) {
    setPlayingUI(false);
    return;
  }
  nextSong();
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === "ArrowRight") nextSong();
  if (e.code === "ArrowLeft") prevSong();
});

loadSettings();
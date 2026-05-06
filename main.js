import "./vendor/xmlplay/xmlplay.css";
import "./style.css";

import abc2svg from "./vendor/abc2svg/abc2svg-bundle.js";
import xmlplay from "./xmlplay.js";
import { ntsSeq } from "./xmlplay_lib.js";

import commonAbc from "./common.abc?raw";

const player = xmlplay(abc2svg);

const VOICE_NAMES = ["Prvi glas", "Drugi glas", "Tretji glas", "Cetrti glas"];

function getBaseBpm() {
  return ntsSeq[0]?.tmp ?? 120;
}

function updateTempoDisplay() {
  const bpm = Math.round(getBaseBpm() * parseFloat(document.getElementById("tempo").value));
  document.getElementById("tempo-value").textContent = bpm + " BPM";
  const tempoBpm = document.getElementById("tempo-bpm");
  if (tempoBpm) tempoBpm.textContent = bpm + " BPM";
}

function initTempoBumps() {
  const tempoInput = document.getElementById("tempo");

  const bump = (delta) => {
    const next = Math.round((parseFloat(tempoInput.value) + delta) * 100) / 100;
    tempoInput.value = Math.min(3, Math.max(0.1, next));
    tempoInput.dispatchEvent(new Event("input"));
  };

  tempoInput.addEventListener("input", updateTempoDisplay);
  document.getElementById("tempo-down").addEventListener("click", () => bump(-0.1));
  document.getElementById("tempo-up").addEventListener("click", () => bump(0.1));
}

function syncVolSlider(i, value) {
  const volInputs = document.querySelectorAll('.vol input[type="range"]');
  if (volInputs[i]) {
    volInputs[i].value = value;
    volInputs[i].dispatchEvent(new Event("change"));
  }
}

function volPct(val) {
  return Math.round(val / 127 * 100) + "%";
}

function addVoiceButtons(voices) {
  const voicesEl = document.getElementById("voices");
  const voiceVolsEl = document.getElementById("voice-vols");
  const savedVols = new Array(voices.length).fill(null);
  const btns = [];

  voiceVolsEl.replaceChildren();

  for (let i = 0; i < voices.length; i++) {
    const btn = document.createElement("div");
    btn.classList.add("voice-button");
    btn.textContent = "♩ " + (i + 1);
    btns.push(btn);

    const ctrl = document.createElement("div");
    ctrl.classList.add("voice-vol-ctrl");

    const label = document.createElement("span");
    label.classList.add("voice-vol-label");
    label.textContent = VOICE_NAMES[i] ?? `♩ ${i + 1}`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.classList.add("voice-vol");
    slider.min = 0;
    slider.max = 127;
    slider.value = voices[i];

    const pct = document.createElement("span");
    pct.classList.add("voice-vol-pct");
    pct.textContent = volPct(voices[i]);

    ctrl.append(label, slider, pct);
    voiceVolsEl.appendChild(ctrl);

    btn.addEventListener("click", () => {
      const isMuted = btn.classList.contains("muted");
      if (isMuted) {
        btn.classList.remove("muted");
        voices[i] = savedVols[i] ?? 100;
        slider.value = voices[i];
        pct.textContent = volPct(voices[i]);
      } else {
        savedVols[i] = voices[i] || 100;
        voices[i] = 0;
        slider.value = 0;
        pct.textContent = "0%";
        btn.classList.add("muted");
      }
      syncVolSlider(i, voices[i]);
    });

    slider.addEventListener("input", () => {
      voices[i] = parseInt(slider.value);
      pct.textContent = volPct(voices[i]);
      btn.classList.toggle("muted", voices[i] === 0);
      syncVolSlider(i, voices[i]);
    });
  }

  voicesEl.replaceChildren(...btns);
  updateTempoDisplay();
}

function initToggleButton() {
  const toggleBtn = document.getElementById("toggle-btn");
  const controls = document.getElementById("controls");
  toggleBtn.addEventListener("click", () => {
    controls.classList.toggle("hidden");
    toggleBtn.classList.toggle("open");
  });
}

function getSongName() {
  const urlParams = new URLSearchParams(window.location.search);
  const songName = urlParams.get("song");
  if (!songName) {
    urlParams.set("song", "fur-elise");
    window.location.search = urlParams.toString();
  }
  return songName;
}

function initErrorToast() {
  const toast = document.getElementById("error-toast");
  document.getElementById("error-close").addEventListener("click", () => {
    toast.classList.add("hidden");
  });
  window.alert = (msg) => {
    document.getElementById("error-msg").textContent = msg;
    toast.classList.remove("hidden");
  };
}

document.addEventListener("DOMContentLoaded", async function () {
  initTempoBumps();
  initToggleButton();
  initErrorToast();

  await player.init({
    "x-songUrl": `abc/${getSongName()}.abc`,
    "x-onSongLoad": addVoiceButtons,
    "x-commonAbc": commonAbc,
    sf2url1: "./js3/",
    sf2url2: "https://wim.vree.org/js3/",
    noErr: true,
  });
});

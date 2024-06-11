import "./style.css";

import abc2svg from "./vendor/abc2svg/abc2svg-1.js";
import xmlplay from "./src/xmlplay/xmlplay.js";

const player = xmlplay(abc2svg.Abc);

function initSpeedRangeElement() {
  const speedRangeValue = document.getElementById("speed-input-value");
  const speedRange = document.getElementById("speed-input");
  speedRange.addEventListener("input", (evt) => {
    speedRangeValue.innerHTML = Math.round(evt.target.value * 100) + "%";
  });
}

function addVoiceButtons(voices) {
  const voicesElement = document.getElementById("voices");
  const children = [];
  for (let i = 0; i < voices.length; i++) {
    const newEl = document.createElement("div");
    newEl.classList.add("voice-button");
    newEl.innerHTML = "♩ " + (i + 1);

    newEl.addEventListener("click", (evt) => {
      if (voices[i] == 0) {
        evt.target.classList.remove("strikethrough");
        voices[i] = 100;
      } else {
        evt.target.classList.add("strikethrough");
        voices[i] = 0;
      }
    });

    children.push(newEl);
  }

  voicesElement.replaceChildren(...children);
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

document.addEventListener("DOMContentLoaded", async function () {
  initSpeedRangeElement();

  await player.init({
    "x-songUrl": `abc/${getSongName()}.abc`,
    "x-onSongLoad": addVoiceButtons,
    sf2url1: "./jssf_files/",
    sf2url2: "https://wim.vree.org/js3/jssf_files/",
    noErr: true,
  });
});


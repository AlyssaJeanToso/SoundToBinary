
"use strict";

const $ = (id) => document.getElementById(id);

const tests = {
  A: { frequency: 440, amplitude: 0.8, samples: 8, bits: 3 },
  B: { frequency: 200, amplitude: 0.5, samples: 6, bits: 4 },
  C: { frequency: 500, amplitude: 0.9, samples: 5, bits: 3 }
};

let currentBinary = "";
let audioContext = null;
let liveUpdateTimer;
let resizeTimer;

function getSettings() {
  return {
    frequency: Number($("frequency").value),
    amplitude: Number($("amplitude").value),
    samples: Number($("samples").value),
    bits: Number($("bits").value)
  };
}

function validate(s) {
  if (!Number.isFinite(s.frequency) ||
      s.frequency < 1 || s.frequency > 20000) {
    return "Frequency must be between 1 and 20,000 Hz.";
  }

  if (!Number.isFinite(s.amplitude) ||
      s.amplitude < 0 || s.amplitude > 1) {
    return "Amplitude must be between 0 and 1.";
  }

  if (!Number.isInteger(s.samples) ||
      s.samples < 2 || s.samples > 64) {
    return "Samples must be a whole number from 2 to 64.";
  }

  if (!Number.isInteger(s.bits) ||
      s.bits < 1 || s.bits > 8) {
    return "Bits per sample must be a whole number from 1 to 8.";
  }

  return "";
}

function setMessage(message, isError = false) {
  $("message").textContent = message;
  $("message").style.color =
    isError ? "#ff6b78" : "#ff9ed5";
}

function calculate(s) {
  const period = 1 / s.frequency;
  const wavelength = 343 / s.frequency;
  const levels = 2 ** s.bits;
  const maxLevel = levels - 1;
  const rows = [];

  for (let i = 0; i < s.samples; i++) {
    const time = i * period / s.samples;

    const height =
      s.amplitude * Math.sin(2 * Math.PI * i / s.samples);

    const level = Math.round(
      ((height + 1) / 2) * maxLevel
    );

    const binary = level.toString(2).padStart(s.bits, "0");

    rows.push({
      sample: i + 1,
      timeMs: time * 1000,
      height,
      level,
      binary
    });
  }

  return {
    period,
    wavelength,
    levels,
    totalBits: s.samples * s.bits,
    rows,
    binary: rows.map(row => row.binary).join(" ")
  };
}

function renderSampleTable(rows) {
  const body = $("sampleBody");
  body.replaceChildren();

  rows.forEach(row => {
    const tr = document.createElement("tr");

    [
      row.sample,
      row.timeMs.toFixed(2),
      row.height.toFixed(2),
      row.level,
      row.binary
    ].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.appendChild(td);
    });

    body.appendChild(tr);
  });
}

function drawSoundWave(rows, bits) {
  const canvas = $("waveCanvas");
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height || !rows.length) return;

  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = rect.width;
  const height = rect.height;

  const left = 38;
  const right = 15;
  const top = 20;
  const bottom = 52;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxLevel = (2 ** bits) - 1;

  // Background
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0c0710";
  ctx.fillRect(0, 0, width, height);

  // Quantization level grid
  ctx.font = "11px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let level = 0; level <= maxLevel; level++) {
    const y = top + plotHeight -
      (level / Math.max(1, maxLevel)) * plotHeight;

    ctx.beginPath();
    ctx.strokeStyle = "#46223b";
    ctx.lineWidth = 1;
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();

    ctx.fillStyle = "#f4d8e9";
    ctx.fillText(String(level), left - 9, y);
  }

  // Sample point positions
  const points = rows.map((row, index) => ({
    x: rows.length === 1
      ? left + plotWidth / 2
      : left + (index / (rows.length - 1)) * plotWidth,

    y: top + plotHeight -
      (row.level / Math.max(1, maxLevel)) * plotHeight,

    row
  }));

  // Neon-pink connecting line
  ctx.beginPath();
  ctx.strokeStyle = "#ff1493";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "#ff1493";
  ctx.shadowBlur = 8;

  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      const previous = points[index - 1];

      const middleX = (previous.x + point.x) / 2;
      const middleY = (previous.y + point.y) / 2;

      ctx.quadraticCurveTo(
        previous.x,
        previous.y,
        middleX,
        middleY
      );

      if (index === points.length - 1) {
        ctx.lineTo(point.x, point.y);
      }
    }
  });

  ctx.stroke();
  ctx.shadowBlur = 0;

  // Pink square markers and sample numbers
  points.forEach((point, index) => {
    ctx.fillStyle = "#ff1493";
    ctx.shadowColor = "#ff1493";
    ctx.shadowBlur = 7;

    ctx.fillRect(
      point.x - 4,
      point.y - 4,
      8,
      8
    );

    ctx.shadowBlur = 0;

    if (points.length <= 24 || index % 2 === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      ctx.fillText(
        String(point.row.sample),
        point.x,
        top + plotHeight + 8
      );
    }
  });

  // Axis label: Sample Number
  ctx.fillStyle = "#ff65c2";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  ctx.fillText(
    "Sample Number",
    left + plotWidth / 2,
    height - 5
  );

  // Update graph data table
  const table = $("waveDataTable");
  const head = table.querySelector("thead tr");
  const body = table.querySelectorAll("tbody tr");

  head.replaceChildren();
  body.forEach(row => row.replaceChildren());

  const heading = document.createElement("th");
  heading.textContent = "Data";
  head.appendChild(heading);

  rows.forEach(row => {
    const th = document.createElement("th");
    th.textContent = String(row.sample);
    head.appendChild(th);
  });

  const values = [
    rows.map(row => row.sample),
    rows.map(row => row.level),
    rows.map(row => row.binary)
  ];

  values.forEach((rowValues, index) => {
    const label = document.createElement("th");

    label.textContent = [
      "Sample",
      "Level",
      "Binary"
    ][index];

    body[index].appendChild(label);

    rowValues.forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value);
      body[index].appendChild(td);
    });
  });
}

function convert(settings = getSettings(),
                 message = "Conversion complete!") {
  const error = validate(settings);

  if (error) {
    setMessage(error, true);
    return null;
  }

  const result = calculate(settings);

  $("periodResult").textContent =
    (result.period * 1000).toFixed(2) + " ms";

  $("wavelengthResult").textContent =
    result.wavelength >= 1
      ? result.wavelength.toFixed(2) + " m"
      : (result.wavelength * 100).toFixed(1) + " cm";

  $("levelsResult").textContent = String(result.levels);
  $("totalBitsResult").textContent = String(result.totalBits);

  renderSampleTable(result.rows);
  drawSoundWave(result.rows, settings.bits);

  $("binaryOutput").textContent = result.binary;
  currentBinary = result.binary;

  setMessage(message);

  return result;
}

function loadSettings(settings) {
  $("frequency").value = settings.frequency;
  $("amplitude").value = settings.amplitude;
  $("samples").value = settings.samples;
  $("bits").value = settings.bits;
}

function renderTestSummary() {
  const body = $("testBody");
  body.replaceChildren();

  Object.entries(tests).forEach(([name, settings]) => {
    const result = calculate(settings);
    const tr = document.createElement("tr");

    [
      "Test " + name,
      settings.frequency + " Hz",
      settings.amplitude,
      settings.samples,
      settings.bits,
      result.totalBits
    ].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.appendChild(td);
    });

    body.appendChild(tr);
  });
}

function runTest(name) {
  const settings = tests[name];
  if (!settings) return;

  loadSettings(settings);

  const result = convert(
    settings,
    `Test ${name} loaded successfully!`
  );

  if (result) {
    $("testBinary").textContent = result.binary;
  }
}

async function playUniqueSound() {
  const settings = getSettings();
  const error = validate(settings);

  if (error) {
    setMessage(error, true);
    return;
  }

  if (settings.amplitude === 0) {
    setMessage("Increase amplitude above 0 to hear sound.", true);
    return;
  }

  const AudioClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioClass) {
    setMessage("Your browser does not support audio.", true);
    return;
  }

  try {
    if (!audioContext) {
      audioContext = new AudioClass();
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const ctx = audioContext;
    const now = ctx.currentTime;
    const volume = settings.amplitude * 0.2;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(
      settings.frequency,
      now
    );

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.03);
    gain.gain.setValueAtTime(volume, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 1.2
    );

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 1.25);

    setMessage("Playing your custom tone!");
  } catch (error) {
    setMessage(
      "Audio could not play. Click Play Tone again.",
      true
    );
  }
}

// Live graph updates
function updateGraphLive() {
  clearTimeout(liveUpdateTimer);

  liveUpdateTimer = setTimeout(() => {
    const settings = getSettings();
    const error = validate(settings);

    if (error) {
      setMessage(error, true);
      return;
    }

    convert(settings, "Graph updated automatically!");
  }, 100);
}

$("convertBtn").addEventListener("click", () => {
  convert();
});

$("playBtn").addEventListener("click", playUniqueSound);

["frequency", "amplitude", "samples", "bits"].forEach(id => {
  $(id).addEventListener("input", updateGraphLive);
  $(id).addEventListener("change", updateGraphLive);
});

// Copy binary
$("copyBtn").addEventListener("click", async () => {
  if (!currentBinary) {
    setMessage("Convert a sound first.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(currentBinary);
    setMessage("Binary code copied successfully!");
  } catch (error) {
    setMessage(
      "Copy unavailable. Select the binary output and copy it manually.",
      true
    );
  }
});

// Test A, B, and C
document.querySelectorAll("[data-test]").forEach(button => {
  button.addEventListener("click", () => {
    runTest(button.dataset.test);
  });
});

// Redraw after resizing
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    convert(getSettings(), "Graph resized.");
  }, 120);
});

// Initial page setup
renderTestSummary();
convert();

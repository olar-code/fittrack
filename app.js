const LS_KEY = "fit_tracker_entries_v1";

const dateEl = document.getElementById("date");
const weightEl = document.getElementById("weight");
const caloriesEl = document.getElementById("calories");
const addBtn = document.getElementById("addBtn");
const clearBtn = document.getElementById("clearBtn");
const listEl = document.getElementById("list");
const msgEl = document.getElementById("msg");
const statsEl = document.getElementById("stats");
const chartEl = document.getElementById("weightChart");
const chartCtx = chartEl.getContext("2d");

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

function showMsg(text, ok = true) {
  msgEl.textContent = text;
  msgEl.style.color = ok ? "#b9ffcf" : "#ffb9b9";
  if (text) setTimeout(() => (msgEl.textContent = ""), 2200);
}

function formatDate(iso) {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function calcStats(entries) {
  if (!entries.length) return null;

  // sort by date asc for weight diff
  const sorted = [...entries].sort((a,b) => a.date.localeCompare(b.date));
  const firstW = sorted[0].weight ?? null;
  const lastW = sorted[sorted.length - 1].weight ?? null;

  const caloriesOnly = entries.map(e => e.calories).filter(n => Number.isFinite(n));
  const avgCal = caloriesOnly.length
    ? Math.round(caloriesOnly.reduce((a,b)=>a+b,0) / caloriesOnly.length)
    : null;

  const weightDiff = (Number.isFinite(firstW) && Number.isFinite(lastW))
    ? +(lastW - firstW).toFixed(1)
    : null;

  return { firstW, lastW, avgCal, weightDiff, count: entries.length };
}

function drawWeightChart(entries) {
  // беремо тільки записи з вагою
  const points = entries
    .filter(e => Number.isFinite(e.weight))
    .sort((a, b) => a.date.localeCompare(b.date));

  const ctx = chartCtx;

  // підлаштування під ширину екрану + ретіна
  const w = chartEl.width = Math.floor(chartEl.clientWidth * devicePixelRatio);
  const h = chartEl.height = Math.floor(170 * devicePixelRatio);

  ctx.clearRect(0, 0, w, h);

  // якщо точок мало
  if (points.length < 2) {
    ctx.globalAlpha = 0.9;
    ctx.font = `${14 * devicePixelRatio}px system-ui`;
    ctx.fillText("Додай мінімум 2 записи з вагою 🙂", 12 * devicePixelRatio, 28 * devicePixelRatio);
    ctx.globalAlpha = 1;
    return;
  }

  const weights = points.map(p => p.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);

  // Відступи: більше місця знизу під дати
  const padX = 18 * devicePixelRatio;
  const padTop = 18 * devicePixelRatio;
  const padBottom = 28 * devicePixelRatio;

  const left = padX;
  const right = w - padX;
  const top = padTop;
  const bottom = h - padBottom;

  // щоб не був плоский графік
  const range = (maxW - minW) || 1;

  const xAt = (i) => left + (i * (right - left)) / (points.length - 1);
  const yAt = (val) => bottom - ((val - minW) * (bottom - top)) / range;

  // ---- Колір по тренду ----
  const first = points[0].weight;
  const last = points[points.length - 1].weight;
  const diff = +(last - first).toFixed(2);

  // зелений якщо вага зменшується, червоний якщо росте, синій якщо майже рівно
  let stroke = "#2d7dff";
  if (diff < -0.05) stroke = "#2ecc71";
  else if (diff > 0.05) stroke = "#ff5c5c";

  // Сітка
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1 * devicePixelRatio;
  for (let k = 0; k <= 2; k++) {
    const y = top + (k * (bottom - top)) / 2;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Анімація лінії ----
  const duration = 450; // мс
  const startT = performance.now();

  function drawFrame(t) {
    const progress = Math.min(1, (t - startT) / duration);

    // очистити область графіка (але лишити фон)
    ctx.clearRect(0, 0, w, h);

    // перемалювати сітку
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1 * devicePixelRatio;
    for (let k = 0; k <= 2; k++) {
      const y = top + (k * (bottom - top)) / 2;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    ctx.restore();

    // лінія
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.6 * devicePixelRatio;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // малюємо лише частину лінії за прогресом
    const lastIndexFloat = progress * (points.length - 1);
    const lastFull = Math.floor(lastIndexFloat);
    const frac = lastIndexFloat - lastFull;

    ctx.beginPath();
    for (let i = 0; i <= lastFull; i++) {
      const x = xAt(i);
      const y = yAt(points[i].weight);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // домалювати “частинку” до наступної точки
    if (lastFull < points.length - 1) {
      const x1 = xAt(lastFull);
      const y1 = yAt(points[lastFull].weight);
      const x2 = xAt(lastFull + 1);
      const y2 = yAt(points[lastFull + 1].weight);
      ctx.lineTo(x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac);
    }

    ctx.stroke();
    ctx.restore();

    // точки (після лінії)
    ctx.save();
    ctx.fillStyle = stroke;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2 * devicePixelRatio;

    points.forEach((p, i) => {
      // показувати точки теж поступово
      if (i > lastIndexFloat) return;
      const x = xAt(i);
      const y = yAt(p.weight);
      ctx.beginPath();
      ctx.arc(x, y, 3.3 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();

    // підписи max/min
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${12 * devicePixelRatio}px system-ui`;
    ctx.fillText(`max: ${maxW.toFixed(1)} кг`, left, top - 6 * devicePixelRatio);
    ctx.fillText(`min: ${minW.toFixed(1)} кг`, left, bottom + 2 * devicePixelRatio);
    ctx.restore();

    // підписи дат знизу
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${10 * devicePixelRatio}px system-ui`;
    ctx.textAlign = "center";

    const step = points.length > 10 ? 2 : 1;
    points.forEach((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return;
      const x = xAt(i);
      const shortDate = formatDate(p.date).slice(0, 5); // 26.02
      ctx.fillText(shortDate, x, bottom + (16 * devicePixelRatio));
    });

    ctx.textAlign = "start";
    ctx.restore();

    if (progress < 1) requestAnimationFrame(drawFrame);
  }

  requestAnimationFrame(drawFrame);
}

function render() {
  const entries = loadEntries();
  // Stats
  const s = calcStats(entries);
  if (!s) {
    statsEl.innerHTML = "";
  } else {
    const diffText = (s.weightDiff === null)
      ? "—"
      : (s.weightDiff > 0 ? `+${s.weightDiff} кг` : `${s.weightDiff} кг`);

    statsEl.innerHTML = `
      <div class="statBox">Записів<b>${s.count}</b></div>
      <div class="statBox">Середні ккал<b>${s.avgCal ?? "—"}</b></div>
      <div class="statBox">Стартова вага<b>${s.firstW ?? "—"} кг</b></div>
      <div class="statBox">Зміна ваги<b>${diffText}</b></div>
    `;
  }

  // List (latest first)
  const sorted = [...entries].sort((a,b) => b.date.localeCompare(a.date));

  if (!sorted.length) {
    listEl.innerHTML = `<div class="item">Поки немає записів. Додай перший 🙂</div>`;
    drawWeightChart(entries);
    return;
  }

  listEl.innerHTML = sorted.map((e) => `
    <div class="item">
      <div class="itemTop">
        <div>
          <div><b>${formatDate(e.date)}</b></div>
          <div class="badge">id: ${e.id}</div>
        </div>
      </div>
      <div class="kpi">
        <div class="pill">Вага: <b>${e.weight ?? "—"}</b> кг</div>
        <div class="pill">Ккал: <b>${e.calories ?? "—"}</b></div>
      </div>
    </div>
  `).join("");
  drawWeightChart(entries);
}

function addEntry() {
  const date = dateEl.value || todayISO();
  const weightRaw = weightEl.value.trim();
  const caloriesRaw = caloriesEl.value.trim();

  const weight = weightRaw ? Number(weightRaw) : null;
  const calories = caloriesRaw ? Number(caloriesRaw) : null;

  if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) {
    showMsg("Вага має бути числом > 0", false);
    return;
  }
  if (calories !== null && (!Number.isFinite(calories) || calories < 0)) {
    showMsg("Калорії мають бути числом ≥ 0", false);
    return;
  }
  if (weight === null && calories === null) {
    showMsg("Введи вагу або калорії 🙂", false);
    return;
  }

  const entries = loadEntries();

  // one entry per date: overwrite (simple & handy)
  const id = Date.now();
  const idx = entries.findIndex(e => e.date === date);
  const entry = { id, date, weight, calories };

  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);

  saveEntries(entries);
  showMsg(idx >= 0 ? "Запис оновлено ✅" : "Запис додано ✅", true);

  weightEl.value = "";
  caloriesEl.value = "";
  dateEl.value = todayISO();

  render();
}

function clearAll() {
  localStorage.removeItem(LS_KEY);
  render();
  showMsg("Все очищено ✅", true);
}

// init
dateEl.value = todayISO();
addBtn.addEventListener("click", addEntry);
clearBtn.addEventListener("click", clearAll);
render();
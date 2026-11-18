import './style.css';
import { paintStageLight } from './stage-light.js';
import { paintIcons, icon } from './icons.js';
import { SeaTrial, fixedStep, clamp, degrees, headingDegrees } from './simulation.js';
import { VesselViewer } from './scene.js';
import { drawTrack, drawHeadingTape } from './plots.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const text = (selector, value) => {
  const el = $(selector);
  if (el.textContent !== value) el.textContent = value;
};
const signed = (value, digits = 0) =>
  (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toFixed(digits);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const trial = new SeaTrial();
trial.startExample();
paintIcons();
paintStageLight($('#stage-light'));
let mode = 'trial',
  running = !reduced,
  viewer = null,
  view = 'follow';
let previousFrame = null,
  accumulator = 0,
  lastHud = -Infinity;
const labels = {
  trial: [
    ['follow', 'orbit', '跟随'],
    ['top', 'top', '俯视'],
    ['stern', 'stern', '艉视'],
    ['horizon', 'horizon', '海天'],
  ],
  inspect: [
    ['whole', 'cube', '全艇'],
    ['mast', 'radio', '桅杆'],
    ['drive', 'stern', '桨舵'],
  ],
};
const controls = { rpm: $('#rpm'), rudder: $('#rudder') };
const headingTape = $('#heading-tape');
const mapCanvas = $('#track-map');
const help = $('#help-dialog');
const rudderScale = $('#rudder-graduations');
for (let angle = -35; angle <= 35; angle += 5) {
  const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  tick.setAttribute('x1', '48');
  tick.setAttribute('x2', '48');
  tick.setAttribute('y1', '9');
  tick.setAttribute('y2', angle === 0 || Math.abs(angle) === 35 ? '17' : '13');
  tick.setAttribute('transform', 'rotate(' + angle * 2 + ' 48 46)');
  rudderScale.append(tick);
}

function syncSliders() {
  const { rpm, rudder } = trial.command;
  controls.rpm.value = rpm;
  controls.rudder.value = rudder;
  $('#rpm-value').innerHTML = rpm + ' <small>rpm</small>';
  $('#rudder-value').innerHTML = signed(rudder) + ' <small>°</small>';
  controls.rpm.setAttribute('aria-valuetext', rpm + ' 转每分');
  controls.rudder.setAttribute(
    'aria-valuetext',
    rudder === 0 ? '正舵' : (rudder > 0 ? '右舵' : '左舵') + Math.abs(rudder) + ' 度'
  );
  controls.rpm.style.setProperty('--fill', rpm / 24 + '%');
  const percent = ((rudder + 35) / 70) * 100;
  controls.rudder.style.setProperty('--start', Math.min(50, percent) + '%');
  controls.rudder.style.setProperty('--fill', Math.max(50, percent) + '%');
  $$('[data-rudder]').forEach((btn) =>
    btn.setAttribute('aria-pressed', Number(btn.dataset.rudder) === rudder)
  );
}
function setCommand(key, value) {
  trial.command[key] =
    key === 'rpm' ? clamp(Math.round(value / 10) * 10, 0, 2400) : clamp(Math.round(value), -35, 35);
  syncSliders();
  updateHud();
}
Object.entries(controls).forEach(([key, input]) =>
  input.addEventListener('input', () => setCommand(key, Number(input.value)))
);
$$('[data-rudder]').forEach((btn) =>
  btn.addEventListener('click', () => setCommand('rudder', Number(btn.dataset.rudder)))
);

function runLabel() {
  const title = running ? '暂停试航' : trial.state.time > 0 ? '继续试航' : '开始试航';
  const button = $('#run');
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = icon(running ? 'pause' : 'play');
  text(
    '#view-state',
    mode === 'inspect' ? '船模检视' : running ? '试航中' : trial.state.time === 0 ? '待试航' : '已暂停'
  );
  $('.view-status').classList.toggle('is-paused', mode === 'trial' && !running);
}
function iconButton(glyph, label) {
  return '<i data-icon="' + glyph + '">' + icon(glyph) + '</i><span>' + label + '</span>';
}
function setView(id, immediate = false) {
  view = id;
  viewer?.setView(view, trial.state, immediate);
  $$('[data-view]').forEach((btn) => btn.setAttribute('aria-pressed', btn.dataset.view === view));
  $$('[data-focus]').forEach((btn) => btn.setAttribute('aria-pressed', btn.dataset.focus === view));
}
function drawViewButtons() {
  const bar = $('#views');
  bar.replaceChildren();
  labels[mode].forEach(([key, glyph, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.view = key;
    b.innerHTML = icon(glyph) + '<span>' + label + '</span>';
    b.setAttribute('aria-pressed', key === view);
    b.addEventListener('click', () => setView(key));
    bar.append(b);
  });
}
function setMode(next) {
  if (next === mode) return;
  mode = next;
  const inspect = mode === 'inspect';
  view = inspect ? 'whole' : 'follow';
  accumulator = 0;
  document.body.classList.toggle('inspection', inspect);
  $$('[data-mode]').forEach((btn) => btn.setAttribute('aria-pressed', btn.dataset.mode === mode));
  $('#run').hidden = inspect;
  $('#horizon-key').hidden = inspect;
  $('#export').hidden = !inspect;
  $('#track-panel').hidden = inspect;
  $('.telemetry').hidden = inspect;
  $('#parts-panel').hidden = !inspect;
  $('#compass').hidden = inspect;
  text('#helm-mode', inspect ? '部件动作预览' : '手动控制');
  $('#model-note').innerHTML = iconButton(
    inspect ? 'cube' : 'activity',
    inspect ? '模型单位 · 米' : '简化三自由度运动模型'
  );
  viewer?.setMode(mode, trial.state);
  drawViewButtons();
  setView(view, true);
  runLabel();
  updateHud();
}
$$('[data-mode]').forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
$$('[data-focus]').forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.focus)));
function toggleRun() {
  if (mode !== 'trial') return;
  running = !running;
  accumulator = 0;
  previousFrame = null;
  runLabel();
  updateHud();
}
$('#run').addEventListener('click', toggleRun);

$('#shortcuts').addEventListener('click', () => help.showModal());
$('#close-help').addEventListener('click', () => help.close());
help.addEventListener('click', (event) => {
  if (event.target === help) help.close();
});
function expanded() {
  return Boolean(document.fullscreenElement) || $('#scene-card').classList.contains('expanded');
}
function syncExpand() {
  const full = expanded(),
    btn = $('#expand');
  btn.setAttribute('aria-label', full ? '退出全屏' : '全屏视窗');
  btn.title = btn.getAttribute('aria-label');
  btn.innerHTML =
    '<i data-icon="' +
    (full ? 'shrink' : 'fullscreen') +
    '">' +
    icon(full ? 'shrink' : 'fullscreen') +
    '</i>';
}
function fallbackExpand(on) {
  $('#scene-card').classList.toggle('expanded', on);
  document.body.classList.toggle('is-expanded', on);
  syncExpand();
}
$('#expand').addEventListener('click', async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  if (expanded()) {
    fallbackExpand(false);
    return;
  }
  try {
    await $('#scene-card').requestFullscreen();
  } catch {
    fallbackExpand(true);
  }
});
document.addEventListener('fullscreenchange', syncExpand);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#scene-card').classList.contains('expanded')) {
    fallbackExpand(false);
    return;
  }
  if (
    help.open ||
    e.altKey ||
    e.metaKey ||
    e.ctrlKey ||
    e.target.matches('input,textarea,select,[contenteditable=true]')
  )
    return;
  if (e.code === 'Space' && e.target.closest('button')) return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (!e.repeat) toggleRun();
      break;
    case 'KeyW':
      setCommand('rpm', trial.command.rpm + 100);
      break;
    case 'KeyS':
      setCommand('rpm', trial.command.rpm - 100);
      break;
    case 'KeyA':
      setCommand('rudder', trial.command.rudder - 2);
      break;
    case 'KeyD':
      setCommand('rudder', trial.command.rudder + 2);
      break;
    case 'KeyC':
      setCommand('rudder', 0);
      break;
    case 'Digit1':
    case 'Digit2':
    case 'Digit3':
      setView(labels[mode][Number(e.code.at(-1)) - 1][0]);
      break;
    case 'Digit4':
      if (mode === 'trial') setView('horizon');
      break;
  }
});
$('#export').addEventListener('click', async () => {
  if (!viewer) return;
  const btn = $('#export');
  btn.disabled = true;
  try {
    const blob = await viewer.exportGlb(),
      url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '水面无人艇.glb';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (error) {
    console.error(error);
    btn.querySelector('span').textContent = '重试导出';
  } finally {
    btn.disabled = false;
  }
});

function updateHud() {
  const s = trial.state,
    secs = Math.floor(s.time);
  const elapsed = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
  text('#clock', 'T+ ' + elapsed);
  const actualRudder = mode === 'trial' ? s.rudder : trial.command.rudder;
  $('#rudder-pointer').setAttribute('transform', 'rotate(' + actualRudder * 2 + ' 48 46)');
  text('#rudder-actual', signed(Math.round(actualRudder)) + '°');
  if (mode !== 'trial') return;
  const bearing = headingDegrees(s.heading);
  const displayedBearing = (Math.round(bearing * 10) % 3600) / 10;
  text('#speed', Math.hypot(s.surge, s.sway).toFixed(2));
  text('#heading', displayedBearing.toFixed(1).padStart(5, '0'));
  text('#yaw-rate', signed(degrees(s.yawRate), 1));
  text('#distance', s.distance.toFixed(1));
  text('#east', s.east.toFixed(1));
  text('#north', s.north.toFixed(1));
  drawTrack(mapCanvas, trial.track, s);
  drawHeadingTape(headingTape, bearing);
}
function animate(now) {
  const dt = previousFrame === null ? 0 : Math.min(0.36, Math.max(0, (now - previousFrame) / 1000));
  previousFrame = now;
  let advanced = 0;
  if (mode === 'trial' && running && !document.hidden) {
    accumulator += dt;
    while (accumulator + 1e-10 >= fixedStep) {
      trial.step();
      accumulator -= fixedStep;
      advanced += fixedStep;
    }
  }
  viewer.render(trial.state, trial.command, dt, advanced);
  if (now - lastHud > 105) {
    updateHud();
    if (mode === 'trial') $('.compass-dial').style.transform = 'rotate(' + viewer.compassAngle() + 'deg)';
    lastHud = now;
  }
  requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange', () => {
  previousFrame = null;
  accumulator = 0;
});
syncSliders();
drawViewButtons();
runLabel();
updateHud();
try {
  viewer = new VesselViewer($('#scene-host'), trial.state, reduced);
  if (new URLSearchParams(location.search).get('view') === 'horizon') setView('horizon', true);
  viewer.render(trial.state, trial.command, 0, 0);
  $('#scene-loading').hidden = true;
  requestAnimationFrame(animate);
} catch (error) {
  console.error(error);
  $('#scene-loading').textContent =
    '三维视窗未能启动。请使用支持 WebGL 2 的浏览器，并启用硬件加速后重新打开。';
  $('#run').disabled = true;
  $('#export').disabled = true;
}

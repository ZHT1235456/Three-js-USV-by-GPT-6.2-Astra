const mono = '10px "IBM Plex Mono", Consolas, monospace';
function surface(canvas) {
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  if (width < 2 || height < 2) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelsW = Math.round(width * dpr),
    pixelsH = Math.round(height * dpr);
  if (canvas.width !== pixelsW || canvas.height !== pixelsH) {
    canvas.width = pixelsW;
    canvas.height = pixelsH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(pixelsW / width, 0, 0, pixelsH / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}
function niceStep(value) {
  const mag = 10 ** Math.floor(Math.log10(value)),
    ratio = value / mag;
  return (ratio < 1.5 ? 1 : ratio < 3.5 ? 2 : ratio < 7.5 ? 5 : 10) * mag;
}

export function drawTrack(canvas, track, s) {
  const view = surface(canvas);
  if (!view) return;
  const { ctx, width: w, height: h } = view;
  let minE = 0,
    maxE = 0,
    minN = 0,
    maxN = 0;
  for (const p of track) {
    minE = Math.min(minE, p.east);
    maxE = Math.max(maxE, p.east);
    minN = Math.min(minN, p.north);
    maxN = Math.max(maxN, p.north);
  }
  const spanE = Math.max(9, maxE - minE),
    spanN = Math.max(9, maxN - minN);
  const scale = Math.max(0.0001, Math.min((w - 83) / spanE, Math.max(20, h - 62) / spanN));
  const centerE = (minE + maxE) / 2,
    centerN = (minN + maxN) / 2;
  const X = (e) => w * 0.5 + (e - centerE) * scale;
  const Y = (n) => h * 0.5 - (n - centerN) * scale;
  const step = niceStep(37 / scale),
    px = step * scale;
  const grid = (spacing, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = ((X(0) % spacing) + spacing) % spacing; x < w; x += spacing) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
    }
    for (let y = ((Y(0) % spacing) + spacing) % spacing; y < h; y += spacing) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
    ctx.stroke();
  };
  grid(px / 4, 'rgba(100,114,90,0.09)');
  grid(px, 'rgba(94,109,86,0.23)');
  const route = () => {
    ctx.beginPath();
    ctx.moveTo(X(track[0].east), Y(track[0].north));
    for (const p of track) ctx.lineTo(X(p.east), Y(p.north));
    ctx.lineTo(X(s.east), Y(s.north));
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  route();
  ctx.strokeStyle = '#f7f3e5';
  ctx.lineWidth = 5.2;
  ctx.stroke();
  route();
  ctx.strokeStyle = '#286f64';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(0), Y(0), 3.4, 0, Math.PI * 2);
  ctx.fillStyle = '#f8f4e7';
  ctx.fill();
  ctx.strokeStyle = '#5d7969';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (Math.hypot(s.east, s.north) * scale > 25) {
    ctx.font = '10px "Microsoft YaHei UI",sans-serif';
    ctx.fillStyle = '#596a59';
    ctx.textAlign = 'left';
    ctx.fillText('起点', X(0) + 7, Y(0) + 3);
  }
  ctx.save();
  ctx.translate(X(s.east), Y(s.north));
  ctx.rotate(s.heading);
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(5.8, 5.8);
  ctx.lineTo(0, 3.8);
  ctx.lineTo(-5.8, 5.8);
  ctx.closePath();
  ctx.strokeStyle = '#f7f2e2';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#25564c';
  ctx.fill();
  ctx.restore();
  // A north arrow and a true distance scale stay in map pixels while the map fits.
  ctx.fillStyle = '#515e50';
  ctx.textAlign = 'center';
  ctx.font = mono;
  ctx.fillText('N', w - 17, 15);
  ctx.beginPath();
  ctx.moveTo(w - 17, 19);
  ctx.lineTo(w - 20.3, 27);
  ctx.lineTo(w - 17, 25);
  ctx.lineTo(w - 13.7, 27);
  ctx.closePath();
  ctx.fill();
  const scaleLength = niceStep(49 / scale);
  ctx.strokeStyle = '#6c745f';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(12, h - 12);
  ctx.lineTo(12, h - 9);
  ctx.lineTo(12 + scaleLength * scale, h - 9);
  ctx.lineTo(12 + scaleLength * scale, h - 12);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#59634f';
  ctx.fillText(scaleLength + ' m', 12, h - 15);
}

const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function drawHeadingTape(canvas, bearing) {
  const area = surface(canvas);
  if (!area) return;
  const { ctx, width, height } = area;
  const middle = width / 2;
  const pxPerDegree = Math.max(1.85, Math.min(3.4, width / 110));
  const halfSpan = middle / pxPerDegree;
  const first = Math.floor((bearing - halfSpan) / 5) * 5;
  ctx.fillStyle = '#8399ba55';
  ctx.fillRect(0, 7, width, 1);
  ctx.font = mono;
  ctx.textAlign = 'center';
  for (let angle = first; angle <= bearing + halfSpan + 5; angle += 5) {
    const x = Math.round(middle + (angle - bearing) * pxPerDegree);
    const degree = ((angle % 360) + 360) % 360;
    const major = degree % 15 === 0;
    ctx.fillStyle = major ? '#b4c7de' : '#738aa9';
    ctx.fillRect(x, 8, 1, major ? 8 : 4);
    if (major) {
      const cardinal = degree % 45 === 0;
      ctx.fillStyle = cardinal ? '#e0eaff' : '#a1b5d1';
      ctx.fillText(cardinal ? compassPoints[degree / 45] : degree, x, height - 2);
    }
  }
  // The lubber line stays fixed while bearings pass underneath it.
  ctx.fillStyle = '#f1d5a3';
  ctx.beginPath();
  ctx.moveTo(middle - 3.8, 0);
  ctx.lineTo(middle + 3.8, 0);
  ctx.lineTo(middle, 6);
  ctx.closePath();
  ctx.fill();
}

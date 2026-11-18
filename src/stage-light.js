// The masthead is a flat lighting composition. Paint once at each layout size
// so the backdrop never competes with the 3D view for animation frames.
export function paintStageLight(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  function paint() {
    const { width: w, height: h } = canvas.getBoundingClientRect();
    if (!w || !h) return;
    const density = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * density);
    canvas.height = Math.round(h * density);
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    const base = ctx.createLinearGradient(0, h, w, 0);
    base.addColorStop(0, '#030819');
    base.addColorStop(0.48, '#091332');
    base.addColorStop(0.78, '#101e51');
    base.addColorStop(1, '#070e2b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';

    function pool(x, y, rx, ry, rgb, strength) {
      ctx.save();
      ctx.translate(w * x, h * y);
      ctx.scale(w * rx, h * ry);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      glow.addColorStop(0, 'rgba(' + rgb + ',' + strength + ')');
      glow.addColorStop(0.48, 'rgba(' + rgb + ',' + strength * 0.37 + ')');
      glow.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    pool(0.79, 0.67, 0.43, 0.92, '20,58,192', 0.65);
    pool(0.55, 1.05, 0.35, 0.36, '40,86,204', 0.52);

    // A soft cone widens and loses intensity as it crosses the studio haze.
    function beam(source, foot, spread, rgb, intensity) {
      for (let y = 0; y < h; y += 2) {
        const t = (y / h + 0.22) / 1.22;
        const center = w * (source + (foot - source) * t);
        const radius = w * (0.012 + spread * t);
        const power = intensity * (1 - 0.64 * t);
        const falloff = ctx.createLinearGradient(center - radius, 0, center + radius, 0);
        for (const [stop, weight] of [
          [0, 0],
          [0.17, 0.07],
          [0.32, 0.47],
          [0.5, 1],
          [0.68, 0.47],
          [0.83, 0.07],
          [1, 0],
        ]) {
          falloff.addColorStop(stop, 'rgba(' + rgb + ',' + power * weight + ')');
        }
        ctx.fillStyle = falloff;
        ctx.fillRect(center - radius, y, radius * 2, 2);
      }
    }
    beam(0.9, 0.52, 0.12, '52,91,234', 0.56);
    beam(1.07, 0.68, 0.085, '121,171,251', 0.43);
    beam(0.64, 0.82, 0.13, '47,70,182', 0.22);

    const sheen = ctx.createLinearGradient(w * 0.25, 0, w * 1.04, 0);
    for (const [stop, colour] of [
      [0, '#1636ba00'],
      [0.24, '#224ad7'],
      [0.56, '#466bed'],
      [0.76, '#a9d2ff'],
      [0.88, '#6299fb'],
      [1, '#213eb15c'],
    ]) {
      sheen.addColorStop(stop, colour);
    }
    function sweep(lift) {
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 1.13);
      ctx.bezierCurveTo(w * 0.4, h * 1.09, w * 0.54, h * (0.77 + lift), w * 0.71, h * (0.64 + lift));
      ctx.bezierCurveTo(
        w * 0.84,
        h * (0.56 + lift * 1.3),
        w * 0.93,
        h * (0.28 + lift),
        w * 1.05,
        h * (0.18 + lift)
      );
    }
    ctx.strokeStyle = sheen;
    ctx.lineCap = 'round';
    // Broad diffusion, then a narrow optical highlight within the same sweep.
    for (const [width, opacity, lift] of [
      [0.23, 0.07, 0.025],
      [0.13, 0.1, 0.014],
      [0.064, 0.16, 0.008],
      [0.026, 0.26, 0.002],
    ]) {
      ctx.lineWidth = h * width;
      ctx.globalAlpha = opacity;
      ctx.filter = 'blur(' + Math.max(1, h * width * 0.37) + 'px)';
      sweep(lift);
      ctx.stroke();
    }
    ctx.filter = 'none';
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = i === 1 ? 0.58 : 0.22 / (1 + i * 0.18);
      ctx.lineWidth = i === 1 ? 1.1 : 0.7;
      sweep((i - 1) * 0.009);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  paint();
  new ResizeObserver(paint).observe(canvas.parentElement);
}

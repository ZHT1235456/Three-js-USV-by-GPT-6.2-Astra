const icons = {
  waves:
    '<path d="M2 8c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 14c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 20c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/>',
  cube: '<path d="m12 3 8.5 4.7v8.6L12 21l-8.5-4.7V7.7L12 3Z"/><path d="m3.7 7.9 8.3 4.7 8.3-4.7M12 21v-8.4"/>',
  keyboard:
    '<rect x="2" y="5.5" width="20" height="13" rx="2"/><path d="M5.5 9h.2m3.1 0H9m3 0h.2m3.1 0h.2m3 0h.2M5.5 12h.2m3.1 0H9m3 0h.2m3.1 0h.2m3 0h.2M8 15h8"/>',
  horizon: '<path d="M2 15h20M4 19h16M7 15a5 5 0 0 1 10 0M12 3v3m7 0-2 2M5 6l2 2"/>',
  play: '<path d="m8 4.8 11.2 7.2L8 19.2z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8.2 5.5v13m7.6-13v13" stroke-width="3.4"/>',
  fullscreen: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  shrink: '<path d="M9 3v6H3m18 0h-6V3m0 18v-6h6M3 15h6v6"/>',
  orbit:
    '<ellipse cx="12" cy="12" rx="10" ry="5.2" transform="rotate(-29 12 12)"/><circle cx="12" cy="12" r="2"/>',
  top: '<path d="M4 4h5m6 0h5M4 4v5m16-5v5M4 15v5h5m6 0h5v-5"/><path d="m12 8 3 7-3-1.2L9 15z"/>',
  stern: '<path d="M3 17h18M6 15l-1.3-5h14.6L18 15M9 10V7h6v3"/>',
  sliders:
    '<path d="M3 6h7m4 0h7M3 12h13m4 0h1M3 18h2m4 0h12"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
  track:
    '<path d="M5 18c0-5 4-5 7-5s7-1 7-7" stroke-dasharray="2.4 3"/><circle cx="5" cy="19" r="2"/><path d="m16 6 3-3 3 3"/>',
  left: '<path d="M18 19v-5a6 6 0 0 0-6-6H5m5-5L5 8l5 5"/>',
  straight: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  right: '<path d="M6 19v-5a6 6 0 0 1 6-6h7m-5-5 5 5-5 5"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  cross: '<path d="m6 6 12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
  locate: '<circle cx="12" cy="12" r="6"/><path d="M12 2v4m10 6h-4M12 22v-4M2 12h4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  sight: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.2"/>',
  radio:
    '<path d="M12 12v8m-2 0h4M7 7a7 7 0 0 0 0 10m10-10a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/><circle cx="12" cy="11" r="1.5"/>',
  activity: '<path d="M2 13h5l3-8 4 14 3-8h5"/>',
};

export function icon(name) {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (icons[name] || '') +
    '</svg>'
  );
}

export function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}

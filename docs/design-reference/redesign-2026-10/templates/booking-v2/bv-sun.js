// Sun times + slot generation for Fgrapher booking. Times in Asia/Ho_Chi_Minh (UTC+7).
(() => {
  const R = Math.PI / 180;
  function sun(y, m, d, lat, lng) {
    const N = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 864e5);
    const g = 2 * Math.PI / 365 * (N - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = Math.acos(Math.cos(90.833 * R) / (Math.cos(lat * R) * Math.cos(dec)) - Math.tan(lat * R) * Math.tan(dec)) / R;
    const rise = 720 - 4 * (lng + ha) - eq + 420, set = 720 - 4 * (lng - ha) - eq + 420;
    return { rise: Math.round(rise), set: Math.round(set) };
  }
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');
  const r5 = m => Math.round(m / 5) * 5;
  function slots(iso, lat, lng, seed) {
    const [y, mo, d] = iso.split('-').map(Number), s = sun(y, mo, d, lat, lng);
    const fixed = [390, 450, 510, 570, 630, 780, 840, 900, 1110, 1170, 1230];
    const golden = [r5(s.rise), r5(s.set - 60)];
    const all = [...new Set([...fixed, ...golden])].filter(m => m >= r5(s.rise) - 1 && m <= 1230).sort((a, b) => a - b);
    const h = (seed || d) * 7;
    return { sun: { rise: s.rise, set: s.set, riseTxt: hm(s.rise), setTxt: hm(s.set) }, list: all.map((m, i) => ({ m, t: hm(m), gold: golden.includes(m) || Math.abs(m - s.rise) <= 40 || (m >= s.set - 90 && m <= s.set - 20), part: m < 720 ? 'sang' : m < s.set - 30 ? 'chieu' : 'toi', booked: (h + i * 3) % 5 === 0 })) };
  }
  window.fgSun = { sun, slots, hm };
})();

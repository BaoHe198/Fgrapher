// Sample data for the Core MVP flow (Home → Browse → Profile → booking request). All numbers are sample data.
(() => {
  if (window.mcData) return;
  const fmt = n => n == null ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '₫';
  const dmy = iso => iso ? iso.split('-').reverse().join('/') : '';
  const dm = iso => dmy(iso).slice(0, 5);
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const wd = iso => WD[new Date(iso + 'T00:00:00').getDay()];
  // Fixed role imagery — commissioned set, never pulled from provider portfolios. Placeholder URLs until the shoot lands.
  const roles = [
    { k: 'photo', label: 'Nhiếp ảnh gia', short: 'Nhiếp ảnh', img: 'https://picsum.photos/seed/fgrole-photo/600/750' },
    { k: 'video', label: 'Quay phim', short: 'Quay phim', img: 'https://picsum.photos/seed/fgrole-video/600/750' },
    { k: 'makeup', label: 'Trang điểm', short: 'Trang điểm', img: 'https://picsum.photos/seed/fgrole-makeup/600/750' },
    { k: 'model', label: 'Người mẫu', short: 'Người mẫu', img: 'https://picsum.photos/seed/fgrole-model/600/750' },
    { k: 'studio', label: 'Studio', short: 'Studio', img: 'https://picsum.photos/seed/fgrole-studio/600/750' },
    { k: 'costume', label: 'Thuê trang phục', short: 'Trang phục', img: 'https://picsum.photos/seed/fgrole-costume/600/750' }
  ];
  const RL = Object.fromEntries(roles.map(r => [r.k, r.label]));
  const styles = ['Cưới', 'Chân dung', 'Kỷ yếu', 'Gia đình', 'Sản phẩm', 'Sự kiện', 'Thời trang', 'Áo dài'];
  const provs = ['Thành phố Hồ Chí Minh', 'Thành phố Hà Nội', 'Thành phố Đà Nẵng'];
  const short = p => p.replace('Thành phố Hồ Chí Minh', 'TP.HCM').replace('Thành phố Hà Nội', 'Hà Nội').replace('Thành phố Đà Nẵng', 'Đà Nẵng');
  const PK = {
    photo: [['Chân dung ngoài trời', '2 giờ', 2500000, '40 ảnh chỉnh màu · 1 địa điểm'], ['Cưới nửa ngày', '4 giờ', 4500000, '120 ảnh · 2 địa điểm · album 20 trang'], ['Cưới trọn ngày', '8 giờ', 8500000, '300 ảnh · lễ và tiệc · album 30 trang']],
    video: [['Phóng sự sự kiện', '4 giờ', 6000000, 'Phim 3–5 phút · bản dọc cho mạng xã hội'], ['Phim cưới', '8 giờ', 12000000, 'Phim 8–10 phút · flycam']],
    makeup: [['Trang điểm chụp ảnh', '1,5 giờ', 1200000, 'Kèm làm tóc'], ['Trang điểm cô dâu', '3 giờ', 2800000, 'Thử trước 1 buổi · dặm lại trong ngày']],
    model: [['Chụp lookbook', '3 giờ', 1500000, 'Tối đa 6 trang phục']],
    studio: [['Thuê studio', '2 giờ', 3500000, 'Phông 3 màu · 2 đèn flash'], ['Studio kèm thợ chụp', '3 giờ', 5200000, '60 ảnh chỉnh màu']],
    costume: [['Thuê áo dài', '1 ngày', 450000, 'Kèm khăn và chỉnh size'], ['Bộ cưới truyền thống', '1 ngày', 1600000, 'Áo dài, khăn đóng cho 2 người']]
  };
  const raw = [
    ['Minh Anh Nhiếp Ảnh', ['photo'], 'Phường Thủ Đức', 0, 4.9, 23, 2, 312, ['Cưới', 'Chân dung'], [], ['2026-10-10']],
    ['Đặng Khôi Nguyên Film & Photography Collective', ['photo', 'video'], 'Phường Bình Thạnh', 0, 5.0, 8, 5, null, ['Cưới', 'Gia đình'], [], ['2026-10-10', '2026-10-11']],
    ['Hoàng Phúc Studio', ['studio', 'photo'], 'Phường Sài Gòn', 0, 4.8, 41, 4, 188, ['Kỷ yếu', 'Sản phẩm'], [], []],
    ['Ngọc Linh Makeup', ['makeup'], 'Phường Tân Định', 0, 5.0, 30, 1, 240, ['Cưới'], [], ['2026-10-04']],
    ['Lê Thảo Vy', ['model'], 'Phường Bến Thành', 0, 4.7, 9, null, null, ['Thời trang'], [], []],
    ['Trần Quốc Bảo', ['video'], 'Phường Bình Thạnh', 0, 4.7, 12, 6, 64, ['Sự kiện', 'Cưới'], [], []],
    ['Võ Thanh Tâm', ['photo'], 'Phường Bình Thạnh', 0, null, 0, null, null, ['Cưới'], [], []],
    ['Áo dài Mộc Lan', ['costume'], 'Phường Sài Gòn', 0, 4.9, 52, 1, null, ['Áo dài'], [], []],
    ['Nguyễn Hoàng Phương Thảo', ['photo'], 'Phường Bến Thành', 0, 4.4, 6, 12, null, ['Gia đình', 'Chân dung'], [], ['2026-10-10']],
    ['Phan Gia Huy', ['photo'], 'Phường Sài Gòn', 0, 4.6, 15, 3, 97, ['Cưới', 'Kỷ yếu'], 'none', []],
    ['Bùi Hải Yến', ['photo'], 'Phường Hoàn Kiếm', 1, 4.7, 19, 2, 120, ['Cưới'], [], []],
    ['Kiều Minh Studio', ['studio'], 'Phường Hải Châu', 2, null, 0, 8, null, ['Sản phẩm'], [], []]
  ];
  const providers = raw.map(([name, rs, ward, pi, rating, reviews, resp, sessions, st, pk, busy], i) => {
    const prov = provs[pi], packages = pk === 'none' ? [] : PK[rs[0]].map(([n, d, p, inc], k) => ({ id: 'k' + k, name: n, dur: d, price: p, priceTxt: fmt(p), inc }));
    const from = packages.length ? Math.min(...packages.map(x => x.price)) : null;
    return {
      id: 'p' + i, name, username: 'nghe-si-' + i, roles: rs, roleTxt: rs.map(r => RL[r]).join(', '), role1: RL[rs[0]],
      ward, prov, place: ward.replace('Phường ', '') + ', ' + short(prov), placeFull: ward + ', ' + prov,
      rating, ratingTxt: rating ? rating.toFixed(1).replace('.', ',') : '', reviews, resp, sessions, styles: st, packages, from, fromTxt: fmt(from), busy,
      cover: `https://picsum.photos/seed/fgmc-c${i}/600/750`, hero: `https://picsum.photos/seed/fgmc-h${i}/1600/1100`,
      portfolio: Array.from({ length: 12 }, (_, k) => { const R = [[3, 2], [2, 3], [4, 5], [1, 1], [3, 2], [16, 9]][(k + i) % 6]; const W = 600, H = Math.round(W * R[1] / R[0]); return { src: `https://picsum.photos/seed/fgmc-pf${i}-${k}/${W}/${H}`, w: W, h: H, num: String(k + 1).padStart(2, '0') + 'A' }; }),
      bio: 'Chụp ảnh cưới và chân dung theo lối phóng sự: ít dàn dựng, ưu tiên ánh sáng tự nhiên và khoảnh khắc thật. Nhận lịch tại TP.HCM và các tỉnh lân cận.'
    };
  });
  // ?stress=1 — long Vietnamese names, long wards, 8–10 digit prices, missing images, no reviews.
  if (new URLSearchParams(location.search).get('stress') === '1') {
    const pk = (list) => list.map(([n, d, p, inc], k) => ({ id: 'k' + k, name: n, dur: d, price: p, priceTxt: fmt(p), inc }));
    const set = (i, o) => { const a = providers[i]; Object.assign(a, o); if (o.packages) { a.from = Math.min(...a.packages.map(x => x.price)); a.fromTxt = fmt(a.from); } if (o.ward) { a.place = o.ward.replace('Phường ', '') + ', ' + short(a.prov); a.placeFull = o.ward + ', ' + a.prov; } };
    set(0, { name: 'Nguyễn Hoàng Phượng Quỳnh — Nhiếp ảnh cưới, phóng sự gia đình & kỷ yếu', ward: 'Phường Tăng Nhơn Phú', packages: pk([['Phóng sự cưới trọn ngày, hai máy, album lụa', '10 giờ', 18500000, '500 ảnh · lễ gia tiên, lễ đường, tiệc · album 40 trang']]) });
    set(1, { cover: null, hero: null, packages: pk([['Phim cưới điện ảnh trọn gói', '2 ngày', 125000000, 'Phim 15 phút · flycam · 3 máy quay']]) });
    set(2, { rating: null, ratingTxt: '', reviews: 0, ward: 'Phường Bình Hưng Hoà', packages: pk([['Thuê trọn studio dài hạn', '12 tháng', 1250000000, 'Toàn bộ mặt bằng 400m² · đèn · phông']]) });
    set(3, { name: 'Đặng Thị Ngọc Huyền — Trang điểm cô dâu Phượng Hoàng', cover: null, hero: null, portfolio: [], rating: null, ratingTxt: '', reviews: 0 });
  }
  const days = Array.from({ length: 14 }, (_, k) => { const d = new Date(2026, 9, 2 + k); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return iso; });
  const times = ['06:00', '08:00', '10:00', '14:00', '16:00', '18:00'];
  const reviews = [
    { by: 'Thu Hà', date: '12/09/2026', stars: 5, text: 'Anh chụp rất nhẹ nhàng, cả nhà không bị gượng. Ảnh giao sớm hơn hẹn hai ngày.' },
    { by: 'Quang Huy', date: '28/08/2026', stars: 5, text: 'Tư vấn địa điểm kỹ, chủ động canh giờ nắng. Sẽ đặt lại cho buổi kỷ niệm.' }
  ];
  const svcs = [['album', 'Album in'], ['film', 'Phim ngắn'], ['flycam', 'Flycam'], ['makeup', 'Kèm trang điểm']];
  const budgets = [['<2', 'Dưới 2 triệu', 0, 2e6], ['2-5', '2–5 triệu', 2e6, 5e6], ['5-10', '5–10 triệu', 5e6, 1e7], ['>10', 'Trên 10 triệu', 1e7, 1e12]];
  const match = (a, f) => {
    if (f.role && !a.roles.includes(f.role)) return false;
    if (f.styles && f.styles.length && !f.styles.some(s => a.styles.includes(s))) return false;
    if (f.prov && a.prov !== f.prov) return false;
    if (f.budget) { const b = budgets.find(x => x[0] === f.budget); if (a.from == null || a.from < b[2] || a.from >= b[3]) return false; }
    if (f.rating && !(a.rating >= +f.rating)) return false;
    if (f.date && a.busy.includes(f.date)) return false;
    return true;
  };
  window.mcData = { fmt, dmy, dm, wd, roles, RL, styles, provs, short, providers, days, times, reviews, svcs, budgets, match };
})();

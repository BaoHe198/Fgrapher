// Sample listings for Chợ F templates. All names, prices and counts are illustrative.
(() => {
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '₫';
  const S = {
    s1: { name: 'Máy Ảnh Sài Gòn', role: 'Cửa hàng máy ảnh', area: 'Phường Bến Thành, Thành phố Hồ Chí Minh', rating: 4.8, reviews: 126, initials: 'MS' },
    s2: { name: 'Minh Anh Nhiếp Ảnh', role: 'Nhiếp ảnh gia', area: 'Phường Thủ Đức, Thành phố Hồ Chí Minh', rating: 4.9, reviews: 23, initials: 'MA' },
    s3: { name: 'Studio Mộc', role: 'Studio', area: 'Phường Bình Thạnh, Thành phố Hồ Chí Minh', rating: 4.7, reviews: 41, initials: 'SM' },
    s4: { name: 'Trần Quốc Bảo', role: 'Quay phim', area: 'Phường Hải Châu, Thành phố Đà Nẵng', rating: null, reviews: 0, initials: 'QB' },
    s5: { name: 'Hà Nội Camera', role: 'Cửa hàng máy ảnh', area: 'Phường Hoàn Kiếm, Thành phố Hà Nội', rating: 4.6, reviews: 88, initials: 'HC' }
  };
  const P = [
    ['p01', 'body', 'Sony', 'Alpha 7 IV (thân máy)', 's1', 'both', 'likenew', 41500000, 650000, 20000000, 2, 12480, ['Pin NP-FZ100 ×2', 'Sạc', 'Dây đeo', 'Hộp gốc'], '6 tháng, do cửa hàng', [['Cảm biến', 'Full-frame 33MP'], ['Ngàm', 'Sony E'], ['Quay phim', '4K 60p 10-bit'], ['Chống rung', 'IBIS 5 trục'], ['Khe thẻ', 'CFexpress A + SD'], ['Trọng lượng', '658 g']]],
    ['p02', 'lens', 'Canon', 'RF 70-200mm f/2.8L IS USM', 's2', 'rent', 'good', null, 450000, 15000000, 1, null, ['Hood', 'Nắp trước/sau', 'Túi mềm'], 'Không bảo hành', [['Ngàm', 'Canon RF'], ['Tiêu cự', '70–200 mm'], ['Khẩu độ', 'f/2.8'], ['Chống rung', 'Có, 5 stop'], ['Filter', '77 mm'], ['Trọng lượng', '1.070 g']]],
    ['p03', 'light', 'Godox', 'AD600 Pro II', 's3', 'both', 'good', 14900000, 300000, 5000000, 3, null, ['Pin', 'Sạc', 'Bowens mount', 'Túi đựng'], '3 tháng, do studio', [['Công suất', '600 Ws'], ['HSS', 'Có'], ['Pin', '360 lần nháy toàn công suất'], ['Ngàm', 'Godox + Bowens'], ['Trọng lượng', '2,6 kg']]],
    ['p04', 'audio', 'Rode', 'Wireless GO II (bộ 2 mic)', 's4', 'sell', 'likenew', 5900000, null, null, 1, null, ['Hộp sạc', 'Lông chống gió ×2', 'Cáp USB-C', 'Cáp TRS'], '1 tháng, do người bán', [['Kênh', '2 phát + 1 thu'], ['Tầm xa', '200 m'], ['Pin', '7 giờ'], ['Ghi trong', 'Có, 40 giờ']]],
    ['p05', 'lens', 'Sigma', '35mm f/1.4 DG DN Art (Sony E)', 's1', 'sell', 'new', 18900000, null, null, 4, null, ['Hood', 'Nắp', 'Túi', 'Hộp gốc'], '12 tháng, chính hãng', [['Ngàm', 'Sony E'], ['Tiêu cự', '35 mm'], ['Khẩu độ', 'f/1.4'], ['Filter', '67 mm'], ['Trọng lượng', '640 g']]],
    ['p06', 'body', 'Fujifilm', 'X-T5 (thân máy, bạc)', 's5', 'both', 'likenew', 36900000, 550000, 18000000, 0, 3120, ['Pin ×2', 'Sạc', 'Dây đeo'], '6 tháng, do cửa hàng', [['Cảm biến', 'APS-C 40MP'], ['Ngàm', 'Fujifilm X'], ['Quay phim', '6.2K 30p'], ['Trọng lượng', '557 g']]],
    ['p07', 'acc', 'DJI', 'RS 3 Pro Combo', 's4', 'rent', 'fair', null, 350000, 8000000, 1, null, ['Tay cầm BG30', 'Tripod mini', 'Cáp điều khiển', 'Vali'], 'Không bảo hành', [['Tải trọng', '4,5 kg'], ['Pin', '12 giờ'], ['Kết nối', 'Bluetooth, USB-C']]],
    ['p08', 'light', 'Aputure', 'LS 300d II', 's3', 'rent', 'good', null, 400000, 7000000, 2, null, ['Reflector', 'Chân đèn', 'Túi'], 'Không bảo hành', [['Công suất', '350 W'], ['Nhiệt màu', '5.600 K'], ['Ngàm', 'Bowens'], ['Điều khiển', 'Sidus Link']]],
    ['p09', 'audio', 'Zoom', 'H6 Handy Recorder', 's5', 'sell', 'avg', 3200000, null, null, 1, null, ['Capsule XY', 'Capsule MS'], 'Không bảo hành', [['Kênh', '6 track'], ['Định dạng', 'WAV 24-bit/96kHz'], ['Pin', '4 × AA']]],
    ['p10', 'acc', 'Manfrotto', 'Chân máy 190XPRO + đầu bi', 's2', 'both', 'good', 4200000, 120000, 1500000, 1, null, ['Đầu bi', 'Túi'], 'Không bảo hành', [['Chiều cao tối đa', '160 cm'], ['Tải trọng', '7 kg'], ['Trọng lượng', '2,1 kg']]],
    ['p11', 'body', 'Nikon', 'Z6 II (thân máy)', 's5', 'sell', 'good', 29500000, null, null, 1, 48210, ['Pin', 'Sạc'], '3 tháng, do cửa hàng', [['Cảm biến', 'Full-frame 24,5MP'], ['Ngàm', 'Nikon Z'], ['Quay phim', '4K 60p'], ['Trọng lượng', '705 g']]],
    ['p12', 'light', 'Profoto', 'B10 Plus', 's1', 'rent', 'likenew', null, 500000, 25000000, 1, null, ['Pin', 'Sạc', 'Túi'], '3 tháng, do cửa hàng', [['Công suất', '500 Ws'], ['Đèn LED', '5.600 K'], ['Trọng lượng', '1,7 kg']]]
  ];
  const cond = {
    new: ['Mới', 'Nguyên hộp, chưa kích hoạt hoặc chưa qua sử dụng.'],
    likenew: ['Như mới', 'Dùng ít, không vết trầy nhìn thấy được, đủ phụ kiện gốc.'],
    good: ['Tốt', 'Có vài vết dùng nhỏ trên thân, không ảnh hưởng quang học hay chức năng.'],
    fair: ['Khá', 'Trầy rõ trên thân hoặc mòn cao su; quang học và chức năng vẫn tốt.'],
    avg: ['Trung bình', 'Mòn nhiều, có thể thiếu phụ kiện; đã kiểm tra hoạt động, nên xem kỹ ảnh.']
  };
  const items = P.map(([id, cat, brand, model, seller, mode, c, price, rent, deposit, stock, shutter, acc, warranty, spec]) => ({
    id, cat, brand, model, name: `${brand} ${model}`, seller: { id: seller, ...S[seller], ratingTxt: S[seller].rating ? String(S[seller].rating).replace('.', ',') : '' },
    mode, cond: c, condLabel: cond[c][0], price, rent, deposit, stock, shutter, acc, warranty, spec,
    priceTxt: price ? fmt(price) : '', rentTxt: rent ? fmt(rent) : '', depositTxt: deposit ? fmt(deposit) : '',
    modeLabel: mode === 'both' ? 'BÁN · THUÊ' : mode === 'rent' ? 'CHO THUÊ' : 'BÁN', prov: S[seller].area.split(', ')[1],
    code: 'KD-2026-00' + (400 + +id.slice(1)), declaredAt: '28/09/2026', noPhoto: id === 'p09'
  }));
  window.fgShop = { items, cond, condOrder: ['new', 'likenew', 'good', 'fair', 'avg'], fmt, cats: [['body', 'Thân máy'], ['lens', 'Ống kính'], ['light', 'Ánh sáng'], ['audio', 'Âm thanh'], ['acc', 'Phụ kiện']] };
})();

# Ảnh minh họa cố định (showcase)

Ảnh trong thư mục này dùng cho các ô "Bạn cần ai?", "Duyệt theo phong cách" ở
trang chủ, bảng ảnh ở trang Giới thiệu, và (từ 16/11/2026) khung ảnh cạnh form ở
các trang đăng nhập/đăng ký (`roles/*-2.jpg` của nhiếp ảnh, quay phim, trang điểm,
studio, xem `src/app/(auth)/layout.tsx`). Đây là ảnh minh họa cố định, không
lấy từ portfolio người dùng, nên luôn đẹp và đúng chủ đề kể cả khi chưa có
nhà cung cấp nào.

Danh sách file nằm trong `src/lib/constants/showcase-images.ts`. Muốn thay ảnh,
ghi đè đúng tên file (JPG ngang hoặc dọc, rộng khoảng 1.200 px, dưới 500 KB)
rồi cập nhật kích thước trong file đó.

## Nguồn và giấy phép

Tất cả ảnh lấy từ [Unsplash](https://unsplash.com) theo
[Giấy phép Unsplash](https://unsplash.com/license): được dùng miễn phí, kể cả
cho mục đích thương mại, không bắt buộc ghi công. Chỉ chọn ảnh miễn phí, không
dùng ảnh Unsplash+. Tải về ngày 08/10/2026; 10 ảnh (hai ảnh người mẫu, trang điểm,
cho thuê trang phục, cưới, chân dung và `yearbook-2`) thay ngày 18/11/2026 cho hiện
đại và nghệ thuật hơn, một số được cắt lại quanh chủ thể. Ghi công dưới đây để tiện tra cứu:

| File                        | Tác giả                                                   | Ảnh gốc                                 |
| --------------------------- | --------------------------------------------------------- | --------------------------------------- |
| `roles/photographer.jpg`    | [Jakob Owens](https://unsplash.com/@jakobowens1)          | https://unsplash.com/photos/DQPP9rVLYGQ |
| `roles/videographer.jpg`    | [Kyle Loftus](https://unsplash.com/@kyleloftusstudios)    | https://unsplash.com/photos/tn9tmUmQA4A |
| `roles/makeup-artist.jpg`   | [Jabari Timothy](https://unsplash.com/@jabarib)           | https://unsplash.com/photos/2rEFgXcAZLA |
| `roles/model.jpg`           | [Saeed Isavy](https://unsplash.com/@saeedisavy1)          | https://unsplash.com/photos/i-WLGGm6f0o |
| `roles/studio.jpg`          | [Lana Mattice](https://unsplash.com/@lanamattice)         | https://unsplash.com/photos/Qy-LgJuED0o |
| `roles/costume-shop.jpg`    | [Elist Nguyen](https://unsplash.com/@hieuanhcauam)        | https://unsplash.com/photos/zU2hfp56wEg |
| `roles/camera-shop.jpg`     | [Damir Babacic](https://unsplash.com/@onemorephoto)       | https://unsplash.com/photos/UCfTPw4nyr0 |
| `roles/photographer-2.jpg`  | [Noémi Macavei-Katócz](https://unsplash.com/@noemimk)     | https://unsplash.com/photos/zrk7WirlxgM |
| `roles/videographer-2.jpg`  | [Avel Chuklanov](https://unsplash.com/@chuklanov)         | https://unsplash.com/photos/Hn3S90f6aak |
| `roles/makeup-artist-2.jpg` | [Alena Plotnikova](https://unsplash.com/@alena_horoshaya) | https://unsplash.com/photos/H3bUio5s0g0 |
| `roles/model-2.jpg`         | [Larm Rmah](https://unsplash.com/@larm)                   | https://unsplash.com/photos/G-SCNTzpDEE |
| `roles/studio-2.jpg`        | [KOBU Agency](https://unsplash.com/@kobuagency)           | https://unsplash.com/photos/uekNxBHpUU8 |
| `roles/costume-shop-2.jpg`  | [Marcus Loke](https://unsplash.com/@marcusloke)           | https://unsplash.com/photos/xXJ6utyoSw0 |
| `styles/wedding-1.jpg`      | [Hisu lee](https://unsplash.com/@lee_hisu)                | https://unsplash.com/photos/FTW8ADj5igs |
| `styles/wedding-2.jpg`      | [Bin Thieu](https://unsplash.com/@binthieu)               | https://unsplash.com/photos/5PHiAPTtM5k |
| `styles/wedding-3.jpg`      | [Khoa Nguyen](https://unsplash.com/@khoa)                 | https://unsplash.com/photos/7733bbNYUas |
| `styles/portrait-1.jpg`     | [Cris Trung](https://unsplash.com/@cris_trung)            | https://unsplash.com/photos/3wK7RLRAAkA |
| `styles/portrait-2.jpg`     | [Maria Ivanova](https://unsplash.com/@marishphoto)        | https://unsplash.com/photos/F9GZcx1_mW4 |
| `styles/portrait-3.jpg`     | [Nerf Portraits](https://unsplash.com/@nerfee03)          | https://unsplash.com/photos/q4DJVtxES0w |
| `styles/yearbook-1.jpg`     | [Pang Yuhao](https://unsplash.com/@yuhao)                 | https://unsplash.com/photos/_kd5cxwZOK4 |
| `styles/yearbook-2.jpg`     | [Elist Nguyen](https://unsplash.com/@hieuanhcauam)        | https://unsplash.com/photos/GUmICv-AfyI |
| `styles/yearbook-3.jpg`     | [Poodar CHU](https://unsplash.com/@poodar)                | https://unsplash.com/photos/TTYFzgLidGM |
| `styles/event-1.jpg`        | [Tyler Witkin](https://unsplash.com/@zyloh)               | https://unsplash.com/photos/ojiceL6CWRQ |
| `styles/event-2.jpg`        | [Evangeline Shaw](https://unsplash.com/@evangelineshaw)   | https://unsplash.com/photos/CiO3eBBxqJA |
| `styles/event-3.jpg`        | [Craig Whitehead](https://unsplash.com/@sixstreetunder)   | https://unsplash.com/photos/-GHRKkCygfQ |
| `styles/fashion-1.jpg`      | [Đặng Duyên](https://unsplash.com/@lm_____turtle02)       | https://unsplash.com/photos/QHJHFmIg9QA |
| `styles/fashion-2.jpg`      | [Quang Pham Duy](https://unsplash.com/@nicstudio)         | https://unsplash.com/photos/O2oLQ7UKmbc |
| `styles/fashion-3.jpg`      | [Angga Pratama](https://unsplash.com/@negative1)          | https://unsplash.com/photos/nPz9DOKYDD4 |
| `styles/product-1.jpg`      | [George Dagerotip](https://unsplash.com/@dagerotip)       | https://unsplash.com/photos/hdDtGEm293A |
| `styles/product-2.jpg`      | [Mehmet Ali Turan](https://unsplash.com/@mehmetalituran)  | https://unsplash.com/photos/qJTqZFjL95c |
| `styles/product-3.jpg`      | [Alex Duong](https://unsplash.com/@alexd_228)             | https://unsplash.com/photos/9XRpBxUoAm4 |

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

Toàn bộ ảnh là ảnh chụp tại Việt Nam hoặc của nhiếp ảnh gia Việt Nam (chủ dự án
yêu cầu ngày 18/11/2026, thay bộ ảnh nước ngoài tải về ngày 08/10/2026), lấy từ
hai nguồn, đều được dùng miễn phí kể cả cho mục đích thương mại, không bắt buộc
ghi công:

- [Unsplash](https://unsplash.com), theo [Giấy phép Unsplash](https://unsplash.com/license).
  Chỉ chọn ảnh miễn phí, không dùng ảnh Unsplash+ (đã kiểm tra trên trang từng ảnh).
- [Pexels](https://www.pexels.com), theo [Giấy phép Pexels](https://www.pexels.com/license/).

Một số ảnh được cắt lại quanh chủ thể để khung ảnh vuông trên trang chủ không
cắt mất người. Giấy phép của cả hai nguồn không kèm giấy đồng ý của người trong
ảnh, nên chỉ dùng làm ảnh minh họa, không dùng như thể đó là nhà cung cấp hay
khách hàng thật của Fgrapher. Ghi công dưới đây để tiện tra cứu:

| File                        | Tác giả                                             | Ảnh gốc                                 |
| --------------------------- | --------------------------------------------------- | --------------------------------------- |
| `roles/photographer.jpg`    | Theodore Nguyen (Pexels)                            | https://www.pexels.com/photo/27660640/  |
| `roles/videographer.jpg`    | Huynh Van (Pexels)                                  | https://www.pexels.com/photo/8582699/   |
| `roles/makeup-artist.jpg`   | Trần Long (Pexels)                                  | https://www.pexels.com/photo/14581474/  |
| `roles/model.jpg`           | [Hong Nguyen](https://unsplash.com/@goh)            | https://unsplash.com/photos/J4TEzb9mb3A |
| `roles/studio.jpg`          | [Fujiphilm](https://unsplash.com/@fujiphilm)        | https://unsplash.com/photos/oujKSaZlMFY |
| `roles/costume-shop.jpg`    | [Elist Nguyen](https://unsplash.com/@hieuanhcauam)  | https://unsplash.com/photos/zU2hfp56wEg |
| `roles/camera-shop.jpg`     | [DM David](https://unsplash.com/@dm_david)          | https://unsplash.com/photos/N2jz1hNC_nQ |
| `roles/photographer-2.jpg`  | [Đào Việt Hoàng](https://unsplash.com/@dvhoang2106) | https://unsplash.com/photos/ZI733w46T04 |
| `roles/videographer-2.jpg`  | Huynh Van (Pexels)                                  | https://www.pexels.com/photo/8582698/   |
| `roles/makeup-artist-2.jpg` | Trần Long (Pexels)                                  | https://www.pexels.com/photo/6213338/   |
| `roles/model-2.jpg`         | [Larm Rmah](https://unsplash.com/@larm)             | https://unsplash.com/photos/G-SCNTzpDEE |
| `roles/studio-2.jpg`        | Dang Hong (Pexels)                                  | https://www.pexels.com/photo/30170292/  |
| `roles/costume-shop-2.jpg`  | Tuấn Kiệt Jr. (Pexels)                              | https://www.pexels.com/photo/18757488/  |
| `styles/wedding-1.jpg`      | [Hisu lee](https://unsplash.com/@lee_hisu)          | https://unsplash.com/photos/FTW8ADj5igs |
| `styles/wedding-2.jpg`      | [Bin Thieu](https://unsplash.com/@binthieu)         | https://unsplash.com/photos/5PHiAPTtM5k |
| `styles/wedding-3.jpg`      | [Khoa Nguyen](https://unsplash.com/@khoa)           | https://unsplash.com/photos/7733bbNYUas |
| `styles/portrait-1.jpg`     | [Cris Trung](https://unsplash.com/@cris_trung)      | https://unsplash.com/photos/3wK7RLRAAkA |
| `styles/portrait-2.jpg`     | [Tron Le](https://unsplash.com/@tronle_sg)          | https://unsplash.com/photos/aSI_hzGBSY0 |
| `styles/portrait-3.jpg`     | [Peter Nguyen](https://unsplash.com/@peterng237)    | https://unsplash.com/photos/jVDbmshAl4o |
| `styles/yearbook-1.jpg`     | Luyên TC (Pexels)                                   | https://www.pexels.com/photo/37324146/  |
| `styles/yearbook-2.jpg`     | [Elist Nguyen](https://unsplash.com/@hieuanhcauam)  | https://unsplash.com/photos/GUmICv-AfyI |
| `styles/yearbook-3.jpg`     | Boser Đàm (Pexels)                                  | https://www.pexels.com/photo/33927716/  |
| `styles/event-1.jpg`        | [Vivu Vietnam](https://unsplash.com/@bttsg)         | https://unsplash.com/photos/NVpEcIdclUI |
| `styles/event-2.jpg`        | [Michael Lock](https://unsplash.com/@milo_photo)    | https://unsplash.com/photos/oi1GQVgO5oQ |
| `styles/event-3.jpg`        | [Tony Pham](https://unsplash.com/@tonyphamvn)       | https://unsplash.com/photos/WVPI710bifM |
| `styles/fashion-1.jpg`      | Thien Le Duy (Pexels)                               | https://www.pexels.com/photo/31211049/  |
| `styles/fashion-2.jpg`      | [Jerry Kavan](https://unsplash.com/@jerrykavan)     | https://unsplash.com/photos/5cRXngkJUJY |
| `styles/fashion-3.jpg`      | That Saigon Guy (Pexels)                            | https://www.pexels.com/photo/7241893/   |
| `styles/product-1.jpg`      | [Huan Minh](https://unsplash.com/@huanhenry)        | https://unsplash.com/photos/QtxUERL1bMY |
| `styles/product-2.jpg`      | [Aiph Doan](https://unsplash.com/@aiphdoan)         | https://unsplash.com/photos/ODan-a-K3ME |
| `styles/product-3.jpg`      | Sứ Bát Tràng (Pexels)                               | https://www.pexels.com/photo/18273370/  |

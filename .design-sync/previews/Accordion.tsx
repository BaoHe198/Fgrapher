import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "fgrapher";

export const BookingFaq = () => (
  <div className="max-w-[560px]">
    <Accordion defaultValue={["deposit"]}>
      <AccordionItem value="deposit">
        <AccordionTrigger>Tôi có cần đặt cọc trước khi chụp không?</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">
            Tùy từng nhiếp ảnh gia. Phần lớn yêu cầu đặt cọc 30% (ví dụ
            600.000₫ cho gói 2.000.000₫) sau khi xác nhận lịch. Bạn trao đổi
            mức cọc trực tiếp trong phần tin nhắn.
          </p>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="reschedule">
        <AccordionTrigger>Tôi có thể đổi ngày chụp không?</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">
            Bạn có thể gửi yêu cầu đổi lịch trước ngày chụp ít nhất 48 giờ.
          </p>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="delivery">
        <AccordionTrigger>Bao lâu thì tôi nhận được ảnh?</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">Thường từ 7 đến 14 ngày sau buổi chụp.</p>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  </div>
);

export const AllCollapsed = () => (
  <div className="max-w-[560px]">
    <Accordion>
      <AccordionItem value="verify">
        <AccordionTrigger>Vì sao hồ sơ của tôi chưa được công khai?</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">Hồ sơ cần hoàn tất xác minh danh tính.</p>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="moderation">
        <AccordionTrigger>Ảnh portfolio được duyệt trong bao lâu?</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">Thường trong vòng 24 giờ làm việc.</p>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="plan">
        <AccordionTrigger>Gói thành viên có tự động gia hạn không?</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">Không. Bạn gia hạn thủ công mỗi tháng.</p>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  </div>
);

export const MultipleOpen = () => (
  <div className="max-w-[560px]">
    <Accordion multiple defaultValue={["studio", "costume"]}>
      <AccordionItem value="studio">
        <AccordionTrigger>Tiện nghi studio</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">
            Phòng thay đồ riêng, 3 phông nền, đèn Godox 600W, điều hòa, chỗ
            đỗ xe máy miễn phí.
          </p>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="costume">
        <AccordionTrigger>Thuê kèm trang phục</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">
            Áo dài truyền thống từ 150.000₫/ngày, đặt cọc 500.000₫, trả
            trước 20:00 ngày hôm sau.
          </p>
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem value="policy">
        <AccordionTrigger>Chính sách hủy lịch</AccordionTrigger>
        <AccordionPanel>
          <p className="pb-4">Hủy trước 72 giờ được hoàn toàn bộ tiền cọc.</p>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  </div>
);

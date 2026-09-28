import { ConversationList } from "fgrapher";

// Relative to "now" so the list shows "5m", "2h", "Hôm qua" wherever it
// renders, rather than a fixed date that ages into dd/MM.
const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const avatar = (from: string, to: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='120' height='120' fill='url(#g)'/><circle cx='60' cy='48' r='22' fill='rgba(255,255,255,0.55)'/><ellipse cx='60' cy='112' rx='40' ry='30' fill='rgba(255,255,255,0.55)'/></svg>`,
  )}`;

const ME = "me";

const conversations = [
  {
    id: "cv1",
    otherUser: {
      id: "u1",
      name: "Lê Minh Anh",
      firstName: "Minh Anh",
      avatar: avatar("#0f3d33", "#c9a24d"),
      username: "minhanh",
      profiles: [{ displayName: "Minh Anh Nhiếp Ảnh" }],
    },
    lastMessage: {
      content: "Dạ gói chụp cưới ngoại cảnh bên em là 8.500.000₫, gồm 2 máy và 300 ảnh chỉnh màu ạ.",
      type: "text",
      senderId: "u1",
      createdAt: ago(5),
    },
    lastMessageAt: ago(5),
    unreadCount: 2,
  },
  {
    id: "cv2",
    otherUser: {
      id: "u2",
      name: "Trần Ngọc Linh",
      firstName: "Ngọc Linh",
      avatar: avatar("#3b2a1a", "#e8d3a8"),
      username: "ngoclinh",
      profiles: [{ displayName: "Ngọc Linh Makeup" }],
    },
    lastMessage: {
      content: "",
      type: "booking_link",
      senderId: ME,
      createdAt: ago(130),
    },
    lastMessageAt: ago(130),
    unreadCount: 0,
  },
  {
    id: "cv3",
    otherUser: {
      id: "u3",
      name: "Studio Nắng",
      firstName: null,
      avatar: null,
      username: "studionang",
      profiles: [{ displayName: "Studio Nắng Sài Gòn" }],
    },
    lastMessage: {
      content: "",
      type: "image",
      senderId: "u3",
      createdAt: ago(60 * 26),
    },
    lastMessageAt: ago(60 * 26),
    unreadCount: 1,
  },
  {
    id: "cv4",
    otherUser: {
      id: "u4",
      name: "Phạm Quốc Bảo",
      firstName: "Quốc Bảo",
      avatar: null,
      username: "quocbao",
      profiles: null,
    },
    lastMessage: {
      content: "Cảm ơn anh, hẹn gặp lại ở buổi chụp kỷ yếu ngày 12/10/2026 nhé!",
      type: "text",
      senderId: ME,
      createdAt: ago(60 * 24 * 3),
    },
    lastMessageAt: ago(60 * 24 * 3),
    unreadCount: 0,
  },
  {
    id: "cv5",
    otherUser: {
      id: "u5",
      name: "Hằng Áo Dài",
      firstName: null,
      avatar: avatar("#4a2c2a", "#e7b8a4"),
      username: "hangaodai",
      profiles: [{ displayName: "Tiệm Áo Dài Cô Hằng" }],
    },
    lastMessage: {
      content: "Chào shop, mình muốn thuê bộ áo dài lụa đỏ size M từ 20/10 đến 22/10.",
      type: "text",
      senderId: ME,
      createdAt: ago(60 * 24 * 12),
    },
    lastMessageAt: ago(60 * 24 * 12),
    unreadCount: 0,
  },
];

const noop = () => {};

export const Inbox = () => (
  <div className="grid min-h-[480px] w-full max-w-[360px] bg-bg-surface">
    <ConversationList
      conversations={conversations}
      selectedId="cv2"
      currentUserId={ME}
      onSelect={noop}
    />
  </div>
);

export const InPopupNoHeading = () => (
  <div className="grid min-h-[420px] w-[340px] bg-bg-surface">
    <ConversationList
      conversations={conversations.slice(0, 3)}
      selectedId={null}
      currentUserId={ME}
      onSelect={noop}
      showHeading={false}
    />
  </div>
);

export const Empty = () => (
  <div className="grid min-h-[420px] w-full max-w-[360px] bg-bg-surface">
    <ConversationList
      conversations={[]}
      selectedId={null}
      currentUserId={ME}
      onSelect={noop}
    />
  </div>
);

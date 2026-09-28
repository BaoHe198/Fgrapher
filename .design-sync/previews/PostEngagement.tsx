import { PostEngagement } from "fgrapher";

const comments = [
  {
    id: "cm1",
    content: "Ánh sáng buổi chiều ở Đà Lạt đẹp quá anh ơi! Bộ này chụp máy gì vậy ạ?",
    createdAt: "2026-09-26T09:12:00.000Z",
    user: { id: "u2", name: "Nguyễn Thu Trang", firstName: "Thu Trang" },
  },
  {
    id: "cm2",
    content: "Sony A7 IV với ống 85mm f/1.4 nha em, chụp lúc 16h30.",
    createdAt: "2026-09-26T10:03:00.000Z",
    user: { id: "u1", name: "Lê Minh Anh", firstName: "Minh Anh" },
  },
  {
    id: "cm3",
    content: "Cho mình xin báo giá gói chụp cưới ngoại cảnh tháng 12/2026 nhé.",
    createdAt: "2026-09-27T14:40:00.000Z",
    user: { id: "u3", name: "Phạm Quốc Bảo", firstName: "Quốc Bảo" },
  },
];

const Post = ({ children }: { children: React.ReactNode }) => (
  <div className="flex max-w-xl flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-4">
    <div className="flex flex-col">
      <span className="text-body-md font-semibold text-text-primary">
        Minh Anh Nhiếp Ảnh
      </span>
      <span className="text-body-sm text-text-tertiary">26/09/2026</span>
    </div>
    <p className="text-body-md text-text-secondary">
      Bộ ảnh cưới ngoại cảnh ở đồi chè Cầu Đất, Đà Lạt. Cảm ơn hai bạn đã tin
      tưởng giao khoảnh khắc quan trọng này cho mình.
    </p>
    {children}
  </div>
);

export const SignedOut = () => (
  <Post>
    <PostEngagement
      postId="post1"
      viewerId={null}
      initialLiked={false}
      initialLikeCount={128}
      initialCommentCount={14}
    />
  </Post>
);

export const Liked = () => (
  <Post>
    <PostEngagement
      postId="post1"
      viewerId="u2"
      initialLiked
      initialLikeCount={129}
      initialCommentCount={14}
    />
  </Post>
);

export const CommentsOpenAsOwner = () => (
  <Post>
    <PostEngagement
      postId="post1"
      viewerId="u1"
      postOwnerId="u1"
      initialLiked={false}
      initialLikeCount={128}
      initialCommentCount={3}
      initialComments={comments}
    />
  </Post>
);

export const NoCommentsYet = () => (
  <Post>
    <PostEngagement
      postId="post2"
      viewerId="u2"
      initialLiked={false}
      initialLikeCount={0}
      initialCommentCount={0}
      initialComments={[]}
    />
  </Post>
);

export const SignedOutWithComments = () => (
  <Post>
    <PostEngagement
      postId="post1"
      viewerId={null}
      initialLiked={false}
      initialLikeCount={128}
      initialCommentCount={2}
      initialComments={comments.slice(0, 2)}
    />
  </Post>
);

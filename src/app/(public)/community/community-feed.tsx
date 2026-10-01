"use client";

import type {
  PostKind,
  ProfileCategory,
  RequestOfferStatus,
  Role,
  ServiceRequestStatus,
} from "@prisma/client";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  Flag,
  ImageIcon,
  Loader2,
  MessageSquareText,
  PenSquare,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import {
  ProductImageUploader,
  type ProductImage,
} from "@/components/forms/product-image-uploader";
import { MediaLightbox } from "@/components/modals/media-lightbox";
import { ReportModal } from "@/components/modals/report-modal";
import { PostEngagement } from "@/components/social/post-engagement";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUserRoles } from "@/hooks/use-user-roles";
import { buildMediaVariants } from "@/lib/media/variants";
import { formatDate } from "@/lib/format";
import {
  cn,
  formatBudgetRange,
  formatCurrency,
  formatRelativeTime,
} from "@/lib/utils";

type FeedFilter = "all" | "posts" | "portfolio" | "bookings";

interface FeedOffer {
  id: string;
  requestId: string;
  providerId: string;
  message: string | null;
  proposedPrice: number;
  currency: string;
  proposedDate: string | null;
  status: RequestOfferStatus;
  createdAt: string;
  provider: {
    id: string;
    name: string | null;
    firstName: string | null;
    username: string | null;
    avatar: string | null;
    profiles: { displayName: string | null; role: Role }[];
  };
}

interface FeedRequest {
  id: string;
  code: string;
  title: string;
  description: string | null;
  role: Role;
  categories: ProfileCategory[];
  shootDate: string | null;
  isDateFlexible: boolean;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  status: ServiceRequestStatus;
  expiresAt: string;
  province: { name: string };
  ward: { name: string } | null;
  offerCount: number;
  offers: FeedOffer[];
  canOffer: boolean;
}

interface FeedPost {
  id: string;
  kind: PostKind;
  caption: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByViewer: boolean;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    username: string | null;
    avatar: string | null;
  };
  media: {
    id: string;
    url: string;
    type: string;
    width?: number | null;
    height?: number | null;
  }[];
  album: {
    id: string;
    title: string;
    description: string | null;
    category: ProfileCategory | null;
  } | null;
  serviceRequest: FeedRequest | null;
}

function authorName(user: FeedPost["user"]) {
  return user.firstName ?? user.name ?? "Fgrapher";
}

const FILTERS: { value: FeedFilter; icon: typeof Sparkles }[] = [
  { value: "all", icon: Sparkles },
  { value: "posts", icon: MessageSquareText },
  { value: "portfolio", icon: ImageIcon },
  { value: "bookings", icon: CalendarDays },
];

async function fetchFeed(
  tab: "discover" | "following",
  filter: FeedFilter,
  cursor?: string | null,
) {
  const query = new URLSearchParams({ tab, filter });
  if (cursor) query.set("cursor", cursor);
  const res = await fetch(`/api/posts?${query.toString()}`);
  if (!res.ok) throw new Error("Feed request failed");
  return (await res.json()) as {
    data?: FeedPost[];
    nextCursor?: string | null;
    pendingCount?: number;
  };
}

export function CommunityFeed({
  viewerId,
  rail,
}: {
  viewerId: string | null;
  /** Server-rendered blocks for the right column (featured albums…). */
  rail?: React.ReactNode;
}) {
  const t = useTranslations("publicPages.community");
  const { canReceiveBookings } = useUserRoles();
  const [tab, setTab] = useState<"discover" | "following">("discover");
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = async (nextCursor?: string | null) => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const body = await fetchFeed(tab, filter, nextCursor);
      startTransition(() => {
        setPosts((current) =>
          nextCursor ? [...current, ...(body.data ?? [])] : (body.data ?? []),
        );
        setCursor(body.nextCursor ?? null);
        setPendingCount(body.pendingCount ?? 0);
      });
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void fetchFeed(tab, filter)
      .then((body) => {
        if (cancelled) return;
        startTransition(() => {
          setPosts(body.data ?? []);
          setCursor(body.nextCursor ?? null);
          setPendingCount(body.pendingCount ?? 0);
          setLoadError(false);
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, filter]);

  const selectFilter = (value: FeedFilter) => {
    setIsLoading(true);
    setLoadError(false);
    setFilter(value);
  };

  const selectTab = (value: "discover" | "following") => {
    setIsLoading(true);
    setLoadError(false);
    setTab(value);
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,680px)] xl:grid-cols-[220px_minmax(0,680px)_280px] xl:justify-between">
      <aside className="sticky top-[96px] hidden flex-col gap-3 lg:flex">
        <Card className="flex flex-col gap-1 p-2">
          {FILTERS.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectFilter(value)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[var(--fg-radius-md)] px-3 py-2.5 text-left text-body-sm font-semibold! transition-colors",
                filter === value
                  ? "bg-brand-primary text-text-on-brand"
                  : "text-text-secondary hover:bg-bg-sunken hover:text-text-primary",
              )}
            >
              <Icon className="size-4" />
              {t(`filter.${value}`)}
            </button>
          ))}
        </Card>
        <Card className="flex flex-col gap-2 text-body-sm text-text-secondary">
          <span className="font-semibold! text-text-primary">
            {t("communityNoteTitle")}
          </span>
          <span>{t("communityNoteBody")}</span>
        </Card>
      </aside>

      {/* A section, not a second <main>: the public layout already owns
          the page's main landmark, and two of them leaves a screen reader
          with no single skip-to-content target. */}
      <section className="min-w-0">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
          {FILTERS.map(({ value, icon: Icon }) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "accent" : "secondary"}
              className="shrink-0"
              onClick={() => selectFilter(value)}
            >
              <Icon className="size-4" />
              {t(`filter.${value}`)}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {pendingCount > 0 ? (
            <Card className="border-brand-primary text-body-sm text-text-secondary">
              {t("pendingBanner", { count: pendingCount })}
            </Card>
          ) : null}

          {viewerId ? (
            <PostComposer
              onPublished={(post) => {
                if (post) setPosts((current) => [post, ...current]);
                else setPendingCount((count) => count + 1);
              }}
            />
          ) : (
            <Card className="text-body-md text-text-secondary">
              <Link href="/login" className="font-semibold! text-brand-primary">
                {t("loginToPost")}
              </Link>
            </Card>
          )}

          <div className="flex items-center justify-between gap-3">
            <Tabs
              value={tab}
              onValueChange={(value) =>
                selectTab(value as "discover" | "following")
              }
            >
              <TabsList>
                <TabsTab value="discover">{t("tabDiscover")}</TabsTab>
                <TabsTab value="following">{t("tabFollowing")}</TabsTab>
              </TabsList>
            </Tabs>
            {/* A grey "Tất cả" used to sit here, repeating whichever filter
                was picked in the left column. It read as a third control
                for the same feed and did nothing when pressed. */}
          </div>

          {loadError && posts.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-body-md font-semibold! text-text-primary">
                {t("loadFailed")}
              </p>
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                {t("retry")}
              </Button>
            </Card>
          ) : isLoading && posts.length === 0 ? (
            <ListSkeleton />
          ) : posts.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-14 text-center">
              <Users className="size-10 text-text-tertiary" />
              <p className="text-body-md font-semibold! text-text-primary">
                {tab === "following" ? t("emptyFollowing") : t("empty")}
              </p>
            </Card>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                viewerId={viewerId}
                onDeleted={(id) =>
                  setPosts((current) =>
                    current.filter((item) => item.id !== id),
                  )
                }
                onRequestChanged={(request) =>
                  setPosts((current) =>
                    current.map((item) =>
                      item.id === post.id
                        ? { ...item, serviceRequest: request }
                        : item,
                    ),
                  )
                }
              />
            ))
          )}

          {cursor ? (
            <div className="flex justify-center py-2">
              <Button
                variant="secondary"
                disabled={isLoading}
                onClick={() => void load(cursor)}
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="sticky top-[96px] hidden flex-col gap-6 xl:flex">
        {rail}
        {/* "Create F Booking" was offered twice on one screen — a gold
            button alone in a "quick actions" card, and again in the
            composer — while the card explaining what an F Booking is had
            only a list link. The action now lives with its explanation;
            quick actions keep what is unique to providers. */}
        {canReceiveBookings ? (
          <Card className="flex flex-col gap-3">
            <span className="text-heading-sm text-text-primary">
              {t("quickActions")}
            </span>
            <Button
              variant="secondary"
              className="w-full justify-start"
              nativeButton={false}
              render={<Link href="/dashboard/portfolio" />}
            >
              <Camera className="size-4" />
              {t("uploadPortfolio")}
            </Button>
          </Card>
        ) : null}
        <Card className="flex flex-col gap-2">
          <span className="text-heading-sm text-text-primary">
            {t("bookingHelpTitle")}
          </span>
          <p className="text-body-sm text-text-secondary">
            {t("bookingHelpBody")}
          </p>
          <Button
            variant="accent"
            className="mt-1 w-full justify-start"
            nativeButton={false}
            render={<Link href="/requests/new" />}
          >
            <CalendarDays className="size-4" />
            {t("createBooking")}
          </Button>
          <Link href="/requests" className="text-body-sm text-brand-primary">
            {t("viewBookings")}
          </Link>
        </Card>
      </aside>
    </div>
  );
}

function PostComposer({
  onPublished,
}: {
  onPublished: (post: FeedPost | null) => void;
}) {
  const t = useTranslations("publicPages.community");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);
  const [showImages, setShowImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: caption.trim() || undefined,
        media: images.map((image) => ({
          url: image.url,
          publicId: image.publicId ?? null,
          type: "IMAGE",
        })),
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.message ?? t("publishFailed"));
      return;
    }
    const heldForReview = images.length > 0;
    setCaption("");
    setImages([]);
    setShowImages(false);
    setNotice(heldForReview ? t("submittedForReview") : null);
    onPublished(
      heldForReview
        ? null
        : {
            ...body.data,
            kind: "STANDARD",
            likeCount: 0,
            commentCount: 0,
            likedByViewer: false,
            media: [],
            album: null,
            serviceRequest: null,
          },
    );
  };

  return (
    <Card className="flex flex-col gap-3 border-border-default shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <PenSquare className="size-5 text-brand-primary" />
        <span className="text-body-md font-semibold! text-text-primary">
          {t("createPost")}
        </span>
      </div>
      <Textarea
        aria-label={t("composerPlaceholder")}
        placeholder={t("composerPlaceholder")}
        rows={3}
        value={caption}
        maxLength={2000}
        onChange={(event) => setCaption(event.target.value)}
        className="border-0 bg-bg-sunken"
      />
      {showImages ? (
        <ProductImageUploader images={images} onChange={setImages} />
      ) : null}
      {notice ? <p className="text-body-sm text-info">{notice}</p> : null}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowImages((shown) => !shown)}
          >
            <ImageIcon className="size-4" />
            {t("addPhoto")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href="/requests/new" />}
          >
            <CalendarDays className="size-4" />
            {t("createBooking")}
          </Button>
        </div>
        <Button
          variant="accent"
          size="sm"
          disabled={busy || (!caption.trim() && images.length === 0)}
          onClick={submit}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {busy ? t("publishing") : t("publish")}
        </Button>
      </div>
    </Card>
  );
}

function PostCard({
  post,
  viewerId,
  onDeleted,
  onRequestChanged,
}: {
  post: FeedPost;
  viewerId: string | null;
  onDeleted: (postId: string) => void;
  onRequestChanged: (request: FeedRequest) => void;
}) {
  const t = useTranslations("publicPages.community");
  const [reportOpen, setReportOpen] = useState(false);
  const isOwnPost = viewerId === post.user.id;

  const remove = async () => {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(post.id);
  };

  return (
    <Card className="flex flex-col gap-4 border-border-default shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <Avatar className="size-11">
          {post.user.avatar ? (
            <AvatarImage src={post.user.avatar} alt="" />
          ) : null}
          <AvatarFallback>
            {authorName(post.user)[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          {post.user.username ? (
            <Link
              href={`/profile/${post.user.username}`}
              className="truncate text-body-md font-semibold! text-text-primary hover:underline"
            >
              {authorName(post.user)}
            </Link>
          ) : (
            <span className="truncate text-body-md font-semibold! text-text-primary">
              {authorName(post.user)}
            </span>
          )}
          <span className="flex items-center gap-2 text-body-sm text-text-tertiary">
            {/* The time links to the post's own page — the one address a
                post has for sharing; the feed card had no way to reach it. */}
            <Link
              href={`/community/${post.id}`}
              className="hover:text-text-secondary hover:underline"
            >
              {formatRelativeTime(new Date(post.createdAt))}
            </Link>
            <span>·</span>
            {t(`postKind.${post.kind}`)}
          </span>
        </div>
        {isOwnPost && post.kind === "STANDARD" ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("delete")}
            onClick={remove}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : viewerId && !isOwnPost ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("report")}
            onClick={() => setReportOpen(true)}
          >
            <Flag className="size-4" />
          </Button>
        ) : null}
      </div>

      {post.kind === "PORTFOLIO_ALBUM" && post.album ? null : post.caption ? (
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-body-md text-text-primary">
          {post.caption}
        </p>
      ) : null}

      {post.serviceRequest ? (
        <RequestPostPanel
          request={post.serviceRequest}
          viewerId={viewerId}
          ownerId={post.user.id}
          onChanged={onRequestChanged}
        />
      ) : null}

      {post.kind === "PORTFOLIO_ALBUM" &&
      post.album &&
      post.media.length > 0 ? (
        <AlbumPostMedia post={post} />
      ) : post.media.length > 0 ? (
        <PostMedia media={post.media} />
      ) : null}

      <PostEngagement
        postId={post.id}
        viewerId={viewerId}
        initialLiked={post.likedByViewer}
        initialLikeCount={post.likeCount}
        initialCommentCount={post.commentCount}
        postOwnerId={post.user.id}
      />

      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="post"
        targetId={post.id}
      />
    </Card>
  );
}

// An album post (wave 2): the first photo large at its own ratio, then a
// strip of the next four frames with "+N" for the rest, and a mono line
// naming who, what and how many frames. Pressing the photo opens the
// album's own page; the strip opens the lightbox at that frame.
function AlbumPostMedia({ post }: { post: FeedPost }) {
  const t = useTranslations("publicPages.community");
  const categoryT = useTranslations("profileCategory");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const album = post.album!;
  const [first, ...rest] = post.media;
  const strip = rest.slice(0, 4);
  const hidden = post.media.length - 1 - strip.length;
  const albumHref = post.user.username
    ? `/profile/${post.user.username}/albums/${album.id}`
    : null;
  const cover = (
    <Image
      src={buildMediaVariants(first.url).large}
      alt={album.title}
      width={first.width ?? 1200}
      height={first.height ?? 900}
      unoptimized
      sizes="(min-width: 768px) 680px, 100vw"
      className="block h-auto max-h-[78vh] w-full object-contain"
    />
  );
  return (
    <div className="flex flex-col gap-2">
      {albumHref ? (
        <Link href={albumHref} className="focus-ring block bg-dr-bg">
          {cover}
        </Link>
      ) : (
        <div className="bg-dr-bg">{cover}</div>
      )}
      {strip.length > 0 ? (
        <ol className="grid grid-cols-4 gap-1.5">
          {strip.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpenIndex(index + 1)}
                aria-label={t("openPhoto", {
                  index: index + 2,
                  total: post.media.length,
                })}
                className="focus-ring relative block aspect-square w-full cursor-zoom-in bg-dr-bg"
              >
                <Image
                  src={buildMediaVariants(item.url).thumbnail}
                  alt=""
                  fill
                  unoptimized
                  sizes="160px"
                  className="object-contain p-0.5"
                />
                {index === strip.length - 1 && hidden > 0 ? (
                  <span className="absolute inset-0 grid place-items-center bg-[var(--dr-scrim)] font-mono text-heading-sm text-dr-text">
                    +{hidden}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
        {[
          authorName(post.user),
          album.title,
          album.category ? categoryT(album.category) : null,
          t("frames", { count: post.media.length }),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {album.description ? (
        <p className="text-body-md whitespace-pre-wrap text-text-primary [overflow-wrap:anywhere]">
          {album.description}
        </p>
      ) : null}
      {openIndex !== null ? (
        <MediaLightbox
          items={post.media.map((item) => ({
            url: item.url,
            type: "IMAGE" as const,
          }))}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
          title={album.title}
          categoryLabel={album.category ? categoryT(album.category) : undefined}
        />
      ) : null}
    </div>
  );
}

function PostMedia({ media }: { media: FeedPost["media"] }) {
  const t = useTranslations("publicPages.community");
  // Every photo opens the full set; the "+N" tile opens at that photo, so
  // the hidden rest is one swipe away instead of unreachable.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const visible = media.slice(0, 4);
  return (
    <>
      <div
        className={cn(
          "grid gap-1.5 overflow-hidden rounded-xl",
          visible.length === 1 ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        {visible.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={t("openPhoto", {
              index: index + 1,
              total: media.length,
            })}
            className={cn(
              "relative cursor-zoom-in overflow-hidden bg-bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
              visible.length === 1 ? "aspect-[4/3]" : "aspect-square",
            )}
          >
            <Image
              src={item.url}
              alt=""
              fill
              sizes="(min-width: 768px) 620px, 95vw"
              className="object-cover transition-transform duration-300 hover:scale-[1.02]"
            />
            {index === 3 && media.length > 4 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-heading-lg text-white">
                +{media.length - 4}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {openIndex !== null ? (
        <MediaLightbox
          items={media.map((item) => ({ url: item.url }))}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
        />
      ) : null}
    </>
  );
}

function providerName(offer: FeedOffer) {
  return (
    offer.provider.profiles[0]?.displayName ??
    offer.provider.firstName ??
    offer.provider.name ??
    "Provider"
  );
}

function RequestPostPanel({
  request,
  viewerId,
  ownerId,
  onChanged,
}: {
  request: FeedRequest;
  viewerId: string | null;
  ownerId: string;
  onChanged: (request: FeedRequest) => void;
}) {
  const t = useTranslations("publicPages.community");
  const roleT = useTranslations("role");
  const categoryT = useTranslations("profileCategory");
  const isOwner = viewerId === ownerId;
  const open = request.status === "OPEN" || request.status === "HAS_OFFERS";
  const myOffer = request.offers.find((offer) => offer.providerId === viewerId);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [price, setPrice] = useState(myOffer?.proposedPrice.toString() ?? "");
  const [message, setMessage] = useState(myOffer?.message ?? "");
  const [proposedDate, setProposedDate] = useState(
    myOffer?.proposedDate?.slice(0, 10) ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<FeedOffer | null>(null);
  const [acceptDate, setAcceptDate] = useState(
    request.shootDate?.slice(0, 10) ?? "",
  );
  const [acceptTime, setAcceptTime] = useState("");
  const [locationType, setLocationType] = useState("OUTDOOR");

  const submitOffer = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      role: request.role,
      proposedPrice: Number(price),
      message: message || undefined,
      proposedDate: request.isDateFlexible
        ? proposedDate || undefined
        : undefined,
    };
    const res =
      myOffer?.status === "PENDING"
        ? await fetch(`/api/offers/${myOffer.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/opportunities/${request.id}/offers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.message ?? t("offer.genericError"));
      return;
    }
    const nextOffer: FeedOffer = {
      ...body.data,
      requestId: request.id,
      providerId: viewerId!,
      currency: request.currency,
      provider: myOffer?.provider ?? {
        id: viewerId!,
        name: null,
        firstName: null,
        username: null,
        avatar: null,
        profiles: [],
      },
    };
    onChanged({
      ...request,
      status: "HAS_OFFERS",
      offerCount: myOffer ? request.offerCount : request.offerCount + 1,
      offers: myOffer
        ? request.offers.map((offer) =>
            offer.id === myOffer.id ? nextOffer : offer,
          )
        : [...request.offers, nextOffer],
    });
    setShowOfferForm(false);
  };

  const decline = async (offer: FeedOffer) => {
    setBusy(true);
    const res = await fetch(`/api/offers/${offer.id}/decline`, {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) {
      onChanged({
        ...request,
        offers: request.offers.map((item) =>
          item.id === offer.id ? { ...item, status: "DECLINED" } : item,
        ),
      });
    }
  };

  const accept = async () => {
    if (!accepting) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/offers/${accepting.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: acceptDate,
        startTime: acceptTime,
        locationType,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.message ?? t("offer.genericError"));
      return;
    }
    onChanged({
      ...request,
      status: "FULFILLED",
      canOffer: false,
      offers: request.offers.map((offer) => ({
        ...offer,
        status: offer.id === accepting.id ? "ACCEPTED" : "DECLINED",
      })),
    });
    setAccepting(null);
  };

  const openAccept = (offer: FeedOffer) => {
    setAccepting(offer);
    setAcceptDate(
      offer.proposedDate?.slice(0, 10) ?? request.shootDate?.slice(0, 10) ?? "",
    );
    setError(null);
  };

  return (
    // An ivory call sheet on the darkroom feed (wave 2): a Paper island,
    // stamped with the days it stays open - red once it has closed.
    <div
      data-surface="paper"
      className="flex flex-col gap-4 rounded-[var(--fg-radius-md)] border border-border-default bg-gold-50 pb-4 text-text-primary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-default px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
            {t("sheet.heading")}
          </span>
          <strong className="font-mono text-body-lg tracking-[0.04em] whitespace-nowrap">
            {request.code}
          </strong>
        </div>
        <span
          className={cn(
            "shrink-0 -rotate-3 rounded-[var(--fg-radius-sm)] border-2 px-2 py-1 font-mono text-meta font-semibold tracking-[0.12em] uppercase",
            open
              ? "border-gold-600 text-gold-700"
              : "border-danger text-danger",
          )}
        >
          {open
            ? t("sheet.daysLeft", { days: daysLeft(request.expiresAt) })
            : t(`requestStatus.${request.status}`)}
        </span>
      </div>

      <dl className="flex flex-col px-5 text-body-sm">
        <SheetRow label={t("sheet.wanted")}>
          <span className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border-strong px-2.5 py-0.5">
              {roleT(request.role)}
            </span>
            {request.categories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-border-default px-2.5 py-0.5 text-text-secondary"
              >
                {categoryT(category)}
              </span>
            ))}
          </span>
        </SheetRow>
        <SheetRow label={t("whenLabel")}>
          {request.isDateFlexible
            ? request.dateRangeStart && request.dateRangeEnd
              ? t("flexibleDate", {
                  start: formatDate(request.dateRangeStart),
                  end: formatDate(request.dateRangeEnd),
                })
              : t("flexibleNoRange")
            : request.shootDate
              ? formatDate(request.shootDate)
              : t("notSet")}
        </SheetRow>
        <SheetRow label={t("whereLabel")}>
          {request.ward ? `${request.ward.name}, ` : ""}
          {request.province.name}
        </SheetRow>
        <SheetRow label={t("budgetLabel")}>
          <span className="font-semibold">
            {formatBudgetRange(request.budgetMin, request.budgetMax) ??
              t("notSet")}
          </span>
        </SheetRow>
        <SheetRow label={t("sheet.note")}>
          <span className="flex flex-col gap-1">
            <span className="font-semibold">{request.title}</span>
            {request.description ? (
              <span className="whitespace-pre-wrap text-text-secondary [overflow-wrap:anywhere]">
                {request.description}
              </span>
            ) : null}
          </span>
        </SheetRow>
      </dl>
      <div className="flex flex-col gap-4 px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-body-sm text-text-secondary">
            {t("offer.count", { count: request.offerCount })}
          </span>
          {request.canOffer ? (
            <Button
              size="sm"
              variant={myOffer?.status === "PENDING" ? "secondary" : "accent"}
              onClick={() => setShowOfferForm((open) => !open)}
            >
              <Send className="size-4" />
              {myOffer?.status === "PENDING"
                ? t("offer.edit")
                : t("offer.send")}
            </Button>
          ) : null}
        </div>

        {showOfferForm && request.canOffer ? (
          <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
            <CurrencyInput
              label={t("offer.price")}
              value={price}
              onChange={setPrice}
            />
            {request.isDateFlexible ? (
              <DateField
                label={t("offer.date")}
                value={proposedDate}
                onChange={setProposedDate}
              />
            ) : null}
            <Textarea
              rows={2}
              value={message}
              maxLength={1000}
              placeholder={t("offer.message")}
              onChange={(event) => setMessage(event.target.value)}
            />
            {error ? <p className="text-body-sm text-danger">{error}</p> : null}
            <Button
              variant="accent"
              disabled={busy || !price}
              onClick={() => void submitOffer()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("offer.submit")}
            </Button>
          </div>
        ) : null}

        {myOffer && !isOwner ? (
          <div className="flex items-center gap-2 text-body-sm text-text-secondary">
            <Badge
              variant={myOffer.status === "ACCEPTED" ? "success" : "neutral"}
            >
              {t(`offer.status.${myOffer.status}`)}
            </Badge>
            {formatCurrency(myOffer.proposedPrice, myOffer.currency)}
          </div>
        ) : null}

        {isOwner && request.offers.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
            <span className="text-body-sm font-semibold! text-text-primary">
              {t("offer.received")}
            </span>
            {request.offers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-col gap-2 rounded-[var(--fg-radius-md)] bg-bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-body-sm font-semibold! text-text-primary">
                    {providerName(offer)}
                    {offer.provider.profiles.length > 0 ? (
                      <BadgeCheck className="size-4 text-info" />
                    ) : null}
                  </span>
                  <span className="font-semibold! text-gold-700">
                    {formatCurrency(offer.proposedPrice, offer.currency)}
                  </span>
                </div>
                {offer.message ? (
                  <p className="text-body-sm text-text-secondary">
                    {offer.message}
                  </p>
                ) : null}
                {offer.status === "PENDING" &&
                (request.status === "OPEN" ||
                  request.status === "HAS_OFFERS") ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={busy}
                      onClick={() => openAccept(offer)}
                    >
                      {t("offer.accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void decline(offer)}
                    >
                      {t("offer.decline")}
                    </Button>
                  </div>
                ) : (
                  <Badge
                    variant={
                      offer.status === "ACCEPTED" ? "success" : "neutral"
                    }
                    className="w-fit"
                  >
                    {t(`offer.status.${offer.status}`)}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <Dialog
          open={accepting !== null}
          onOpenChange={(open) => !open && setAccepting(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("offer.acceptTitle")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <DateField
                label={t("offer.bookingDate")}
                value={acceptDate}
                onChange={setAcceptDate}
              />
              <Input
                type="time"
                value={acceptTime}
                aria-label={t("offer.bookingTime")}
                onChange={(event) => setAcceptTime(event.target.value)}
              />
              <NativeSelect
                label={t("offer.location")}
                value={locationType}
                onChange={setLocationType}
                options={(["OUTDOOR", "PROVIDER", "CUSTOMER"] as const).map(
                  (type) => ({
                    value: type,
                    label: t(`offer.locationType.${type}`),
                  }),
                )}
              />
              {error ? (
                <p className="text-body-sm text-danger">{error}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setAccepting(null)}>
                {t("offer.cancel")}
              </Button>
              <Button
                variant="accent"
                disabled={busy || !acceptDate || !acceptTime}
                onClick={() => void accept()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("offer.confirmAccept")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <p className="text-body-sm text-text-tertiary">{t("sheet.footer")}</p>
      </div>
    </div>
  );
}

// Whole days until a request closes, rounded up.
function daysLeft(expiresAt: string) {
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000),
  );
}

function SheetRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 border-b border-border-subtle py-2.5 last:border-b-0 max-sm:grid-cols-1 max-sm:gap-y-1">
      <dt className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

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
  MapPin,
  MessageSquareText,
  PenSquare,
  Send,
  Sparkles,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import {
  ProductImageUploader,
  type ProductImage,
} from "@/components/forms/product-image-uploader";
import { ReportModal } from "@/components/modals/report-modal";
import { PostEngagement } from "@/components/social/post-engagement";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  media: { id: string; url: string; type: string }[];
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

export function CommunityFeed({ viewerId }: { viewerId: string | null }) {
  const t = useTranslations("publicPages.community");
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
    <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,680px)] xl:grid-cols-[220px_minmax(0,680px)_280px]">
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
            <span className="hidden text-body-sm text-text-tertiary sm:block">
              {t(`filter.${filter}`)}
            </span>
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
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-text-tertiary" />
            </div>
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

      <aside className="sticky top-[96px] hidden flex-col gap-4 xl:flex">
        <Card className="flex flex-col gap-3">
          <span className="text-heading-sm text-text-primary">
            {t("quickActions")}
          </span>
          <Button
            variant="accent"
            className="w-full justify-start"
            nativeButton={false}
            render={<Link href="/requests/new" />}
          >
            <CalendarDays className="size-4" />
            {t("createBooking")}
          </Button>
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
        <Card className="flex flex-col gap-2">
          <span className="text-heading-sm text-text-primary">
            {t("bookingHelpTitle")}
          </span>
          <p className="text-body-sm text-text-secondary">
            {t("bookingHelpBody")}
          </p>
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
            {formatRelativeTime(new Date(post.createdAt))}
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

      {post.kind === "PORTFOLIO_ALBUM" && post.album ? (
        <div>
          <p className="text-heading-md text-text-primary">
            {post.album.title}
          </p>
          {post.album.description ? (
            <p className="mt-1 whitespace-pre-wrap text-body-md text-text-secondary">
              {post.album.description}
            </p>
          ) : null}
        </div>
      ) : post.caption ? (
        <p className="whitespace-pre-wrap text-body-md text-text-primary">
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

      {post.media.length > 0 ? <PostMedia media={post.media} /> : null}

      <PostEngagement
        postId={post.id}
        viewerId={viewerId}
        initialLiked={post.likedByViewer}
        initialLikeCount={post.likeCount}
        initialCommentCount={post.commentCount}
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

function PostMedia({ media }: { media: FeedPost["media"] }) {
  const visible = media.slice(0, 4);
  return (
    <div
      className={cn(
        "grid gap-1.5 overflow-hidden rounded-xl",
        visible.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {visible.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "relative overflow-hidden bg-bg-sunken",
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-heading-lg text-white">
              +{media.length - 4}
            </div>
          ) : null}
        </div>
      ))}
    </div>
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
    <div className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-sunken p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="accent">{t("bookingBadge")}</Badge>
            <Badge variant="neutral">{roleT(request.role)}</Badge>
          </div>
          <h3 className="text-heading-md text-text-primary">{request.title}</h3>
          <p className="text-body-sm text-text-tertiary">{request.code}</p>
        </div>
        <Badge
          variant={
            request.status === "FULFILLED"
              ? "success"
              : request.status === "CANCELLED" || request.status === "EXPIRED"
                ? "destructive"
                : "warning"
          }
        >
          {t(`requestStatus.${request.status}`)}
        </Badge>
      </div>

      {request.description ? (
        <p className="whitespace-pre-wrap text-body-sm text-text-secondary">
          {request.description}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {request.categories.map((category) => (
          <Badge key={category} variant="neutral">
            {categoryT(category)}
          </Badge>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <InfoTile icon={CalendarDays} label={t("whenLabel")}>
          {request.isDateFlexible
            ? t("flexibleDate", {
                start: request.dateRangeStart
                  ? formatDate(request.dateRangeStart)
                  : "?",
                end: request.dateRangeEnd
                  ? formatDate(request.dateRangeEnd)
                  : "?",
              })
            : request.shootDate
              ? formatDate(request.shootDate)
              : t("notSet")}
        </InfoTile>
        <InfoTile icon={MapPin} label={t("whereLabel")}>
          {request.ward ? `${request.ward.name}, ` : ""}
          {request.province.name}
        </InfoTile>
        <InfoTile icon={WalletCards} label={t("budgetLabel")} accent>
          {formatBudgetRange(request.budgetMin, request.budgetMax) ??
            t("notSet")}
        </InfoTile>
      </div>

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
            {myOffer?.status === "PENDING" ? t("offer.edit") : t("offer.send")}
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
              (request.status === "OPEN" || request.status === "HAS_OFFERS") ? (
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
                  variant={offer.status === "ACCEPTED" ? "success" : "neutral"}
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
            {error ? <p className="text-body-sm text-danger">{error}</p> : null}
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
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  accent = false,
  children,
}: {
  icon: typeof CalendarDays;
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-[var(--fg-radius-md)] p-3",
        accent ? "bg-gold-100 text-gold-800" : "bg-bg-surface",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <span className="text-caption text-text-tertiary">{label}</span>
        <p className="text-body-sm font-semibold! text-text-primary">
          {children}
        </p>
      </div>
    </div>
  );
}

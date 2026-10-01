"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ProfileCategory, Role } from "@prisma/client";
import { ArrowUpRight, CornerDownLeft, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

import { CATEGORIES_BY_ROLE } from "@/lib/constants";
import { foldVietnamese } from "@/lib/vietnam/fold";
import { cn } from "@/lib/utils";
import type {
  QuickSearchAlbum,
  QuickSearchArtist,
} from "@/services/quick-search";

// ⌘K (wave 2 kit §04). A control surface, so it stays on Paper in the
// viewer's theme - never Phòng tối. Pages filter on the device at once;
// artists and albums come from /api/search/quick 150ms after typing stops.
// Groups in a fixed order with fixed caps, an empty group is not shown.
// The input is a combobox that keeps focus; the active row is announced
// through aria-activedescendant.

type Group = "recent" | "goto" | "artists" | "albums" | "styles" | "pages";

interface Row {
  id: string;
  group: Group;
  label: string;
  sub: string;
  href: string;
  kind: "artist" | "album" | "style" | "page";
}

interface PageEntry {
  key: string;
  href: string;
  auth?: boolean;
  flag?: "marketplace" | "social";
  /** Shown under "Đi tới" while the input is empty. */
  goto?: boolean;
}

const PAGES: PageEntry[] = [
  { key: "browse", href: "/browse" },
  { key: "fmap", href: "/fmap", goto: true },
  { key: "requests", href: "/requests" },
  { key: "shop", href: "/shop", flag: "marketplace", goto: true },
  { key: "community", href: "/community", flag: "social", goto: true },
  { key: "about", href: "/about" },
  { key: "dashboard", href: "/dashboard", auth: true },
  { key: "bookings", href: "/dashboard/bookings", auth: true, goto: true },
  { key: "messages", href: "/dashboard/messages", auth: true, goto: true },
  { key: "notifications", href: "/dashboard/notifications", auth: true },
  { key: "settings", href: "/dashboard/settings", auth: true },
  { key: "help", href: "/help" },
];

// Each style once, with the first role it belongs to: /browse only shows
// the style filter with a single role picked, so the link carries both.
const STYLES = Object.entries(CATEGORIES_BY_ROLE).reduce<
  { category: ProfileCategory; role: Role }[]
>((all, [role, categories]) => {
  for (const category of categories ?? []) {
    if (!all.some((s) => s.category === category))
      all.push({ category, role: role as Role });
  }
  return all;
}, []);

const LIMITS = { artists: 4, albums: 3, styles: 3, pages: 4 } as const;
const RECENTS_KEY = "fg:command-recents";
const RECENTS_MAX = 5;
const DEBOUNCE_MS = 150;

function matchesAll(text: string, words: string[]) {
  const folded = foldVietnamese(text);
  return words.every((word) => folded.includes(word));
}

function readRecents(): Row[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Row[]).slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(row: Row) {
  try {
    const next = [
      { ...row, group: "recent" as const, id: `recent-${row.href}` },
      ...readRecents().filter((r) => r.href !== row.href),
    ].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Not remembered; the palette still works.
  }
}

type Remote =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error" }
  | { state: "done"; artists: QuickSearchArtist[]; albums: QuickSearchAlbum[] };

interface CommandPaletteContextValue {
  openPalette: (opener?: HTMLElement | null) => void;
}

const CommandPaletteContext =
  React.createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  return React.useContext(CommandPaletteContext);
}

interface CommandPaletteProps {
  isAuthenticated: boolean;
  marketplaceEnabled: boolean;
  socialFeedEnabled: boolean;
  children: React.ReactNode;
}

export function CommandPalette({
  isAuthenticated,
  marketplaceEnabled,
  socialFeedEnabled,
  children,
}: CommandPaletteProps) {
  const t = useTranslations("sharedComponents.commandPalette");
  const tRole = useTranslations("role");
  const tCategory = useTranslations("profileCategory");
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [recents, setRecents] = React.useState<Row[]>([]);
  const [remote, setRemote] = React.useState<Remote>({ state: "idle" });
  const [retry, setRetry] = React.useState(0);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pointer = React.useRef<{ x: number; y: number } | null>(null);
  const listboxId = React.useId();

  const openPalette = React.useCallback((opener?: HTMLElement | null) => {
    openerRef.current =
      opener ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setRecents(readRecents());
    setQuery("");
    setActive(0);
    setRemote({ state: "idle" });
    setOpen(true);
  }, []);

  // ⌘K on a Mac, Ctrl K elsewhere, from anywhere - toggles.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      if (open) setOpen(false);
      else openPalette();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openPalette]);

  const words = React.useMemo(
    () => foldVietnamese(query).split(/\s+/).filter(Boolean),
    [query],
  );

  React.useEffect(() => {
    if (!open || words.length === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      React.startTransition(() => setRemote({ state: "loading" }));
      fetch(`/api/search/quick?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          const body = (await res.json()) as {
            data: { artists: QuickSearchArtist[]; albums: QuickSearchAlbum[] };
          };
          setRemote({ state: "done", ...body.data });
        })
        .catch(() => {
          if (!controller.signal.aborted) setRemote({ state: "error" });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, words.length, retry]);

  const pages = React.useMemo(
    () =>
      PAGES.filter(
        (page) =>
          (!page.auth || isAuthenticated) &&
          (page.flag !== "marketplace" || marketplaceEnabled) &&
          (page.flag !== "social" || socialFeedEnabled),
      ).map((page): Row => ({
        id: `page-${page.key}`,
        group: "pages",
        kind: "page",
        label: t(`pages.${page.key}`),
        sub: t("pageSub", { path: page.href }),
        href: page.href,
      })),
    [isAuthenticated, marketplaceEnabled, socialFeedEnabled, t],
  );

  const rows = React.useMemo<Row[]>(() => {
    if (words.length === 0) {
      const goto = PAGES.filter((p) => p.goto)
        .map((p) => pages.find((row) => row.href === p.href))
        .filter((row): row is Row => Boolean(row))
        .map((row) => ({
          ...row,
          group: "goto" as const,
          id: `goto-${row.href}`,
        }));
      return [...recents, ...goto];
    }
    const remoteRows: Row[] = [];
    if (remote.state === "done") {
      remote.artists.slice(0, LIMITS.artists).forEach((artist) =>
        remoteRows.push({
          id: `artist-${artist.username}`,
          group: "artists",
          kind: "artist",
          label: artist.name,
          sub: [
            artist.roles.map((role: Role) => tRole(role)).join(", "),
            artist.location,
          ]
            .filter(Boolean)
            .join(" · "),
          href: `/profile/${artist.username}`,
        }),
      );
      remote.albums.slice(0, LIMITS.albums).forEach((album) =>
        remoteRows.push({
          id: `album-${album.id}`,
          group: "albums",
          kind: "album",
          label: album.title,
          sub: t("albumSub", { name: album.providerName }),
          href: `/profile/${album.username}?album=${album.id}#albums`,
        }),
      );
    }
    const styles = STYLES.map(({ category, role }): Row => ({
      id: `style-${category}`,
      group: "styles",
      kind: "style",
      label: tCategory(category),
      sub: t("styleSub", { role: tRole(role) }),
      href: `/browse?roles=${role}&categories=${category}`,
    }))
      .filter((row) => matchesAll(row.label, words))
      .slice(0, LIMITS.styles);
    const pageRows = pages
      .filter((row) => matchesAll(`${row.label} ${row.href}`, words))
      .slice(0, LIMITS.pages);
    return [...remoteRows, ...styles, ...pageRows];
  }, [words, recents, pages, remote, t, tRole, tCategory]);

  const activeIndex =
    rows.length === 0 ? -1 : Math.min(active, rows.length - 1);
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : null;

  React.useEffect(() => {
    if (!activeRow) return;
    document
      .getElementById(`${listboxId}-${activeRow.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeRow, listboxId]);

  const go = (row: Row) => {
    writeRecent(row);
    setOpen(false);
    router.push(row.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + rows.length) % rows.length);
    } else if (e.key === "Enter" && activeRow) {
      e.preventDefault();
      go(activeRow);
    } else if (e.key === "Tab") {
      // Focus stays in the input; the list is reached with the arrows.
      e.preventDefault();
    }
  };

  const groupLabel: Record<Group, string> = {
    recent: t("groups.recent"),
    goto: t("groups.goto"),
    artists: t("groups.artists"),
    albums: t("groups.albums"),
    styles: t("groups.styles"),
    pages: t("groups.pages"),
  };

  const searching =
    words.length > 0 && (remote.state === "idle" || remote.state === "loading");
  const empty =
    words.length > 0 && remote.state === "done" && rows.length === 0;

  // Swipe the sheet's handle down to close (phones).
  const dragStart = React.useRef<number | null>(null);

  let lastGroup: Group | null = null;

  return (
    <CommandPaletteContext.Provider value={{ openPalette }}>
      {children}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next, details) => {
          // First Esc clears what was typed, the second closes.
          if (!next && details.reason === "escape-key" && query) {
            details.cancel();
            setQuery("");
            setActive(0);
            return;
          }
          setOpen(next);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[var(--dr-scrim)] transition-opacity duration-[var(--fg-dur-200)] ease-fg-out data-ending-style:opacity-0 data-ending-style:duration-[var(--fg-dur-150)] data-ending-style:ease-fg-in data-starting-style:opacity-0 motion-reduce:transition-none" />
          <DialogPrimitive.Popup
            initialFocus={inputRef}
            finalFocus={openerRef}
            aria-label={t("title")}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden border border-border-subtle bg-surface-card text-text-primary outline-none motion-reduce:transition-none",
              // Phones: a sheet from the bottom, 88% tall.
              "inset-x-0 bottom-0 h-[88dvh] rounded-t-[var(--fg-radius-xl)] transition-transform duration-[var(--fg-dur-320)] ease-fg-out data-ending-style:translate-y-full data-ending-style:duration-[var(--fg-dur-200)] data-ending-style:ease-fg-in data-starting-style:translate-y-full",
              // Desktop: centred card, fades and scales from 0.98.
              "md:inset-x-auto md:top-[12vh] md:bottom-auto md:left-1/2 md:h-auto md:max-h-[min(560px,76vh)] md:w-[min(640px,calc(100vw-2rem))] md:-translate-x-1/2 md:rounded-[var(--fg-radius-xl)] md:shadow-[var(--shadow-lg)] md:transition-[opacity,scale] md:duration-[var(--fg-dur-200)] md:data-ending-style:translate-y-0 md:data-ending-style:scale-[0.98] md:data-ending-style:opacity-0 md:data-ending-style:duration-[var(--fg-dur-150)] md:data-starting-style:translate-y-0 md:data-starting-style:scale-[0.98] md:data-starting-style:opacity-0",
            )}
          >
            <div
              className="flex justify-center pt-2 pb-1 md:hidden"
              onTouchStart={(e) => {
                dragStart.current = e.touches[0].clientY;
              }}
              onTouchEnd={(e) => {
                const start = dragStart.current;
                dragStart.current = null;
                if (start !== null && e.changedTouches[0].clientY - start > 80)
                  setOpen(false);
              }}
            >
              <span
                aria-hidden
                className="h-1 w-10 rounded-full bg-border-strong"
              />
            </div>

            <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
              <Search
                aria-hidden
                className="size-5 shrink-0 text-text-tertiary"
              />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  activeRow ? `${listboxId}-${activeRow.id}` : undefined
                }
                aria-label={t("inputLabel")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={t("placeholder")}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
                className="min-w-0 flex-1 bg-transparent text-body-lg text-text-primary outline-none placeholder:text-text-tertiary"
              />
              {searching ? (
                <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
                  {t("searching")}
                </span>
              ) : null}
              <kbd className="hidden rounded-[var(--fg-radius-sm)] border border-border-default px-1.5 py-0.5 font-mono text-meta text-text-tertiary md:inline">
                Esc
              </kbd>
              <DialogPrimitive.Close className="focus-ring rounded-[var(--fg-radius-sm)] px-1 text-body-sm font-semibold! text-text-secondary md:hidden">
                {t("cancel")}
              </DialogPrimitive.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
              {remote.state === "error" && words.length > 0 ? (
                <div className="mx-2 my-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--fg-radius-md)] bg-bg-sunken px-3 py-2.5 text-body-sm text-text-secondary">
                  <span>{t("error")}</span>
                  <button
                    type="button"
                    onClick={() => setRetry((n) => n + 1)}
                    className="focus-ring rounded-[var(--fg-radius-sm)] font-semibold! text-brand-primary"
                  >
                    {t("retry")}
                  </button>
                </div>
              ) : null}

              {empty ? (
                <div className="flex flex-col gap-3 px-3 py-6">
                  <p className="text-heading-sm text-text-primary">
                    {t("emptyTitle", { query: query.trim() })}
                  </p>
                  <p className="text-body-sm text-text-secondary">
                    {t("emptyHint")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["YEARBOOK", "WEDDING"] as const).map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => {
                          setQuery(tCategory(category));
                          setActive(0);
                          inputRef.current?.focus();
                        }}
                        className="focus-ring rounded-full border border-border-default px-3 py-1 text-body-sm text-text-secondary hover:text-text-primary"
                      >
                        {tCategory(category)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        go({
                          id: "page-fmap",
                          group: "pages",
                          kind: "page",
                          label: t("pages.fmap"),
                          sub: t("pageSub", { path: "/fmap" }),
                          href: "/fmap",
                        })
                      }
                      className="focus-ring rounded-full border border-border-default px-3 py-1 text-body-sm text-text-secondary hover:text-text-primary"
                    >
                      {t("pages.fmap")}
                    </button>
                  </div>
                </div>
              ) : null}

              <div id={listboxId} role="listbox" aria-label={t("resultsLabel")}>
                {rows.map((row, index) => {
                  const header = row.group !== lastGroup;
                  lastGroup = row.group;
                  const selected = index === activeIndex;
                  return (
                    <React.Fragment key={row.id}>
                      {header ? (
                        <p
                          role="presentation"
                          className="px-3 pt-3 pb-1.5 font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase"
                        >
                          {groupLabel[row.group]}
                        </p>
                      ) : null}
                      <div
                        id={`${listboxId}-${row.id}`}
                        role="option"
                        aria-selected={selected}
                        onPointerMove={(e) => {
                          // Only a real mouse movement moves the selection,
                          // not the list scrolling under a still pointer.
                          const last = pointer.current;
                          pointer.current = { x: e.clientX, y: e.clientY };
                          if (
                            last &&
                            last.x === e.clientX &&
                            last.y === e.clientY
                          )
                            return;
                          if (!selected) setActive(index);
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(row)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-[var(--fg-radius-md)] px-3 py-2.5",
                          selected ? "bg-bg-sunken" : "",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-md font-semibold! text-text-primary">
                            {row.label}
                          </span>
                          <span className="block truncate text-body-sm text-text-tertiary">
                            {row.sub}
                          </span>
                        </span>
                        {row.kind === "page" ? (
                          <ArrowUpRight
                            aria-hidden
                            className="size-4 shrink-0 text-text-tertiary"
                          />
                        ) : null}
                        {selected ? (
                          <CornerDownLeft
                            aria-hidden
                            className="size-4 shrink-0 text-text-secondary max-md:hidden"
                          />
                        ) : null}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div className="hidden items-center gap-4 border-t border-border-subtle px-4 py-2.5 font-mono text-meta text-text-tertiary md:flex">
              <span>↑↓ {t("hintMove")}</span>
              <span>↵ {t("hintOpen")}</span>
              <span className="ml-auto tracking-[0.12em] uppercase">
                {t("hintEverywhere")}
              </span>
            </div>
            <span className="sr-only" aria-live="polite">
              {empty
                ? t("emptyTitle", { query: query.trim() })
                : words.length > 0 && remote.state === "done"
                  ? t("resultCount", { count: rows.length })
                  : ""}
            </span>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </CommandPaletteContext.Provider>
  );
}

/** The search button in the header: opens the palette, shows ⌘K. */
export function CommandPaletteTrigger({
  compact = false,
}: {
  compact?: boolean;
}) {
  const t = useTranslations("sharedComponents.commandPalette");
  const palette = useCommandPalette();
  const [isMac, setIsMac] = React.useState(true);
  React.useEffect(() => {
    React.startTransition(() =>
      setIsMac(
        /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
      ),
    );
  }, []);
  if (!palette) return null;
  return (
    <button
      type="button"
      onClick={(e) => palette.openPalette(e.currentTarget)}
      aria-label={t("open")}
      aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
      className={cn(
        "focus-ring flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface text-text-secondary transition-colors duration-[var(--fg-dur-150)] hover:text-text-primary",
        compact ? "size-9 justify-center" : "h-9 pr-2 pl-3",
      )}
    >
      <Search aria-hidden className="size-4" />
      {compact ? null : (
        <>
          <span className="text-body-sm">{t("triggerLabel")}</span>
          <kbd className="rounded-[var(--fg-radius-sm)] border border-border-default px-1.5 font-mono text-meta text-text-tertiary">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </>
      )}
    </button>
  );
}

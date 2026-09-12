// Tier-1 automated image moderation via OpenAI's Moderation endpoint
// (omni-moderation-latest). Deliberately a hand-rolled fetch call rather
// than the `openai` SDK: this is one POST to one endpoint with a small,
// stable payload, and the SDK would be a new production dependency
// carrying far more surface than that — same reasoning as lib/momo.ts and
// lib/zalopay.ts, which also speak their providers' HTTP APIs directly.
//
// No-ops gracefully when OPENAI_API_KEY isn't set, matching the pattern
// used for Stripe/Cloudinary/Resend/Twilio (docs/ARCHITECTURE.md §7) —
// callers check isContentModerationConfigured() rather than crash.
//
// The endpoint is free and doesn't count toward API usage limits, so
// there's no per-upload cost to weigh against scanning everything.
import { env } from "@/lib/env";

const ENDPOINT = "https://api.openai.com/v1/moderations";
const MODEL = "omni-moderation-latest";

// The scan sits inline on the avatar/cover path (/api/users/me PATCH), so
// a hung request would block someone saving their settings. On timeout we
// fall back to the human queue rather than making them wait.
const TIMEOUT_MS = 10_000;

// Categories omni-moderation actually evaluates for IMAGE input. The
// text-only categories (harassment*, hate*, illicit*, and — see the
// warning below — sexual/minors) are still present in the response but
// are always false for an image-only request, so scoring them would be
// meaningless.
export const IMAGE_CATEGORIES = [
  "sexual",
  "violence",
  "violence/graphic",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

// IMPORTANT, and the single biggest limitation of this tier:
// `sexual/minors` is a TEXT-ONLY category. OpenAI does NOT evaluate it for
// image input, so this scanner cannot detect a minor in a photo — the
// exact case CLAUDE.md's ràng buộc #3/#4 and the "Appears to be a minor"
// report reason care most about. That detection remains entirely with
// human review (/admin/moderation) and user reports. Do not let the
// presence of an automated tier create the impression it's covered.
// Source: https://developers.openai.com/api/docs/guides/moderation
export const SEXUAL_MINORS_IS_TEXT_ONLY = true;

export interface ModerationScores {
  // Highest-scoring image category and its score, plus the raw per-category
  // map for the audit trail.
  flagged: boolean;
  scores: Partial<Record<ImageCategory, number>>;
}

export function isContentModerationConfigured() {
  return Boolean(env.OPENAI_API_KEY);
}

export class ModerationNotConfiguredError extends Error {
  constructor() {
    super("OpenAI moderation isn't configured in this environment");
    this.name = "ModerationNotConfiguredError";
  }
}

interface ModerationApiResult {
  flagged: boolean;
  category_scores: Record<string, number>;
}

// Returns null when the image can't be scanned at all — not configured,
// a non-fetchable URL, a network/API failure, or a timeout. Callers treat
// null as "unknown", never as "clean": see services/moderation.ts.
export async function moderateImageUrl(
  url: string,
): Promise<ModerationScores | null> {
  if (!isContentModerationConfigured()) return null;

  // OpenAI fetches this URL itself, so it has to be publicly reachable
  // over http(s). Cloudinary portfolio delivery URLs are (KYC images are
  // NOT — they're `authenticated` delivery and must never be sent here;
  // see prisma/schema.prisma's UserRole comment). A blob:/data: URL from
  // a half-configured local environment would just make OpenAI 400.
  if (!/^https?:\/\//i.test(url)) return null;

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ type: "image_url", image_url: { url } }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Network error or timeout — unknown, not clean.
    return null;
  }

  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const result = (body as { results?: ModerationApiResult[] } | null)
    ?.results?.[0];
  if (!result || typeof result.flagged !== "boolean") return null;

  const scores: Partial<Record<ImageCategory, number>> = {};
  for (const category of IMAGE_CATEGORIES) {
    const score = result.category_scores?.[category];
    if (typeof score === "number") scores[category] = score;
  }

  return { flagged: result.flagged, scores };
}

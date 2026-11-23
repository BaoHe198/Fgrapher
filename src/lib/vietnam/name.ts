/**
 * Vietnamese full names run family name first: "Trần Văn Hùng". The User
 * model's firstName holds the name a person is called by (the seed data
 * already does: firstName "Minh Anh", lastName "Nguyễn"), so registration
 * used to greet "Trần Văn Hùng" as "Chào buổi tối, Trần" — the family name.
 *
 * The family name is the first word; the gender markers "Văn" and "Thị"
 * right after it go with it, since nobody is addressed by them. Everything
 * after that is the given name, which may be two words ("Minh Anh").
 */
import { foldVietnamese } from "@/lib/vietnam/fold";

const GENDER_MARKERS = new Set(["van", "thi"]);

// Family names, accent-folded, so "Nguyen Van An" splits like "Nguyễn Văn
// An". A name that does not start with one is not split: providers often
// sign up under a trade name, and "Lan Anh Studio" was addressed as "Anh
// Studio" all over its own profile (23/11/2026 walk-through). Whole-name
// fallback is the safe side — calling someone by their full name is polite,
// cutting a word off a brand is not.
const FAMILY_NAMES = new Set(
  [
    "Nguyễn",
    "Trần",
    "Lê",
    "Phạm",
    "Hoàng",
    "Huỳnh",
    "Phan",
    "Vũ",
    "Võ",
    "Đặng",
    "Bùi",
    "Đỗ",
    "Hồ",
    "Ngô",
    "Dương",
    "Lý",
    "Đinh",
    "Đào",
    "Đoàn",
    "Vương",
    "Trịnh",
    "Trương",
    "Lâm",
    "Phùng",
    "Mai",
    "Tô",
    "Hà",
    "Tạ",
    "Cao",
    "Lưu",
    "Lương",
    "Châu",
    "Quách",
    "Thái",
    "Tăng",
    "Kiều",
    "Khúc",
    "Kim",
    "La",
    "Lã",
    "Lò",
    "Mạc",
    "Nghiêm",
    "Nông",
    "Ông",
    "Quan",
    "Tôn",
    "Từ",
    "Triệu",
    "Thân",
    "Thạch",
    "Tiêu",
    "Ung",
    "Vi",
    "Âu",
    "Bạch",
    "Bế",
    "Cù",
    "Chu",
    "Chung",
    "Cung",
    "Diệp",
    "Doãn",
    "Giang",
    "Giáp",
    "Hàn",
    "Hầu",
    "Hứa",
    "Kha",
    "Khổng",
    "Khương",
    "Lục",
    "Lư",
    "Mã",
    "Mẫn",
    "Ninh",
    "Phó",
    "Phí",
    "Sầm",
    "Tống",
    "Thiều",
    "Trình",
    "Yên",
  ].map((name) => foldVietnamese(name)),
);

// Words that mark a trade name rather than a person's name. Matched
// accent-folded, so none may fold onto a given name ("ảnh" would match Anh).
const BUSINESS_WORDS = new Set(
  [
    "studio",
    "photo",
    "photos",
    "photography",
    "photographer",
    "wedding",
    "media",
    "film",
    "films",
    "makeup",
    "bridal",
    "house",
    "team",
    "agency",
    "production",
    "productions",
    "concept",
    "art",
    "store",
    "shop",
    "cưới",
    "phim",
  ].map((word) => foldVietnamese(word)),
);

export function splitVietnameseName(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const folded = words.map((word) => foldVietnamese(word));
  if (
    words.length <= 1 ||
    !FAMILY_NAMES.has(folded[0]) ||
    folded.some((word) => BUSINESS_WORDS.has(word))
  ) {
    return { firstName: words.join(" "), lastName: null };
  }
  const family = [words[0]];
  let rest = words.slice(1);
  if (rest.length >= 2 && GENDER_MARKERS.has(foldVietnamese(rest[0]))) {
    family.push(rest[0]);
    rest = rest.slice(1);
  }
  return { firstName: rest.join(" "), lastName: family.join(" ") };
}

/** Full name in Vietnamese order: family name, then given name. */
export function joinVietnameseName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) {
  return [lastName, firstName].filter(Boolean).join(" ");
}

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
const GENDER_MARKERS = new Set(["văn", "thị"]);

export function splitVietnameseName(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { firstName: words[0] ?? "", lastName: null };
  }
  const family = [words[0]];
  let rest = words.slice(1);
  if (rest.length >= 2 && GENDER_MARKERS.has(rest[0].toLocaleLowerCase("vi"))) {
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

const MIN_MODEL_AGE = 18;

export function calculateAge(dateOfBirth: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = at.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

export function isAtLeast18(dateOfBirth: Date): boolean {
  return calculateAge(dateOfBirth) >= MIN_MODEL_AGE;
}

// Buckets an exact age into a public-facing range — profile pages must
// never display dateOfBirth or a computed exact age directly, only this.
export function getAgeRangeLabel(dateOfBirth: Date): string {
  const age = calculateAge(dateOfBirth);
  if (age < 25) return "18–24";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  return "45+";
}

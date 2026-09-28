// Design-sync shim for next/script: third-party scripts (the Zalo chat
// widget) have no place in a design preview.
export default function Script() {
  return null;
}

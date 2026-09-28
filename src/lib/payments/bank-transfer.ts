// Dormant while BANK_TRANSFER_ENABLED=false (src/lib/features.ts). No
// signature/API to no-op here — this method has no third-party API at
// all, just static account info shown to the customer and a manual
// admin confirmation queue (/admin/payments). "Configured" simply means
// the business's real account details have been entered.
export function isBankTransferConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT_NUMBER &&
    process.env.NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT_NAME &&
    process.env.NEXT_PUBLIC_BANK_TRANSFER_BANK_NAME,
  );
}

export function getBankTransferInfo() {
  const accountNumber = process.env.NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT_NUMBER;
  const accountName = process.env.NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT_NAME;
  const bankName = process.env.NEXT_PUBLIC_BANK_TRANSFER_BANK_NAME;
  if (!accountNumber || !accountName || !bankName) return null;
  return { accountNumber, accountName, bankName };
}

// Short, human-typeable code the customer is asked to put in their bank
// transfer's message/content field, so an admin cross-checking the real
// bank statement can match a transfer back to this specific submission
// without relying on exact-amount matching alone (two customers paying
// the same role's monthly price on the same day would otherwise be
// ambiguous). Not a security token — it's written in a bank transfer
// memo a bank teller or app might mangle, so short and typo-tolerant
// (uppercase, no ambiguous 0/O or 1/I characters) beats long and random.
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateTransferReference() {
  let code = "FG";
  for (let i = 0; i < 6; i++) {
    code +=
      REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)];
  }
  return code;
}

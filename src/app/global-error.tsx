"use client";

// Catches errors thrown by the root layout itself (rare — the regular
// error.tsx above can't catch those since it renders inside that layout).
// Must render its own <html>/<body>; kept deliberately plain/inline-styled
// since it can't rely on globals.css having loaded successfully. Text is
// hardcoded Vietnamese (not next-intl) rather than "just wire up t()" —
// this boundary can fire when the root layout itself (which is what sets
// up NextIntlClientProvider) has failed, so the locale context it would
// need may not exist. vi matches the app's default locale (CLAUDE.md
// rule 10) for the one screen that can never safely depend on it.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          fontFamily: "-apple-system, Helvetica, Arial, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 700 }}>Đã xảy ra lỗi</h1>
        <p style={{ color: "#6b7280", maxWidth: "420px" }}>
          Có lỗi ngoài ý muốn xảy ra. Vui lòng thử lại.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 20px",
            borderRadius: "999px",
            border: "none",
            background: "hsl(38 44% 52%)",
            color: "hsl(30 15% 11%)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Thử lại
        </button>
      </body>
    </html>
  );
}

"use client";

// Catches errors thrown by the root layout itself (rare — the regular
// error.tsx above can't catch those since it renders inside that layout).
// Must render its own <html>/<body>; kept deliberately plain/inline-styled
// since it can't rely on globals.css having loaded successfully.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
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
        <h1 style={{ fontSize: "24px", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "#6b7280", maxWidth: "420px" }}>
          An unexpected error occurred. Please try again.
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
          Try again
        </button>
      </body>
    </html>
  );
}

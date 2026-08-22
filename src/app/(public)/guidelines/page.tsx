import type { Metadata } from "next";

import { SimplePage } from "@/components/sections/simple-page";

export const metadata: Metadata = { title: "Content Guidelines — Fgrapher" };

export default function GuidelinesPage() {
  return (
    <SimplePage
      title="Content Guidelines"
      subtitle="Applies to every portfolio, and especially to Model profiles"
    >
      <p>
        Fgrapher hosts real photos of real people. These guidelines exist to keep the platform
        safe and professional for everyone — models, photographers, and clients alike. Every
        Model account must accept these guidelines at registration; violating them can result in
        content removal, suspension, or a permanent ban.
      </p>
      <h2>What&apos;s not allowed</h2>
      <ul>
        <li>No nudity.</li>
        <li>No sexually suggestive content.</li>
        <li>No images of anyone under 18, in any context.</li>
        <li>
          No images you don&apos;t have the rights to — you must be the model, the photographer,
          or otherwise have explicit permission to upload and display the image.
        </li>
      </ul>
      <h2>Reporting a violation</h2>
      <p>
        Every profile has a &quot;Report&quot; option. Reports for inappropriate content or a
        profile that appears to belong to someone under 18 are routed to a high-priority review
        queue and looked at as soon as possible.
      </p>
      <h2>Enforcement</h2>
      <p>
        Violations are reviewed by the Fgrapher team. Depending on severity, we may remove the
        specific content, require identity/age re-verification, suspend the account, or ban it
        permanently. Content involving a suspected minor is escalated immediately and reported to
        the appropriate authorities where required by law.
      </p>
    </SimplePage>
  );
}

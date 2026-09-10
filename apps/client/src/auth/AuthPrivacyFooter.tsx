import type { ReactNode } from "react";
import { Text } from "@sarvam/tatva";
import { openUrl } from "@tauri-apps/plugin-opener";

const TERMS_OF_SERVICE_URL = "https://www.sarvam.ai/terms-of-service";
const PRIVACY_POLICY_URL = "https://www.sarvam.ai/privacy-policy";

/**
 * The Tauri webview blocks target="_blank" navigation, so external links
 * are handed to the system browser through the opener plugin; running in
 * a plain browser (vite dev) falls back to window.open.
 */
async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        event.preventDefault();
        void openExternal(href);
      }}
      className="underline"
    >
      {children}
    </a>
  );
}

export function AuthPrivacyFooter() {
  return (
    <div className="flex w-full justify-center pt-tatva-4">
      <Text variant="body-sm" tone="tertiary" as="p" textAlign="center">
        By continuing you agree to our{" "}
        <ExternalLink href={TERMS_OF_SERVICE_URL}>terms of service</ExternalLink> and{" "}
        <ExternalLink href={PRIVACY_POLICY_URL}>privacy policy</ExternalLink>
      </Text>
    </div>
  );
}

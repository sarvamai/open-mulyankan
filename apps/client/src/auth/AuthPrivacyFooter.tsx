import { Text } from "@sarvam/tatva";

/**
 * The legal notice on the sign-in screen.
 *
 * Deliberately not a link. The client opens nothing: no anchor, no
 * `target="_blank"`, no handoff to the system browser. ADR-0008 confines it to
 * four things — authenticate, receive one task, act, report — and an outbound
 * navigation is none of them. It is also the one surface an exam taker sees
 * before signing in, so the smallest possible escape hatch is no escape hatch.
 *
 * The policies themselves reach the workforce through the authority's own
 * channels, not through a window this application can open.
 */
export function AuthPrivacyFooter() {
  return (
    <div className="flex w-full justify-center pt-tatva-4">
      <Text variant="body-sm" tone="tertiary" as="p" textAlign="center">
        By continuing you agree to Sarvam's terms of service and privacy policy
      </Text>
    </div>
  );
}

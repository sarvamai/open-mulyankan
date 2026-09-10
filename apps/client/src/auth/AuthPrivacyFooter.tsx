import { Text } from "@sarvam/tatva";

const TERMS_OF_SERVICE_URL = "https://www.sarvam.ai/terms-of-service";
const PRIVACY_POLICY_URL = "https://www.sarvam.ai/privacy-policy";

export function AuthPrivacyFooter() {
  return (
    <div className="flex w-full justify-center pt-tatva-4">
      <Text variant="body-sm" tone="tertiary" as="p" textAlign="center">
        By continuing you agree to our{" "}
        <a
          href={TERMS_OF_SERVICE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          terms of service
        </a>{" "}
        and{" "}
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          privacy policy
        </a>
      </Text>
    </div>
  );
}

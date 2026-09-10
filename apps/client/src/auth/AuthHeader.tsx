import { Text } from "@sarvam/tatva";

const SARVAM_LOGO_MARK = "/shared/sarvam-logo.png";
const LOGO_MARK_SIZE = 48;

export function AuthHeader({ heading = "Log into your account" }: { heading?: string }) {
  return (
    <div className="flex flex-col items-center gap-tatva-10 text-center mb-tatva-18">
      <img src={SARVAM_LOGO_MARK} alt="Sarvam" width={LOGO_MARK_SIZE} height={LOGO_MARK_SIZE} />
      <Text variant="heading-lg" textAlign="center">
        {heading}
      </Text>
    </div>
  );
}

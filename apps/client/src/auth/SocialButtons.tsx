import type { ComponentProps, ComponentType, ReactNode } from "react";
import { Button, Icon } from "@sarvam/tatva";

/**
 * The social sign-in buttons, ported from mulyankan-frontend's
 * SocialButtonGroup. The provider list is static here — the live list comes
 * from the identity flow once the contracts/ slice lands.
 */

// Button types children as string; widen to ReactNode for provider icons.
type SocialButtonBaseProps = Omit<ComponentProps<typeof Button>, "children"> & {
  children?: ReactNode;
};
const SocialButtonBase = Button as ComponentType<SocialButtonBaseProps>;

interface SocialProvider {
  id: string;
  label: string;
  /** Multicolour brand SVGs that tatva's icon set does not carry. */
  iconSrc?: string;
  /** Providers whose mark exists in tatva's closed icon set. */
  iconName?: "apple";
}

const SOCIAL_PROVIDERS: SocialProvider[] = [
  { id: "google", label: "Continue with Google", iconSrc: "/shared/logos/google.svg" },
  { id: "microsoft", label: "Continue with Microsoft", iconSrc: "/shared/logos/microsoft.svg" },
  { id: "apple", label: "Continue with Apple", iconName: "apple" },
];

function ProviderMark({ provider }: { provider: SocialProvider }) {
  if (provider.iconName) return <Icon name={provider.iconName} size="md" />;
  if (provider.iconSrc) {
    return (
      <img
        src={provider.iconSrc}
        alt=""
        width={18}
        height={18}
        className="h-[18px] w-[18px] shrink-0"
      />
    );
  }
  return (
    <span
      className="h-[18px] w-[18px] shrink-0 rounded bg-tatva-background-primary-hover"
      aria-hidden
    />
  );
}

export function SocialButtons({ onProvider }: { onProvider: (provider: string) => void }) {
  return (
    <div className="flex flex-col gap-tatva-4">
      {SOCIAL_PROVIDERS.map((provider) => (
        <SocialButtonBase
          key={provider.id}
          variant="secondary"
          size="lg"
          width="full"
          type="button"
          onClick={() => onProvider(provider.id)}
        >
          <span className="flex gap-tatva-4 items-center justify-center">
            <ProviderMark provider={provider} />
            {provider.label}
          </span>
        </SocialButtonBase>
      ))}
    </div>
  );
}

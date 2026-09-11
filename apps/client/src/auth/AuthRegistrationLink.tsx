import { Text } from "@sarvam/tatva";

export function AuthRegistrationLink({
  onNavigateToRegistration,
}: {
  onNavigateToRegistration: () => void;
}) {
  return (
    <div className="mt-tatva-12 flex items-center justify-center gap-tatva-2">
      <Text variant="body-sm" tone="default">
        Don't have an account?
      </Text>
      <button
        type="button"
        className="cursor-pointer hover:underline"
        onClick={onNavigateToRegistration}
      >
        <Text variant="body-sm" tone="secondary">
          Create one
        </Text>
      </button>
    </div>
  );
}

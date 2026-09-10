import { Divider, Text } from "@sarvam/tatva";

export function AuthDivider({ text = "OR" }: { text?: string }) {
  return (
    <div className="flex w-full items-center gap-tatva-4 my-tatva-10">
      <div className="flex-1">
        <Divider orientation="horizontal" variant="primary" />
      </div>
      <Text variant="body-sm" tone="secondary">
        {text}
      </Text>
      <div className="flex-1">
        <Divider orientation="horizontal" variant="primary" />
      </div>
    </div>
  );
}

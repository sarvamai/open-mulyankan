import { useState } from "react";
import { Button, Input, Text } from "@sarvam/tatva";

import { AuthDivider } from "./auth/AuthDivider";
import { AuthHeader } from "./auth/AuthHeader";
import { AuthRegistrationLink } from "./auth/AuthRegistrationLink";
import { AuthShellSplit } from "./auth/AuthShellSplit";
import { SocialButtons } from "./auth/SocialButtons";

/**
 * The thin client's sign-in screen, ported from mulyankan-frontend's login
 * surface. Per ADR-0008 the client can do exactly four things — authenticate,
 * receive one task, act, report — and this is the first of them. Every control
 * is a placeholder until the contracts/ slice lands: the OIDC flow runs
 * through the identity SPI (ADR-0004) and is not wired to this screen yet.
 */
function App() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");

  return (
    <AuthShellSplit>
      <AuthHeader />

      <SocialButtons
        onProvider={(provider) => setNotice(`${provider} sign-in arrives with the contracts slice.`)}
      />

      <AuthDivider text="OR" />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(
            "Authentication arrives with the contracts slice — the server is not wired to this screen yet.",
          );
        }}
      >
        <div className="mb-4 flex flex-col">
          <Input
            name="identifier"
            type="email"
            placeholder="e.g., name@company.com"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            size="md"
            autoComplete="username"
          />
        </div>

        <Button type="submit" variant="primary" size="lg" width="full" disabled={!email.trim()}>
          Continue
        </Button>
      </form>

      <AuthRegistrationLink
        onNavigateToRegistration={() => setNotice("Registration arrives with the contracts slice.")}
      />

      {notice ? (
        <div className="mt-tatva-6 text-center">
          <Text variant="body-sm" tone="tertiary" as="p" textAlign="center">
            {notice}
          </Text>
        </div>
      ) : null}
    </AuthShellSplit>
  );
}

export default App;

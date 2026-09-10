import { useState } from "react";
import { Button, Input } from "@sarvam/tatva";

/**
 * The thin client's first screen. Per ADR-0008 the client can do exactly four
 * things — authenticate, receive one task, act, report — and this is the first
 * of them. It is a placeholder: the OIDC flow through the identity SPI
 * (ADR-0004) arrives with the contracts/ slice, so signing in does nothing yet
 * beyond saying so.
 */
function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgb(var(--tatva-surface-primary))",
        color: "rgb(var(--tatva-content-primary))",
        fontFamily: "var(--tatva-family-matter)",
      }}
    >
      <div
        style={{
          width: "22rem",
          padding: "2rem",
          borderRadius: "0.75rem",
          backgroundColor: "rgb(var(--tatva-surface-secondary))",
          border: "1px solid rgb(var(--tatva-border-primary))",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Mulyankan</h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "rgb(var(--tatva-content-secondary))",
            }}
          >
            The content-authoring thin client. Sign in to receive your assigned task.
          </p>
        </div>

        <form
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          onSubmit={(event) => {
            event.preventDefault();
            setNotice(
              "Authentication arrives with the contracts slice — the server is not wired to this screen yet.",
            );
          }}
        >
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder="you@example.in"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <Button type="submit">Sign in</Button>
        </form>

        {notice ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              color: "rgb(var(--tatva-content-secondary))",
            }}
          >
            {notice}
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default App;

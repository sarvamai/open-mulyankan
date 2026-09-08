# ADR-0004: Identity — enterprise OIDC behind the identity SPI

- Status: Accepted
- Date: 2026-09-07

## Context

FND04-CAP-01..03 and UI-01 require enterprise identity with MFA, short-lived
sessions, and no local password forms. FND04-CAP-11 requires sign-in only from
managed workstations in approved network zones. The MVP window does not
include the production IdP integration — that arrives with Week 5 hardening.

## Decision

All authentication flows through the `identity` SPI. Keycloak runs in the
development compose stack as the stand-in IdP; production binds the
authority's enterprise IdP. The platform validates OIDC tokens server-side on
every request (ARC-01), derives pseudonymous workforce identifiers (DAT-02),
and treats device-posture and network-zone claims as mandatory inputs to
sign-in. There are no local passwords anywhere.

## Consequences

- The Week 1 walking skeleton signs in against Keycloak with posture and zone
  claims supplied by the development identity provider.
- Authorization never trusts client-supplied role claims: identity only
  authenticates; roles and permissions come from the capability registry and
  the permission matrix (INT-10).
- Session registration, heartbeat, and closure (ASR02-OBS-01) are platform
  concerns, not provider concerns.

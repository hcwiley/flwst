# .cursor/guides/04-security-and-secrets.md

## Never commit secrets

### Forbidden

- API keys
- OAuth secrets
- real IDs or project names

### Allowed

- sanitized placeholders in `config/examples/*`
- `.env.example` files

## Local data

Sensitive local state must:

- be encrypted at rest (implemented in later phases)
- never be logged or sent to telemetry

## Telemetry redaction

Never include:

- raw transcripts
- prompt bodies
- OAuth tokens
- Notion IDs

Telemetry must be metadata-only.

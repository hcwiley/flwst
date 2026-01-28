# .cursor/rules/05-use-core-logger.md

## Rule

- Always use the structured logger from `@flwst/core` instead of `console.log`,
  `console.warn`, or `console.error`.
- Import the logger from `@flwst/core`:
  ```typescript
  import { logger } from '@flwst/core';
  ```
- Use the appropriate log level (`debug`, `info`, `warn`, `error`) and provide
  structured metadata when relevant.

## Rationale

- Ensures consistent log formatting across all packages.
- Supports structured logging with metadata for better debugging and telemetry.
- Allows for centralized control over log levels and redaction of sensitive data
  (per `04-security-and-secrets.md`).

## Examples

### Correct

```typescript
import { logger } from '@flwst/core';

logger.info('User logged in', {
  userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
});
logger.error('Failed to save config', { error: err.message });
```

### Incorrect

```typescript
console.log('User logged in');
console.error('Failed to save config', err);
```

## Forbidden

- Direct use of `console.log`, `console.info`, `console.warn`, or
  `console.error` in application code or libraries.
- Logging raw secrets or sensitive data (PII) in metadata.

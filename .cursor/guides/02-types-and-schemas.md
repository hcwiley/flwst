# .cursor/guides/02-types-and-schemas.md

## Zod-first policy

Zod schemas are the source of truth for:

- config
- artifacts
- API request/response payloads
- normalized Notion objects

Define schemas first and infer types:

```typescript
export const ConfigSchema = z.object({
  /* ... */
});
export type Config = z.infer<typeof ConfigSchema>;
```

Do not maintain duplicated “type + schema” definitions.

## Where things live

- `types/src/schemas/*` — Zod schemas
- `types/src/*.ts` — exported domain types
- `types/src/index.ts` — public re-exports only

## Boundary validation

Any data coming from:

- filesystem
- network
- third-party SDKs

Must be validated with Zod at the boundary.

Use:

- `safeParse` for recoverable errors
- structured error objects with stable error codes

## Required baseline schemas

- `ConfigSchema`
- `ArtifactSchema`
- `ServerRequestSchema`
- `ServerResponseSchema`

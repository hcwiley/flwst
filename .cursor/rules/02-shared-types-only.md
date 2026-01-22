# .cursor/rules/02-shared-types-only.md

All shared domain types live in `types/`.

## Rules

- Define shared types only in `types/src/**`
- Export shared types from `types/src/index.ts`
- Import shared types using:

```typescript
import type { Foo } from '@flwst/types';
```

## Forbidden

- Exported domain types in `apps/**`, `libs/**`, or `servers/**`
- Deep or relative imports into `types/src/**`

If a type is reused or exported, it belongs in `types/`.

# .cursor/rules/06-import-conventions.md

## Rule

- **No file extensions**: Never use `.js`, `.ts`, `.tsx`, or other file extensions in import statements.
- **No `src` in workspace imports**: Never import from a `src` directory when importing from a workspace package (e.g., use `@flwst/core`, not `@flwst/core/src/logger`).
- **Use package entry points**: Cross-package imports must always use the workspace package name (`@flwst/package-name`) or its defined subpath exports (e.g., `@flwst/core/logger`).
- **Relative imports**: Use clean relative imports without extensions (e.g., `import { foo } from './foo'`).

## Rationale

- The project uses `moduleResolution: "bundler"`, which allows omitting extensions.
- Clean imports make the code more readable and easier to refactor.
- Importing from `src` breaks the encapsulation of workspace packages and bypasses the defined `exports` in `package.json`.

## Examples

### Correct

```typescript
import { logger } from '@flwst/core';
import { someUtil } from './utils';
import type { Task } from '@flwst/types';
```

### Incorrect

```typescript
import { logger } from '@flwst/core/src/logger.js';
import { someUtil } from './utils.js';
import { Task } from '../../types/src/core.ts';
```

## Forbidden

- Any import statement containing `.js`, `.ts`, or `.tsx`.
- Any import statement containing `/src/` when the prefix is `@flwst/`.

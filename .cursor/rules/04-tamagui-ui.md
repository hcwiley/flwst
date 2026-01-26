# .cursor/rules/04-tamagui-ui.md

## Rule

- Always use Tamagui components for UI implementation when available.
- Prefer components from `@flwst/ui` if they exist as wrappers around Tamagui
  primitives.
- If a specific component is not yet in `@flwst/ui`, use the equivalent
  primitive from `tamagui` or `@tamagui/lucide-icons`.
- Avoid using standard HTML elements (like `div`, `span`, `button`) or basic
  React Native components (like `View`, `Text`, `TouchableOpacity`) directly in
  apps.

## Rationale

- Ensures consistent styling across platforms (Electron and Mobile).
- Leverages the design system tokens defined in `@flwst/ui`.
- Maintains a single source of truth for UI components.

## Forbidden

- Direct use of HTML elements (`div`, `button`, etc.) for UI components.
- Direct use of base React Native components (`View`, `Text`, etc.) when Tamagui
  equivalents exist.
- Hardcoded styles or colors that bypass Tamagui tokens.

/**
 * AppCard - shared card container for list items (e.g. Kanban task cards).
 * Slightly stronger border than Panel; tighter padding for dense content.
 */

import { YStack } from 'tamagui';
import type { YStackProps } from 'tamagui';

export interface AppCardProps extends YStackProps {
  /** Card content. */
  children?: React.ReactNode;
}

const defaultProps = {
  backgroundColor: '$background',
  borderWidth: 1,
  borderColor: '$gray5',
  borderRadius: '$3',
  padding: '$2',
  gap: '$1',
} as const;

/**
 * AppCard wrapper: token-driven card with consistent styling.
 * Accepts all YStack props for overrides.
 */
export function AppCard({
  children,
  ...rest
}: AppCardProps): React.JSX.Element {
  return (
    <YStack
      {...defaultProps}
      {...rest}
    >
      {children}
    </YStack>
  );
}

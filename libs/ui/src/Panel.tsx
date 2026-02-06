/**
 * Panel - shared container for app sections.
 * Subtle background, 1px border, medium radius, consistent padding and gap.
 * Use for Inbox, Kanban board, Kanban columns, Settings rail content.
 */

import { YStack } from 'tamagui';
import type { YStackProps } from 'tamagui';

export interface PanelProps extends YStackProps {
  /** Panel content. */
  children?: React.ReactNode;
}

const defaultProps = {
  backgroundColor: '$gray2',
  borderWidth: 1,
  borderColor: '$gray4',
  borderRadius: '$4',
  padding: '$3',
  gap: '$3',
} as const;

/**
 * Panel wrapper: token-driven container with consistent styling.
 * Accepts all YStack props for overrides.
 */
export function Panel({ children, ...rest }: PanelProps): React.JSX.Element {
  return (
    <YStack
      {...defaultProps}
      {...rest}
    >
      {children}
    </YStack>
  );
}

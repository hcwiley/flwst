/**
 * Toolbar - horizontal stack wrapper for control surfaces.
 * Used for Kanban board header (sort + column visibility).
 * Wraps to second row on narrow widths.
 */

import { XStack } from 'tamagui';
import type { XStackProps } from 'tamagui';

export interface ToolbarProps extends XStackProps {
  /** Toolbar content (buttons, selects, etc.). */
  children?: React.ReactNode;
}

const defaultProps = {
  gap: '$2',
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '$2',
} as const;

/**
 * Toolbar wrapper: horizontal layout with consistent gap and wrap.
 */
export function Toolbar({
  children,
  ...rest
}: ToolbarProps): React.JSX.Element {
  return (
    <XStack
      {...defaultProps}
      {...rest}
    >
      {children}
    </XStack>
  );
}

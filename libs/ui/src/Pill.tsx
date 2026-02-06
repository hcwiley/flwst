/**
 * Pill - compact badge for tags, source labels, counts.
 * Token-driven; supports bg/color overrides for semantic variants (e.g. Notion vs Pending).
 */

import { Text, XStack } from 'tamagui';
import type { StackProps } from 'tamagui';

export interface PillProps extends Omit<StackProps, 'children'> {
  /** Label text shown inside the pill. */
  label: string;
  /** Optional background token override (e.g. $blue4, $yellow4). */
  bg?: string;
  /** Optional text color token override (e.g. $blue11, $yellow11). */
  color?: string;
}

const defaultProps = {
  paddingHorizontal: '$2',
  paddingVertical: '$1',
  borderRadius: '$10',
  backgroundColor: '$gray4',
} as const;

/**
 * Pill/badge component for tags, counts, and status labels.
 */
export function Pill({
  label,
  bg,
  color,
  ...rest
}: PillProps): React.JSX.Element {
  return (
    <XStack
      {...defaultProps}
      backgroundColor={bg ?? defaultProps.backgroundColor}
      {...rest}
    >
      <Text
        fontSize='$1'
        fontWeight='600'
        color={color ?? '$gray11'}
      >
        {label}
      </Text>
    </XStack>
  );
}

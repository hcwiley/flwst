/**
 * Shared typography components - token-driven text variants.
 * H1/H2 for titles and section headers; MetaText for metadata; BodyText for body.
 */

import { Text } from 'tamagui';
import type { TextProps } from 'tamagui';

export interface H1Props extends TextProps {
  children?: React.ReactNode;
}

/** Page/section title - largest heading. */
export function H1({ children, ...rest }: H1Props): React.JSX.Element {
  return (
    <Text
      fontSize='$8'
      fontWeight='bold'
      {...rest}
    >
      {children}
    </Text>
  );
}

export interface H2Props extends TextProps {
  children?: React.ReactNode;
}

/** Section heading - medium emphasis. */
export function H2({ children, ...rest }: H2Props): React.JSX.Element {
  return (
    <Text
      fontSize='$6'
      fontWeight='600'
      {...rest}
    >
      {children}
    </Text>
  );
}

export interface MetaTextProps extends TextProps {
  children?: React.ReactNode;
}

/** Muted metadata - timestamps, labels, secondary info. */
export function MetaText({
  children,
  ...rest
}: MetaTextProps): React.JSX.Element {
  return (
    <Text
      fontSize='$2'
      color='$gray10'
      {...rest}
    >
      {children}
    </Text>
  );
}

export interface BodyTextProps extends TextProps {
  children?: React.ReactNode;
}

/** Body copy - default readable size. */
export function BodyText({
  children,
  ...rest
}: BodyTextProps): React.JSX.Element {
  return (
    <Text
      fontSize='$3'
      color='$color'
      {...rest}
    >
      {children}
    </Text>
  );
}

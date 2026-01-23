/**
 * System selection screen.
 * User chooses Notion, JIRA (CTA), or Other system.
 */

import { Stack, Text, Button } from 'tamagui';

export interface SystemSelectScreenProps {
  onSelect: (system: 'notion' | 'jira' | 'other') => void;
}

export function SystemSelectScreen({
  onSelect,
}: SystemSelectScreenProps): React.JSX.Element {
  return (
    <Stack
      flexDirection='column'
      flex={1}
      padding='$6'
      alignItems='center'
      justifyContent='center'
      gap='$4'
    >
      <Text
        fontSize='$8'
        fontWeight='bold'
        textAlign='center'
      >
        Choose Your To-Do System
      </Text>
      <Text
        fontSize='$4'
        textAlign='center'
        maxWidth={500}
        opacity={0.8}
      >
        Select the system you want to use with FlowState
      </Text>
      <Stack
        flexDirection='column'
        gap='$3'
        marginTop='$4'
        width='100%'
        maxWidth={400}
      >
        <Button
          onPress={() => onSelect('notion')}
          theme='active'
          size='$4'
          width='100%'
        >
          Notion
        </Button>
        <Button
          onPress={() => onSelect('jira')}
          theme='blue'
          size='$4'
          width='100%'
        >
          JIRA (Coming Soon)
        </Button>
        <Button
          onPress={() => onSelect('other')}
          theme='gray'
          size='$4'
          width='100%'
        >
          Other System
        </Button>
      </Stack>
    </Stack>
  );
}

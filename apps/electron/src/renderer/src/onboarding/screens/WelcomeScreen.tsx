/**
 * Welcome screen - first step of onboarding.
 * Explains flwst and previews Inbox + Kanban.
 */

import { Stack, Text, Button } from 'tamagui';

export interface WelcomeScreenProps {
  onNext: () => void;
}

export function WelcomeScreen({
  onNext,
}: WelcomeScreenProps): React.JSX.Element {
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
        fontSize='$10'
        fontWeight='bold'
        textAlign='center'
      >
        Welcome to flwst
      </Text>
      <Text
        fontSize='$5'
        textAlign='center'
        maxWidth={600}
        opacity={0.8}
      >
        flwst (flow state) helps you capture your thoughts, process them with
        AI, and organize your work in Notion. Get started by connecting your
        workspace.
      </Text>
      <Stack
        flexDirection='row'
        gap='$4'
        marginTop='$4'
      >
        <Button
          onPress={onNext}
          theme='active'
          size='$4'
        >
          Get Started
        </Button>
      </Stack>
    </Stack>
  );
}

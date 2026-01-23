/**
 * Notion OAuth complete screen.
 * Shows OAuth result and proceeds to next step.
 */

import { Stack, Text, Button } from 'tamagui';

export interface NotionOAuthCompleteScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export function NotionOAuthCompleteScreen({
  onNext,
  onBack,
}: NotionOAuthCompleteScreenProps): React.JSX.Element {
  // In real implementation, this screen would be shown after OAuth callback
  // For now, it's a confirmation screen
  // The OAuth result should be stored via window.api.notion.storeOAuthResult()
  // which updates the state to 'authed'

  return (
    <Stack
      flexDirection='column'
      flex={1}
      padding='$6'
      gap='$4'
      alignItems='center'
      justifyContent='center'
      maxWidth={500}
      alignSelf='center'
      width='100%'
    >
      <Text
        fontSize='$8'
        fontWeight='bold'
        textAlign='center'
      >
        Notion Connected
      </Text>
      <Text
        fontSize='$4'
        textAlign='center'
        opacity={0.8}
      >
        Your Notion workspace has been successfully connected. Now let's set up
        where FlowState will create your pages and databases.
      </Text>
      <Stack
        flexDirection='row'
        gap='$3'
        marginTop='$4'
        width='100%'
      >
        <Button
          onPress={onBack}
          theme='gray'
          size='$4'
          flex={1}
        >
          Back
        </Button>
        <Button
          onPress={onNext}
          theme='active'
          size='$4'
          flex={1}
        >
          Continue
        </Button>
      </Stack>
    </Stack>
  );
}

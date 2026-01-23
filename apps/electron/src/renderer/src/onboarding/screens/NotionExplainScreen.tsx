/**
 * Notion pre-OAuth explanation screen.
 * Shows what will be created before user authorizes.
 */

import { Stack, Text, Button } from 'tamagui';

export interface NotionExplainScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export function NotionExplainScreen({
  onNext,
  onBack,
}: NotionExplainScreenProps): React.JSX.Element {
  return (
    <Stack
      flexDirection='column'
      flex={1}
      padding='$6'
      gap='$4'
      maxWidth={600}
      alignSelf='center'
      width='100%'
    >
      <Text
        fontSize='$8'
        fontWeight='bold'
      >
        Connect Notion
      </Text>
      <Text
        fontSize='$4'
        opacity={0.8}
      >
        FlowState will create the following in your Notion workspace:
      </Text>
      <Stack
        gap='$3'
        marginTop='$2'
        padding='$4'
        backgroundColor='$backgroundHover'
        borderRadius='$4'
      >
        <Text fontSize='$3'>• Flow State page (parent container)</Text>
        <Text fontSize='$3'>• Daily Notes database</Text>
        <Text fontSize='$3'>• To-Dos database</Text>
      </Stack>
      <Text
        fontSize='$3'
        opacity={0.7}
        marginTop='$2'
      >
        You'll be able to choose where these are created in the next step.
      </Text>
      <Stack
        flexDirection='row'
        gap='$3'
        marginTop='$4'
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

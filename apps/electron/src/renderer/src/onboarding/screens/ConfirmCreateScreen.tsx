/**
 * Confirmation screen before creating resources.
 * Shows what will be created and asks for confirmation.
 */

import { Stack, Text, Button } from 'tamagui';

export interface ConfirmCreateScreenProps {
  parentPageId: string;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmCreateScreen({
  parentPageId,
  onConfirm,
  onBack,
}: ConfirmCreateScreenProps): React.JSX.Element {
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
        Confirm Creation
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
        <Text fontSize='$3'>• Flow State page</Text>
        <Text fontSize='$3'>• Daily Notes database</Text>
        <Text fontSize='$3'>• To-Dos database</Text>
      </Stack>
      <Text
        fontSize='$3'
        opacity={0.7}
        marginTop='$2'
      >
        Parent page: {parentPageId}
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
          onPress={onConfirm}
          theme='active'
          size='$4'
          flex={1}
        >
          Create Resources
        </Button>
      </Stack>
    </Stack>
  );
}

/**
 * Parent page selection screen.
 * User selects where to create FlowState resources.
 */

import { Stack, Text, Button, Input } from 'tamagui';
import { useState } from 'react';

export interface ParentSelectScreenProps {
  onNext: (parentPageId: string) => void;
  onBack: () => void;
}

export function ParentSelectScreen({
  onNext,
  onBack,
}: ParentSelectScreenProps): React.JSX.Element {
  const [parentPageId, setParentPageId] = useState('');

  const handleNext = (): void => {
    if (parentPageId.trim()) {
      onNext(parentPageId.trim());
    }
  };

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
        Select Parent Page
      </Text>
      <Text
        fontSize='$4'
        opacity={0.8}
      >
        Choose the Notion page where FlowState will create the Flow State page,
        Daily Notes database, and To-Dos database.
      </Text>
      <Stack
        gap='$3'
        marginTop='$2'
      >
        <Stack gap='$2'>
          <Text
            fontSize='$3'
            fontWeight='600'
          >
            Parent Page ID
          </Text>
          <Input
            value={parentPageId}
            onChangeText={setParentPageId}
            placeholder='Enter Notion page ID'
            size='$4'
          />
          <Text
            fontSize='$2'
            opacity={0.6}
          >
            You can find the page ID in the Notion page URL.
          </Text>
        </Stack>
      </Stack>
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
          onPress={handleNext}
          theme='active'
          size='$4'
          flex={1}
          disabled={!parentPageId.trim()}
        >
          Continue
        </Button>
      </Stack>
    </Stack>
  );
}

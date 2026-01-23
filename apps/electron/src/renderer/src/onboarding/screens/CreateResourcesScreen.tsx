/**
 * Create resources screen.
 * Shows progress while creating Notion resources.
 */

import { Stack, Text, Button, Spinner } from 'tamagui';
import { useState, useEffect } from 'react';

export interface CreateResourcesScreenProps {
  parentPageId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function CreateResourcesScreen({
  parentPageId,
  onComplete,
  onBack,
}: CreateResourcesScreenProps): React.JSX.Element {
  const [isCreating, setIsCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createResources = async (): Promise<void> => {
      try {
        await window.api.notion.createResources({ parentPageId });
        setIsCreating(false);
        // State is updated by the IPC handler, so we just need to complete
        // Auto-advance after a short delay
        setTimeout(() => {
          onComplete();
        }, 1000);
      } catch (err) {
        console.error('Failed to create resources:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsCreating(false);
      }
    };
    createResources();
  }, [parentPageId, onComplete]);

  if (error) {
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
        <Text fontSize='$8' fontWeight='bold' textAlign='center' color='$red10'>
          Error
        </Text>
        <Text fontSize='$4' textAlign='center' opacity={0.8}>
          {error}
        </Text>
        <Stack flexDirection='row' gap='$3' marginTop='$4' width='100%'>
          <Button onPress={onBack} theme='gray' size='$4' flex={1}>
            Back
          </Button>
          <Button
            onPress={() => {
              setError(null);
              setIsCreating(true);
            }}
            theme='active'
            size='$4'
            flex={1}
          >
            Retry
          </Button>
        </Stack>
      </Stack>
    );
  }

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
      {isCreating ? (
        <>
          <Spinner size='large' />
          <Text fontSize='$6' fontWeight='bold' textAlign='center'>
            Creating Resources
          </Text>
          <Text fontSize='$4' textAlign='center' opacity={0.8}>
            Setting up your Notion workspace...
          </Text>
        </>
      ) : (
        <>
          <Text fontSize='$8' fontWeight='bold' textAlign='center'>
            Success!
          </Text>
          <Text fontSize='$4' textAlign='center' opacity={0.8}>
            Your Notion workspace has been set up successfully.
          </Text>
        </>
      )}
    </Stack>
  );
}

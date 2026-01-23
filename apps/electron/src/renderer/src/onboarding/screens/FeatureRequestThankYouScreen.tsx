/**
 * Thank you screen shown after feature request submission.
 * Redirects back to system selection.
 */

import { Stack, Text, Button } from 'tamagui';

export interface FeatureRequestThankYouScreenProps {
  onContinue: () => void;
}

export function FeatureRequestThankYouScreen({
  onContinue,
}: FeatureRequestThankYouScreenProps): React.JSX.Element {
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
      <Text fontSize='$8' fontWeight='bold' textAlign='center'>
        Thank You!
      </Text>
      <Text fontSize='$4' textAlign='center' opacity={0.8}>
        Your feature request has been submitted. We'll review it and prioritize
        accordingly.
      </Text>
      <Text fontSize='$4' textAlign='center' opacity={0.8} marginTop='$2'>
        To use FlowState now, please set up Notion integration.
      </Text>
      <Stack flexDirection='row' gap='$3' marginTop='$4' width='100%'>
        <Button onPress={onContinue} theme='active' size='$4' flex={1}>
          Set Up Notion
        </Button>
      </Stack>
    </Stack>
  );
}

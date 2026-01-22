/**
 * Main content pane component.
 * Placeholder for future main content areas.
 */

import { Stack, Text, Button } from 'tamagui';
import { getLogger } from '../../sentry';

export function MainPane(): React.JSX.Element {
  const testSentry = async () => {
    // Test Sentry by triggering an error
    try {
      // Dynamic import to test Sentry error capture
      const sentry = await import('@sentry/electron/renderer');
      sentry.captureException(
        new Error('Test error from FlowState - Sentry is working!'),
      );
      getLogger().info('Sentry test error sent - check your Sentry dashboard');
    } catch (err) {
      getLogger().error('Failed to send Sentry test error', { error: err });
    }
  };

  return (
    <Stack
      flexDirection='column'
      flex={1}
      padding='$4'
      backgroundColor='$background'
    >
      <Text
        fontSize='$8'
        fontWeight='bold'
        marginBottom='$2'
      >
        Welcome to FlowState
      </Text>
      <Text
        fontSize='$4'
        color='$color'
        opacity={0.8}
        marginBottom='$4'
      >
        Main content area placeholder
      </Text>
      <Button
        onPress={testSentry}
        backgroundColor='$blue10'
        color='white'
        padding='$3'
      >
        Test Sentry Error
      </Button>
    </Stack>
  );
}

/**
 * Notion OAuth start screen.
 * Initiates OAuth flow.
 */

import { Stack, Text, Button, Spinner } from 'tamagui';
import { useState, useEffect } from 'react';

export interface NotionOAuthStartScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export function NotionOAuthStartScreen({
  onNext,
  onBack,
}: NotionOAuthStartScreenProps): React.JSX.Element {
  const [isStarting, setIsStarting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    // Listen for OAuth completion event from main process
    const handleOAuthComplete = (
      _event: unknown,
      data: { success: boolean; error?: string },
    ): void => {
      if (data.success) {
        setIsWaiting(false);
        setIsStarting(false);
        onNext();
      } else {
        setIsWaiting(false);
        setIsStarting(false);
        console.error('OAuth failed:', data.error);
        // Error will be handled by the flow state machine
      }
    };

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on(
        'notion:oauthComplete',
        handleOAuthComplete,
      );

      return () => {
        window.electron.ipcRenderer.removeListener(
          'notion:oauthComplete',
          handleOAuthComplete,
        );
      };
    }
    return undefined;
  }, [onNext]);

  const handleStartOAuth = async (): Promise<void> => {
    setIsStarting(true);
    try {
      await window.api.notion.startOAuth();
      // OAuth started - now waiting for callback
      setIsStarting(false);
      setIsWaiting(true);
    } catch (error) {
      console.error('Failed to start OAuth:', error);
      setIsStarting(false);
      setIsWaiting(false);
      // Error handling will be done by the flow state machine
    }
  };

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
        Authorize Notion
      </Text>
      {isWaiting ? (
        <>
          <Spinner size='large' />
          <Text
            fontSize='$4'
            textAlign='center'
            opacity={0.8}
          >
            Waiting for authorization... Please complete the authorization in
            your browser.
          </Text>
        </>
      ) : (
        <>
          <Text
            fontSize='$4'
            textAlign='center'
            opacity={0.8}
          >
            Click the button below to open Notion and authorize FlowState to
            access your workspace.
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
              disabled={isStarting}
            >
              Back
            </Button>
            <Button
              onPress={handleStartOAuth}
              theme='active'
              size='$4'
              flex={1}
              disabled={isStarting}
            >
              {isStarting ? <Spinner size='small' /> : 'Authorize Notion'}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}

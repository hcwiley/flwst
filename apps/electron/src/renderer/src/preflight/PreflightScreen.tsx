/**
 * Preflight permissions screen.
 * Explains to users what permissions the app needs before triggering OS prompts.
 */

import { useEffect, useState } from 'react';
import { Stack, Text, Button, Spinner, Card, XStack, YStack } from 'tamagui';

interface PreflightPermission {
  id: string;
  name: string;
  description: string;
  required: boolean;
  status: 'pending' | 'granted' | 'denied' | 'not_applicable';
}

export interface PreflightScreenProps {
  onComplete: () => void;
}

/** Simple emoji icons for permissions */
const PERMISSION_ICONS: Record<string, string> = {
  keychain: '🔐',
  microphone: '🎤',
};

export function PreflightScreen({
  onComplete,
}: PreflightScreenProps): React.JSX.Element {
  const [permissions, setPermissions] = useState<PreflightPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPermissions(): Promise<void> {
      try {
        const perms = await window.api.preflight.getPermissions();
        setPermissions(perms);
      } catch {
        setError('Failed to load permissions');
      } finally {
        setLoading(false);
      }
    }
    void loadPermissions();
  }, []);

  async function handleContinue(): Promise<void> {
    setCompleting(true);
    setError(null);
    try {
      await window.api.preflight.complete();
      onComplete();
    } catch {
      setError('Failed to initialize. Please try again.');
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <Stack
        flex={1}
        alignItems='center'
        justifyContent='center'
      >
        <Spinner size='large' />
      </Stack>
    );
  }

  return (
    <Stack
      flexDirection='column'
      flex={1}
      padding='$6'
      alignItems='center'
      justifyContent='center'
      gap='$5'
    >
      <Stack
        alignItems='center'
        gap='$3'
      >
        <Text fontSize={48}>🛡️</Text>
        <Text
          fontSize='$9'
          fontWeight='bold'
          textAlign='center'
        >
          Before We Begin
        </Text>
        <Text
          fontSize='$4'
          textAlign='center'
          maxWidth={500}
          opacity={0.8}
        >
          FlowState needs a few permissions to keep your data secure and provide
          the best experience. Here's what we'll need:
        </Text>
      </Stack>

      <YStack
        gap='$3'
        width='100%'
        maxWidth={500}
      >
        {permissions.map((perm) => (
          <Card
            key={perm.id}
            padding='$4'
            bordered
            backgroundColor='$background'
          >
            <XStack
              gap='$3'
              alignItems='flex-start'
            >
              <Stack
                padding='$2'
                backgroundColor='$blue4'
                borderRadius='$3'
              >
                <Text fontSize={24}>{PERMISSION_ICONS[perm.id] || '🔒'}</Text>
              </Stack>
              <YStack
                flex={1}
                gap='$1'
              >
                <XStack
                  alignItems='center'
                  gap='$2'
                >
                  <Text
                    fontWeight='600'
                    fontSize='$4'
                  >
                    {perm.name}
                  </Text>
                  {perm.required && (
                    <Text
                      fontSize='$2'
                      color='$blue10'
                    >
                      Required
                    </Text>
                  )}
                  {!perm.required && (
                    <Text
                      fontSize='$2'
                      opacity={0.6}
                    >
                      Optional
                    </Text>
                  )}
                </XStack>
                <Text
                  fontSize='$3'
                  opacity={0.7}
                >
                  {perm.description}
                </Text>
              </YStack>
            </XStack>
          </Card>
        ))}
      </YStack>

      <YStack
        gap='$2'
        alignItems='center'
        marginTop='$2'
      >
        <Text
          fontSize='$3'
          opacity={0.6}
          textAlign='center'
          maxWidth={400}
        >
          When you click Continue, you may see a system prompt asking for your
          password. This is your Mac verifying it's really you.
        </Text>

        {error && (
          <Text
            color='$red10'
            fontSize='$3'
          >
            {error}
          </Text>
        )}

        <Button
          onPress={handleContinue}
          theme='active'
          size='$4'
          marginTop='$3'
          disabled={completing}
          icon={completing ? <Spinner size='small' /> : undefined}
        >
          {completing ? 'Initializing...' : 'Continue'}
        </Button>
      </YStack>
    </Stack>
  );
}

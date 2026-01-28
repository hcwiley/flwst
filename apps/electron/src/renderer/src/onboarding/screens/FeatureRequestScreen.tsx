/**
 * Feature request screen for JIRA/Other systems.
 * Collects use case, team size, urgency, and notes.
 */

import { Stack, Text, Button, Input, TextArea } from 'tamagui';
import { useState } from 'react';
import type { FeatureRequestPayload } from '@flwst/types';

export interface FeatureRequestScreenProps {
  system: 'jira' | 'other';
  onSubmit: (payload: FeatureRequestPayload[]) => void;
  onBack: () => void;
}

export function FeatureRequestScreen({
  system,
  onSubmit,
  onBack,
}: FeatureRequestScreenProps): React.JSX.Element {
  const [notes, setNotes] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [urgency, setUrgency] = useState('');

  const handleSubmit = (): void => {
    const payload: FeatureRequestPayload[] = [
      {
        system: system === 'jira' ? 'JIRA' : 'Other',
        notes: notes || undefined,
        teamSize: teamSize || undefined,
        urgency: urgency || undefined,
        submittedAt: new Date().toISOString(),
      },
    ];
    onSubmit(payload);
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
        Request {system === 'jira' ? 'JIRA' : 'System'} Integration
      </Text>
      <Text
        fontSize='$4'
        opacity={0.8}
      >
        Help us prioritize this integration by sharing your use case.
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
            Team Size
          </Text>
          <Input
            value={teamSize}
            onChangeText={setTeamSize}
            placeholder='e.g., 5-10 people'
            size='$4'
          />
        </Stack>
        <Stack gap='$2'>
          <Text
            fontSize='$3'
            fontWeight='600'
          >
            Urgency
          </Text>
          <Input
            value={urgency}
            onChangeText={setUrgency}
            placeholder='e.g., High, Medium, Low'
            size='$4'
          />
        </Stack>
        <Stack gap='$2'>
          <Text
            fontSize='$3'
            fontWeight='600'
          >
            Notes / Use Case
          </Text>
          <TextArea
            value={notes}
            onChangeText={setNotes}
            placeholder='Describe how you would use this integration...'
            size='$4'
            minHeight={120}
          />
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
          onPress={handleSubmit}
          theme='active'
          size='$4'
          flex={1}
        >
          Submit Request
        </Button>
      </Stack>
    </Stack>
  );
}

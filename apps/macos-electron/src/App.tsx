import { useState } from 'react';
import { YStack, XStack, TextArea, Button, Text, ScrollView, Spinner } from 'tamagui';
import { DailyNoteResponse } from '@flwst/types/src/api/reasoning';

function App() {
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DailyNoteResponse | null>(null);

  const handleProcess = async () => {
    if (!transcript.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        throw new Error('Failed to process transcript');
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <YStack f={1} bg="$background" p="$4" gap="$4">
      <Text fontSize="$6" fontWeight="bold">
        flwst
      </Text>

      <XStack gap="$4" f={1}>
        <YStack f={1} gap="$4">
          <Text fontSize="$4">Input Transcript</Text>
          <TextArea
            f={1}
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Paste your transcript here..."
            bg="$backgroundHover"
          />
          <Button onPress={handleProcess} disabled={isLoading || !transcript.trim()} themeInverse>
            {isLoading ? <Spinner /> : 'Process'}
          </Button>
        </YStack>

        <YStack f={1} gap="$4" blw={1} blc="$borderColor" pl="$4">
          <Text fontSize="$4">Result</Text>
          <ScrollView f={1}>
            {result ? (
              <YStack gap="$4">
                <YStack gap="$2">
                  <Text fontWeight="bold">Daily Note</Text>
                  <Text>{result.dailyNoteRichMarkdown}</Text>
                </YStack>

                <YStack gap="$2">
                  <Text fontWeight="bold">Todos</Text>
                  {result.todos.map((todo: { id: string; text: string; completed: boolean }) => (
                    <XStack key={todo.id} ai="center" gap="$2">
                      <Text>{todo.completed ? '✅' : '⬜'}</Text>
                      <Text>{todo.text}</Text>
                    </XStack>
                  ))}
                </YStack>
              </YStack>
            ) : (
              <Text color="$color.gray10">Processed results will appear here</Text>
            )}
          </ScrollView>
        </YStack>
      </XStack>
    </YStack>
  );
}

export default App;

/**
 * Daily note preview panel with markdown rendering and loading/error states.
 */

import { ScrollView, Stack, Text, useTheme } from 'tamagui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DailyNotePreviewProps {
  markdown: string;
  isLoading: boolean;
  loadError: string | null;
}

export function DailyNotePreview({
  markdown,
  isLoading,
  loadError,
}: DailyNotePreviewProps): React.JSX.Element {
  const theme = useTheme();
  const markdownColor = theme.color?.get() ?? 'inherit';

  return (
    <Stack
      flex={1}
      flexGrow={0}
      flexShrink={1}
      borderWidth={1}
      borderColor='$gray4'
      borderRadius='$4'
      backgroundColor='$gray1'
      padding='$3'
      overflow='scroll'
    >
      <ScrollView>
        {isLoading ? (
          <Text opacity={0.7}>Loading daily note…</Text>
        ) : loadError ? (
          <Text color='$red10'>{loadError}</Text>
        ) : (
          <Stack
            className='markdown-preview'
            style={{ color: markdownColor }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </Stack>
        )}
      </ScrollView>
    </Stack>
  );
}

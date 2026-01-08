import { YStack, Text, Paragraph, Heading } from 'tamagui';

interface MarkdownProps {
  content: string;
}

export const Markdown = ({ content }: MarkdownProps) => {
  // Simple regex-based parsing for basic markdown
  const lines = content.split('\n');

  return (
    <YStack gap="$1">
      {lines.map((line, index) => {
        // Headings
        if (line.startsWith('### ')) {
          return (
            <Heading key={index} size="$4" mt="$2">
              {line.replace('### ', '')}
            </Heading>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Heading key={index} size="$5" mt="$3">
              {line.replace('## ', '')}
            </Heading>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <Heading key={index} size="$6" mt="$4">
              {line.replace('# ', '')}
            </Heading>
          );
        }

        // Bullet points
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          const text = line.trim().substring(2);
          return (
            <Text key={index} ml="$4" color="$color">
              • {renderFormattedText(text)}
            </Text>
          );
        }

        // Empty lines
        if (!line.trim()) {
          return <YStack key={index} height="$2" />;
        }

        // Regular paragraph
        return (
          <Paragraph key={index} color="$color">
            {renderFormattedText(line)}
          </Paragraph>
        );
      })}
    </YStack>
  );
};

// Helper to handle bold/italic in a line
function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} fontWeight="bold">
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <Text key={i} fontStyle="italic">
          {part.slice(1, -1)}
        </Text>
      );
    }
    return part;
  });
}

import { Card, YStack, XStack, Text, Button } from 'tamagui';
import { Todo } from '@flwst/types/api/reasoning';

interface TodoCardProps {
  todo: Todo;
  isMatching?: boolean; // Whether Notion matching is in progress
}

/**
 * Get color for priority badge
 */
function getPriorityColor(priority?: string): string {
  switch (priority) {
    case 'TOP':
      return '$red10';
    case 'High':
      return '$orange10';
    case 'Medium':
      return '$yellow10';
    case 'Low':
      return '$gray10';
    case 'Back burner':
      return '$gray8';
    default:
      return '$gray10';
  }
}

/**
 * Get color for status badge
 */
function getStatusColor(status?: string): string {
  switch (status) {
    case 'TODO':
      return '$gray10';
    case 'On Deck':
      return '$blue10';
    case 'In Progress':
      return '$blue10';
    case 'BLOCKED':
      return '$red10';
    case 'Done':
      return '$green10';
    case 'Cancelled':
      return '$gray8';
    default:
      return '$gray10';
  }
}

/**
 * Format date string for display
 */
function formatDate(dateString?: string): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Rich TodoCard component displaying all task properties
 * Shows visual distinction between new todos (from LLM) and matched todos (from Notion)
 */
export function TodoCard({ todo, isMatching = false }: TodoCardProps) {
  const handleNotionLink = () => {
    if (todo.notionUrl) {
      window.open(todo.notionUrl, '_blank');
    }
  };

  // Determine if this is a new todo (from LLM) or matched (from Notion)
  const isNewTodo = !todo.isMatched && !todo.notionUrl;
  const isMatchedTodo = todo.isMatched && todo.notionUrl;

  // Border color based on todo type
  const borderColor = isMatchedTodo
    ? '$green8' // Green border for matched todos
    : isNewTodo
      ? '$blue8' // Blue border for new todos
      : '$borderColor'; // Default for unmatched but processed

  return (
    <Card
      elevate
      bordered
      padding="$3"
      backgroundColor="$background"
      borderColor={borderColor}
      borderWidth={isMatchedTodo || isNewTodo ? 2 : 1}
    >
      <YStack gap="$2">
        {/* Header: Task name with type indicator */}
        <XStack ai="center" jc="space-between" gap="$2">
          <XStack ai="center" gap="$2" flex={1}>
            <Text fontSize="$2" color="$color.gray10" fontWeight="bold">
              #{todo.id}
            </Text>
            <Text fontSize="$5" fontWeight="bold" flex={1}>
              {todo.text}
            </Text>
            {/* Type indicator badge */}
            {isMatchedTodo && (
              <XStack
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                backgroundColor="$green5"
              >
                <Text fontSize="$1" color="$green11" fontWeight="600">
                  Matched
                </Text>
              </XStack>
            )}
            {isNewTodo && (
              <XStack
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                backgroundColor="$blue5"
              >
                <Text fontSize="$1" color="$blue11" fontWeight="600">
                  New
                </Text>
              </XStack>
            )}
          </XStack>
          <XStack ai="center" gap="$2">
            {isMatching && !todo.isMatched && (
              <Text fontSize="$2" color="$color.gray10" fontStyle="italic">
                Matching...
              </Text>
            )}
            {todo.completed && <Text fontSize="$4">✅</Text>}
          </XStack>
        </XStack>

        {/* Description if present and different from text */}
        {todo.description && todo.description !== todo.text && (
          <Text fontSize="$3" color="$color.gray11">
            {todo.description}
          </Text>
        )}

        {/* Status and Priority badges - always shown */}
        <XStack gap="$2" flexWrap="wrap">
          <XStack
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$2"
            backgroundColor={todo.status ? getStatusColor(todo.status) : '$gray5'}
          >
            <Text color={todo.status ? 'white' : '$gray11'} fontSize="$2" fontWeight="600">
              {todo.status || 'Status: Not set'}
            </Text>
          </XStack>
          <XStack
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$2"
            backgroundColor={todo.priority ? getPriorityColor(todo.priority) : '$gray5'}
          >
            <Text color={todo.priority ? 'white' : '$gray11'} fontSize="$2" fontWeight="600">
              {todo.priority || 'Priority: Not set'}
            </Text>
          </XStack>
        </XStack>

        {/* Project, Due Date, Assignee row - always shown */}
        <XStack gap="$3" flexWrap="wrap" ai="center">
          <XStack ai="center" gap="$1">
            <Text fontSize="$2" color="$color.gray11">
              Project:
            </Text>
            {todo.project ? (
              <XStack
                paddingHorizontal="$1.5"
                paddingVertical="$0.5"
                borderRadius="$2"
                backgroundColor="$blue5"
              >
                <Text fontSize="$1" color="$blue11" fontWeight="500">
                  {todo.project}
                </Text>
              </XStack>
            ) : (
              <Text fontSize="$2" color="$color.gray8" fontStyle="italic">
                Not set
              </Text>
            )}
          </XStack>

          <XStack ai="center" gap="$1">
            <Text fontSize="$2" color="$color.gray11">
              📅
            </Text>
            {todo.dueDate ? (
              <Text fontSize="$2" color="$color.gray11">
                {formatDate(todo.dueDate)}
              </Text>
            ) : (
              <Text fontSize="$2" color="$color.gray8" fontStyle="italic">
                Not set
              </Text>
            )}
          </XStack>

          {todo.assignee && (
            <XStack ai="center" gap="$1">
              <Text fontSize="$2" color="$color.gray11">
                👤
              </Text>
              <Text fontSize="$2" color="$color.gray11">
                {todo.assignee}
              </Text>
            </XStack>
          )}
        </XStack>

        {/* Tags */}
        {todo.tags && todo.tags.length > 0 && (
          <XStack gap="$1" flexWrap="wrap">
            {todo.tags.map((tag, index) => (
              <XStack
                key={index}
                paddingHorizontal="$1.5"
                paddingVertical="$0.5"
                borderRadius="$2"
                backgroundColor="$gray5"
              >
                <Text fontSize="$1" color="$gray11" fontWeight="500">
                  {tag}
                </Text>
              </XStack>
            ))}
          </XStack>
        )}

        {/* Notion link - only show if matched */}
        {todo.notionUrl && (
          <XStack ai="center" gap="$1">
            <Button
              size="$2"
              variant="outlined"
              onPress={handleNotionLink}
              backgroundColor={isMatchedTodo ? '$green3' : '$blue3'}
              color={isMatchedTodo ? '$green11' : '$blue11'}
            >
              View in Notion
            </Button>
          </XStack>
        )}
      </YStack>
    </Card>
  );
}

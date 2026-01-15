/**
 * Draft todo card for session editing.
 *
 * Renders match state, editable fields, and per-item submit controls for
 * the session-owned todo drafts in the renderer store.
 */
import { useState, useEffect, useRef } from 'react';
import { Card, YStack, XStack, Text, Button, Input } from 'tamagui';
import type { NotionSelectOption, TodoDraft } from '@flwst/types/src/api/reasoning';

interface TodoCardProps {
  todo: TodoDraft;
  projectOptions: NotionSelectOption[];
  statusOptions: NotionSelectOption[];
  onUpdate?: (localId: string, updates: Partial<TodoDraft>) => void;
  onSubmitOne?: (localId: string) => void;
}

// Valid status values
const DEFAULT_STATUS_OPTIONS: Array<TodoDraft['status']> = [
  'TODO',
  'On Deck',
  'In Progress',
  'BLOCKED',
  'Done',
  'Cancelled',
];

// Valid priority values
const PRIORITY_OPTIONS: Array<TodoDraft['priority']> = [
  'TOP',
  'High',
  'Medium',
  'Low',
  'Back burner',
];

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
 * Rich TodoCard component displaying all task properties
 * Shows visual distinction between new todos (from LLM) and matched todos (from Notion)
 */
export function TodoCard({
  todo,
  projectOptions,
  statusOptions,
  onUpdate,
  onSubmitOne,
}: TodoCardProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedOutsideStatus = !statusRef.current || !statusRef.current.contains(target);
      const clickedOutsidePriority = !priorityRef.current || !priorityRef.current.contains(target);
      const clickedOutsideProject = !projectRef.current || !projectRef.current.contains(target);

      if (showStatusDropdown && clickedOutsideStatus) setShowStatusDropdown(false);
      if (showPriorityDropdown && clickedOutsidePriority) setShowPriorityDropdown(false);
      if (showProjectDropdown && clickedOutsideProject) setShowProjectDropdown(false);
    };

    if (showStatusDropdown || showPriorityDropdown || showProjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showStatusDropdown, showPriorityDropdown, showProjectDropdown]);

  const handleNotionLink = () => {
    if (todo.notionUrl) {
      if (window.shell?.openExternal) {
        void window.shell.openExternal(todo.notionUrl);
      } else {
        window.open(todo.notionUrl, '_blank');
      }
    }
  };

  const handleStatusSelect = (status: TodoDraft['status']) => {
    if (onUpdate) {
      onUpdate(todo.localId, { status });
    }
    setShowStatusDropdown(false);
  };

  const handlePrioritySelect = (priority: TodoDraft['priority']) => {
    if (onUpdate) {
      onUpdate(todo.localId, { priority });
    }
    setShowPriorityDropdown(false);
  };

  // Determine if this is a new todo (from LLM) or matched (from Notion)
  const isNewTodo = todo.matchState === 'new';
  const isMatchedTodo = todo.matchState === 'matched';
  const isAmbiguousTodo = todo.matchState === 'ambiguous';
  const isIgnoredTodo = todo.matchState === 'ignored';

  const statusChoices =
    statusOptions.length > 0
      ? statusOptions.map((option) => option.name as TodoDraft['status'])
      : DEFAULT_STATUS_OPTIONS;

  const projectChoices = projectOptions.map((option) => option.name);

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
              #{todo.localId}
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
            {isAmbiguousTodo && (
              <XStack
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                backgroundColor="$yellow5"
              >
                <Text fontSize="$1" color="$yellow11" fontWeight="600">
                  Ambiguous
                </Text>
              </XStack>
            )}
            {isIgnoredTodo && (
              <XStack
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                backgroundColor="$gray5"
              >
                <Text fontSize="$1" color="$gray11" fontWeight="600">
                  Ignored
                </Text>
              </XStack>
            )}
          </XStack>
          <XStack ai="center" gap="$2">
            {todo.completed && <Text fontSize="$4">✅</Text>}
          </XStack>
        </XStack>

        {/* Description if present and different from text */}
        {todo.description && todo.description !== todo.text && (
          <Text fontSize="$3" color="$color.gray11">
            {todo.description}
          </Text>
        )}

        {/* Status and Priority badges - always shown, clickable */}
        <XStack gap="$2" flexWrap="wrap" position="relative">
          {/* Status dropdown */}
          <YStack position="relative" ref={statusRef as any}>
            <XStack
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$2"
              backgroundColor={todo.status ? getStatusColor(todo.status) : '$gray5'}
              cursor="pointer"
              onPress={() => setShowStatusDropdown(!showStatusDropdown)}
              hoverStyle={{ opacity: 0.8 }}
            >
              <Text color={todo.status ? 'white' : '$gray11'} fontSize="$2" fontWeight="600">
                {todo.status || 'Status: Not set'}
              </Text>
            </XStack>
            {showStatusDropdown && (
              <YStack
                position="absolute"
                top="100%"
                left={0}
                mt="$1"
                bg="$background"
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$2"
                padding="$1"
                zIndex={1000}
                shadowColor="$shadowColor"
                shadowOffset={{ width: 0, height: 2 }}
                shadowOpacity={0.1}
                shadowRadius={4}
                minWidth={150}
              >
                {statusChoices.map((status) => (
                  <XStack
                    key={status}
                    paddingHorizontal="$2"
                    paddingVertical="$1.5"
                    borderRadius="$2"
                    backgroundColor={status === todo.status ? '$blue5' : 'transparent'}
                    onPress={() => handleStatusSelect(status)}
                    hoverStyle={{ backgroundColor: '$gray3' }}
                    cursor="pointer"
                  >
                    <Text
                      fontSize="$2"
                      fontWeight={status === todo.status ? '600' : '400'}
                      color={status === todo.status ? '$blue11' : '$color'}
                    >
                      {status}
                    </Text>
                  </XStack>
                ))}
                <XStack
                  paddingHorizontal="$2"
                  paddingVertical="$1.5"
                  borderRadius="$2"
                  onPress={() => handleStatusSelect(undefined)}
                  hoverStyle={{ backgroundColor: '$gray3' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" color="$gray10" fontStyle="italic">
                    Clear
                  </Text>
                </XStack>
              </YStack>
            )}
          </YStack>

          {/* Priority dropdown */}
          <YStack position="relative" ref={priorityRef as any}>
            <XStack
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$2"
              backgroundColor={todo.priority ? getPriorityColor(todo.priority) : '$gray5'}
              cursor="pointer"
              onPress={() => setShowPriorityDropdown(!showPriorityDropdown)}
              hoverStyle={{ opacity: 0.8 }}
            >
              <Text color={todo.priority ? 'white' : '$gray11'} fontSize="$2" fontWeight="600">
                {todo.priority || 'Priority: Not set'}
              </Text>
            </XStack>
            {showPriorityDropdown && (
              <YStack
                position="absolute"
                top="100%"
                left={0}
                mt="$1"
                bg="$background"
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$2"
                padding="$1"
                zIndex={1000}
                shadowColor="$shadowColor"
                shadowOffset={{ width: 0, height: 2 }}
                shadowOpacity={0.1}
                shadowRadius={4}
                minWidth={150}
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <XStack
                    key={priority}
                    paddingHorizontal="$2"
                    paddingVertical="$1.5"
                    borderRadius="$2"
                    backgroundColor={priority === todo.priority ? '$blue5' : 'transparent'}
                    onPress={() => handlePrioritySelect(priority)}
                    hoverStyle={{ backgroundColor: '$gray3' }}
                    cursor="pointer"
                  >
                    <Text
                      fontSize="$2"
                      fontWeight={priority === todo.priority ? '600' : '400'}
                      color={priority === todo.priority ? '$blue11' : '$color'}
                    >
                      {priority}
                    </Text>
                  </XStack>
                ))}
                <XStack
                  paddingHorizontal="$2"
                  paddingVertical="$1.5"
                  borderRadius="$2"
                  onPress={() => handlePrioritySelect(undefined)}
                  hoverStyle={{ backgroundColor: '$gray3' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" color="$gray10" fontStyle="italic">
                    Clear
                  </Text>
                </XStack>
              </YStack>
            )}
          </YStack>
        </XStack>

        {/* Project, Due Date, Assignee row - always shown */}
        <XStack gap="$3" flexWrap="wrap" ai="center">
          <YStack position="relative" ref={projectRef as any}>
            <XStack ai="center" gap="$1">
              <Text fontSize="$2" color="$color.gray11">
                Project:
              </Text>
              <Button
                size="$2"
                variant="outlined"
                onPress={() => setShowProjectDropdown(!showProjectDropdown)}
              >
                {todo.project || 'Not set'}
              </Button>
            </XStack>
            {showProjectDropdown && projectChoices.length > 0 && (
              <YStack
                position="absolute"
                top="100%"
                left={0}
                mt="$1"
                bg="$background"
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$2"
                padding="$1"
                zIndex={1000}
                minWidth={180}
              >
                {projectChoices.map((project) => (
                  <XStack
                    key={project}
                    paddingHorizontal="$2"
                    paddingVertical="$1.5"
                    borderRadius="$2"
                    backgroundColor={project === todo.project ? '$blue5' : 'transparent'}
                    onPress={() => {
                      if (onUpdate) onUpdate(todo.localId, { project });
                      setShowProjectDropdown(false);
                    }}
                    hoverStyle={{ backgroundColor: '$gray3' }}
                    cursor="pointer"
                  >
                    <Text
                      fontSize="$2"
                      fontWeight={project === todo.project ? '600' : '400'}
                      color={project === todo.project ? '$blue11' : '$color'}
                    >
                      {project}
                    </Text>
                  </XStack>
                ))}
                <XStack
                  paddingHorizontal="$2"
                  paddingVertical="$1.5"
                  borderRadius="$2"
                  onPress={() => {
                    if (onUpdate) onUpdate(todo.localId, { project: undefined });
                    setShowProjectDropdown(false);
                  }}
                  hoverStyle={{ backgroundColor: '$gray3' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" color="$gray10" fontStyle="italic">
                    Clear
                  </Text>
                </XStack>
              </YStack>
            )}
          </YStack>

          <XStack ai="center" gap="$1">
            <Text fontSize="$2" color="$color.gray11">
              📅
            </Text>
            <Input
              size="$2"
              value={todo.dueDate || ''}
              placeholder="YYYY-MM-DD"
              onChangeText={(value) => onUpdate?.(todo.localId, { dueDate: value || undefined })}
            />
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

        {/* Submit + include controls */}
        <XStack ai="center" jc="space-between" gap="$2">
          <Button
            size="$2"
            variant="outlined"
            onPress={() => onUpdate?.(todo.localId, { includeInSubmit: !todo.includeInSubmit })}
          >
            {todo.includeInSubmit ? 'Included' : 'Excluded'}
          </Button>
          <XStack ai="center" gap="$2">
            {todo.submitState === 'pending' && (
              <Text fontSize="$2" color="$color.gray10">
                Syncing...
              </Text>
            )}
            {todo.submitState === 'success' && (
              <Text fontSize="$2" color="$green11">
                Synced
              </Text>
            )}
            {todo.submitState === 'error' && (
              <Text fontSize="$2" color="$red10">
                Error
              </Text>
            )}
            <Button
              size="$2"
              theme="green"
              onPress={() => onSubmitOne?.(todo.localId)}
              disabled={todo.submitState === 'pending'}
            >
              Sync
            </Button>
          </XStack>
        </XStack>
      </YStack>
    </Card>
  );
}

# Testing Strategy for Notion Integration

## Issues to Fix

1. **Empty Query Error**: `notion-search` requires at least 1 character, but we're passing empty string
2. **No Test Coverage**: No tests for Notion matching logic, making it hard to validate without UI

## Proposed Solution

### Fix 1: Per-Todo Search Strategy

Instead of searching all tasks with an empty query, search for each todo individually using keywords extracted from the todo text. This is more efficient and matches the actual use case.

**Implementation Approach:**

- Extract 2-3 key words from each todo text (longest words, excluding common stop words)
- Search Notion for each todo using those keywords
- Combine and deduplicate results
- Then run matching logic

**Alternative (if we need all tasks):**

- Use a placeholder query like "task" or "\*" (if supported)
- Or implement a `listAllTasks()` method that uses a different Notion API endpoint

### Fix 2: Better Error Handling

- Validate query before calling Notion API
- Provide meaningful error messages
- Handle edge cases (no results, malformed responses)

## Testing Strategy

### 1. Unit Tests: Matching Logic (`matching.test.ts`)

**Purpose**: Test the pure matching functions without Notion API calls

**Test Cases:**

- `isSimilarTaskName()` - fuzzy name matching
  - Exact matches
  - Partial matches (one contains the other)
  - Word overlap (50% threshold)
  - Edge cases (empty strings, single words)
- `extractNotionTaskProperties()` - property extraction
  - Different Notion response formats
  - Missing properties
  - Nested property structures
- `matchTodosToNotionTasks()` - full matching logic
  - Match by name + project
  - Match by name only (no project)
  - No matches found
  - Multiple potential matches (first wins)
  - Project filtering (case-insensitive)

**Mock Data:**

- Create mock Notion task objects with various property structures
- Create mock LLM todos with/without projects

### 2. Unit Tests: MCP Client (`mcp-client.test.ts`)

**Purpose**: Test Notion MCP client methods with mocked MCP responses

**Test Cases:**

- `searchTasks()` - search functionality
  - Valid query returns results
  - Empty query throws error (validation)
  - Malformed response handling
  - Response parsing (different formats)
- `fetchTask()` - fetch by ID
  - Valid page ID
  - Invalid page ID
  - Response parsing

**Mocking Strategy:**

- Mock the MCP `Client` class
- Mock `callTool()` to return structured responses
- Test different response formats from Notion MCP

### 3. Integration Tests: Full Flow (`notion-integration.test.ts`)

**Purpose**: Test the complete flow from transcript → LLM → Notion matching

**Test Cases:**

- Full `/api/process` flow with mocked Notion
  - LLM generates todos
  - Notion search finds matches
  - Todos enriched with Notion data
  - Response includes matched todos
- Error scenarios
  - Notion API fails (graceful degradation)
  - No matches found
  - Partial matches

**Mocking Strategy:**

- Mock `notionClient` methods
- Use real LLM (or mock if slow)
- Test with sample transcript

### 4. Orchestrator Integration Test (`orchestrator-integration.test.ts`)

**Purpose**: End-to-end test of the complete orchestrator pipeline using REAL LLM

**Test Cases:**

- Process nov-17 transcript with real LlamaLLMClient
- Validate todos extraction matches expected content from transcript
- Validate daily note contains expected themes
- Validate state machine transitions complete successfully
- Validate schema compliance at each stage

**Test Data:**

- Uses `data/test/nov-17/transcript.txt` as input
- Validates against `data/test/nov-17/fixture.json` expectations
- Uses MockNotionClient (testing LLM, not Notion API)

**Run with:**

```bash
TEST_TYPE=integration pnpm test orchestrator-integration
# Or: pnpm test:integration
```

**Note**: This test is skipped by default (requires `TEST_TYPE=integration`) because it:

- Requires the Llama model to be available
- Takes 3-5 minutes to run (real LLM inference)
- Should be run manually or in CI for validation

### 5. Test Helpers (`test-helpers.ts`)

**Purpose**: Reusable utilities for creating mock data

**Functions:**

- `createMockNotionTask()` - creates mock Notion task with properties
- `createMockTodo()` - creates mock LLM-generated todo
- `createMockNotionSearchResponse()` - creates mock Notion search response
- `createMockMCPResponse()` - creates mock MCP tool response

## Test File Structure

```
servers/reasoning/test/
├── matching.test.ts          # Matching logic unit tests
├── mcp-client.test.ts         # MCP client unit tests
├── notion-integration.test.ts # Full flow integration tests
├── test-helpers.ts            # Mock data helpers
└── fixtures/
    ├── notion-tasks.json      # Sample Notion task responses
    └── todos.json             # Sample LLM todos
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test matching.test.ts mcp-client.test.ts

# Run integration tests (requires TEST_TYPE=integration)
TEST_TYPE=integration pnpm test notion-integration.test.ts

# Run orchestrator integration test with real LLM (uses nov-17 test data)
TEST_TYPE=integration pnpm test orchestrator-integration
# Or use the npm script:
pnpm test:integration

# Run with coverage
pnpm test --coverage
```

## Implementation Priority

1. **Fix empty query issue** (immediate)
2. **Add matching logic tests** (high priority - pure functions, easy to test)
3. **Add MCP client tests** (medium priority - needs mocking setup)
4. **Add integration tests** (lower priority - can use mocked Notion)

## Notes

- Use Vitest (already configured)
- Mock Notion MCP client to avoid requiring real Notion connection for unit tests
- Integration tests can optionally use real Notion (with TEST_TYPE=integration)
- Keep tests fast - unit tests should run in <1s, integration tests <10s

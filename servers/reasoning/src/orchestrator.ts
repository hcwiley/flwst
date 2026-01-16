/**
 * Reasoning Orchestrator
 *
 * Implements a linear, debuggable state machine for orchestrating the LLM pipeline.
 * Manages state transitions from INIT -> TODOS_MATCHED, without performing Notion writes.
 */

import {
  Todo,
  TodoSchema,
  HighLevelNotes,
  HighLevelNotesSchema,
  DailyNoteResponse,
  DailyNoteSchema,
  NotionContextResponse,
} from '@flwst/types/src/api/reasoning';
import { TranscriptProcessor } from './utils/transcript-processor.js';
import { extractNotionTaskProperties } from './matching.js';

/**
 * State machine enum for orchestrator progression
 */
export enum ReasoningState {
  INIT = 'INIT',
  DAILY_NOTES_EXTRACTED = 'DAILY_NOTES_EXTRACTED',
  TODOS_EXTRACTED = 'TODOS_EXTRACTED',
  TODOS_MATCHED = 'TODOS_MATCHED',
  TODOS_AUGMENTED = 'TODOS_AUGMENTED',
  NOTION_UPDATED = 'NOTION_UPDATED',
  DONE = 'DONE',
  ERROR = 'ERROR',
}

/**
 * Interface for LLM client operations
 * Abstracts all Llama inference calls to enable testing with mocks
 */
export interface ILLMClient {
  /**
   * Step 1: Extract high-level notes from transcript
   */
  extractHighLevelNotes(
    transcript: string,
    notionContext?: NotionContextResponse,
  ): Promise<HighLevelNotes>;

  /**
   * Step 2: Generate detailed structured todos from transcript and notes
   */
  generateDetailedStructuredData(
    transcript: string,
    highLevelNotes: HighLevelNotes,
    notionContext?: NotionContextResponse,
  ): Promise<DailyNoteResponse>;

  /**
   * Stage A: Update matched Notion task body with new transcript info
   * Returns updated markdown body that preserves existing content and incorporates new context
   */
  updateMatchedTodoBody(
    todo: Todo,
    existingBody: string,
    transcript: string,
    dailyNoteMarkdown: string,
  ): Promise<string>;

  /**
   * Stage B: Augment unmatched todo with project neighborhood context
   * Returns enriched todo with improved description, dependencies, and metadata
   */
  refineTodoWithProjectContext(
    todo: Todo,
    projectNeighborhood: {
      existingTasks: Array<{ title: string; body?: string }>;
      otherTodosInRun: Todo[];
    },
    transcript: string,
    dailyNoteMarkdown: string,
  ): Promise<Todo>;
}

/**
 * Interface for Notion client operations
 * Abstracts all Notion API/MCP interactions to enable testing with mocks
 */
export interface INotionClient {
  /**
   * Fetch Notion context (projects, examples, stats)
   */
  fetchContext(): Promise<NotionContextResponse>;

  /**
   * Search for Notion tasks matching keywords
   */
  searchTasks(query: string, project?: string): Promise<any[]>;

  /**
   * Match todos to Notion tasks using fuzzy matching
   */
  matchTodosToNotionTasks(todos: Todo[], notionTasks: any[]): Promise<Todo[]>;

  /**
   * Fetch page body/description from Notion
   */
  fetchPageBody(pageId: string): Promise<string>;

  /**
   * Update page body/description in Notion
   */
  updatePageBody(pageId: string, markdown: string): Promise<void>;

  /**
   * Update a todo task in Notion with all properties (status, priority, description, etc.)
   */
  updateTodo(todo: Todo): Promise<void>;

  /**
   * Create a new todo task in Notion
   */
  createTodo(todo: Todo, dailyNoteId?: string): Promise<{ id: string; url: string }>;
}

/**
 * Interface for transcript source
 * Enables loading transcripts from files or other sources in tests
 */
export interface ITranscriptSource {
  loadTranscript(): Promise<string>;
}

/**
 * Orchestrator state and artifacts
 */
export interface OrchestratorState {
  state: ReasoningState;
  transcript: string;
  notionContext?: NotionContextResponse;
  highLevelNotes?: HighLevelNotes;
  dailyNoteRichMarkdown: string;
  todos: Todo[];
  notionTasksSnapshot: any[];
  logs: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Reasoning Orchestrator
 *
 * Manages the pipeline from transcript to Notion matching using a state machine.
 * All external dependencies (LLM, Notion, filesystem) are injected via interfaces.
 */
export class ReasoningOrchestrator {
  private _state: ReasoningState = ReasoningState.INIT;
  private transcript: string;
  private notionContext?: NotionContextResponse;
  private highLevelNotes?: HighLevelNotes;
  private dailyNoteRichMarkdown: string = '';
  private todos: Todo[] = [];
  private notionTasksSnapshot: any[] = [];
  private logs: string[] = [];
  private warnings: string[] = [];
  private errors: string[] = [];

  constructor(
    private llmClient: ILLMClient,
    private notionClient: INotionClient,
    transcript: string,
    notionContext?: NotionContextResponse,
  ) {
    // Pre-process transcript (spelling fixes, blacklist filtering)
    this.transcript = TranscriptProcessor.process(transcript);
    this.notionContext = notionContext;
    this.log('Orchestrator initialized (transcript pre-processed)', ReasoningState.INIT);
  }

  /**
   * Get current state
   */
  getState(): ReasoningState {
    return this._state;
  }

  /**
   * Get full orchestrator state for debugging
   */
  getStateSnapshot(): OrchestratorState {
    return {
      state: this._state,
      transcript: this.transcript,
      notionContext: this.notionContext,
      highLevelNotes: this.highLevelNotes,
      dailyNoteRichMarkdown: this.dailyNoteRichMarkdown,
      todos: this.todos,
      notionTasksSnapshot: this.notionTasksSnapshot,
      logs: this.logs,
      warnings: this.warnings,
      errors: this.errors,
    };
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: ReasoningState): void {
    this.log(`Transitioning from ${this._state} to ${newState}`, newState);
    this._state = newState;
  }

  /**
   * Log a message with state context
   */
  private log(message: string, state?: ReasoningState): void {
    const stateLabel = state || this._state;
    const logEntry = `[${stateLabel}] ${message}`;
    this.logs.push(logEntry);
    console.error(logEntry);
  }

  /**
   * Add a warning
   */
  private warn(message: string): void {
    this.warnings.push(message);
    this.log(`WARNING: ${message}`);
  }

  /**
   * Add an error and transition to ERROR state
   */
  private error(message: string, error?: Error): void {
    const errorMsg = error ? `${message}: ${error.message}` : message;
    this.errors.push(errorMsg);
    this.log(`ERROR: ${errorMsg}`);
    this.transitionTo(ReasoningState.ERROR);
  }

  /**
   * Run the orchestration pipeline up to a target state (default: DONE)
   */
  async run(
    targetState: ReasoningState = ReasoningState.TODOS_MATCHED,
  ): Promise<DailyNoteResponse> {
    try {
      if (this._state === ReasoningState.ERROR) {
        throw new Error('Cannot resume orchestrator after ERROR state');
      }

      // Step 0: Ensure Notion context is available
      if (!this.notionContext) {
        try {
          this.log('Fetching Notion context...');
          this.notionContext = await this.notionClient.fetchContext();
          this.log(`Fetched Notion context: ${this.notionContext.projects.length} projects found`);
        } catch (err) {
          this.warn(`Failed to fetch Notion context: ${err}`);
        }
      }

      // Step 1: Extract high-level notes
      if (this.shouldRunStep(ReasoningState.DAILY_NOTES_EXTRACTED, targetState)) {
        await this.extractHighLevelNotes();
      }
      if (targetState === ReasoningState.DAILY_NOTES_EXTRACTED) return this.asResponse();

      // Step 2: Generate detailed structured data
      if (this.shouldRunStep(ReasoningState.TODOS_EXTRACTED, targetState)) {
        await this.extractTodos();
      }
      if (targetState === ReasoningState.TODOS_EXTRACTED) return this.asResponse();

      // Step 3: Match todos to Notion tasks
      if (this.shouldRunStep(ReasoningState.TODOS_MATCHED, targetState)) {
        await this.matchTodos();
      }
      if (targetState === ReasoningState.TODOS_MATCHED) return this.asResponse();

      this.transitionTo(ReasoningState.DONE);
      this.log('Orchestration complete');

      return this.asResponse();
    } catch (err) {
      this.error('Orchestration failed', err as Error);
      throw err;
    }
  }

  /**
   * Check if a state is before or equal to a target state
   */
  private isStateBefore(state: ReasoningState, target: ReasoningState): boolean {
    const states = Object.values(ReasoningState);
    return states.indexOf(state) <= states.indexOf(target);
  }

  /**
   * Check if a state is strictly before another (non-equal).
   */
  private isStateStrictlyBefore(state: ReasoningState, target: ReasoningState): boolean {
    const states = Object.values(ReasoningState);
    return states.indexOf(state) < states.indexOf(target);
  }

  /**
   * Determine whether a step should run given current and target state.
   */
  private shouldRunStep(stepState: ReasoningState, targetState: ReasoningState): boolean {
    return (
      this.isStateBefore(stepState, targetState) &&
      this.isStateStrictlyBefore(this._state, stepState)
    );
  }

  /**
   * Format current state as DailyNoteResponse
   */
  private asResponse(): DailyNoteResponse {
    return {
      dailyNoteRichMarkdown: this.dailyNoteRichMarkdown,
      todos: this.todos,
    };
  }

  /**
   * Step 1: Extract high-level notes from transcript
   */
  private async extractHighLevelNotes(): Promise<void> {
    if (this._state !== ReasoningState.INIT) {
      throw new Error(`Cannot extract high-level notes from state ${this._state}`);
    }

    try {
      this.log('Extracting high-level notes...');
      this.highLevelNotes = await this.llmClient.extractHighLevelNotes(
        this.transcript,
        this.notionContext,
      );

      // Validate with Zod
      HighLevelNotesSchema.parse(this.highLevelNotes);
      this.dailyNoteRichMarkdown = this.highLevelNotes.dailyNoteRichMarkdown;
      this.transitionTo(ReasoningState.DAILY_NOTES_EXTRACTED);
      this.log(`Extracted ${this.highLevelNotes.potentialTodos.length} potential todos`);
    } catch (err) {
      this.error('Failed to extract high-level notes', err as Error);
      throw err;
    }
  }

  /**
   * Step 2: Generate detailed structured todos
   */
  private async extractTodos(): Promise<void> {
    if (this._state !== ReasoningState.DAILY_NOTES_EXTRACTED) {
      throw new Error(`Cannot extract todos from state ${this._state}`);
    }

    if (!this.highLevelNotes) {
      throw new Error('High-level notes not available');
    }

    try {
      this.log('Generating detailed structured data...');
      const result = await this.llmClient.generateDetailedStructuredData(
        this.transcript,
        this.highLevelNotes,
        this.notionContext,
      );

      // Validate with Zod
      DailyNoteSchema.parse(result);

      // Deduplicate todos by text (case-insensitive)
      const seenTexts = new Set<string>();
      result.todos = result.todos.filter((todo) => {
        const normalized = todo.text.toLowerCase().trim();
        if (seenTexts.has(normalized)) return false;

        // Also skip todos where text is just the project name (lazy LLM)
        if (todo.project && normalized === todo.project.toLowerCase().trim()) return false;

        seenTexts.add(normalized);
        return true;
      });

      // Post-extraction: Refine project mapping using Notion context
      if (this.notionContext && result.todos.length > 0) {
        this.log('Refining project mapping...');
        result.todos = result.todos.map((todo) => {
          if (!todo.project) return todo;

          // Try to find a fuzzy match in the known projects
          const match = this.findBestProjectMatch(todo.project, this.notionContext!.projects);
          if (match) {
            todo.project = match;
          }
          return todo;
        });
      }

      // Map completed: true to status: 'Done' if status is not already set
      // This ensures that todos marked as completed get the correct status before matching
      result.todos = result.todos.map((todo) => {
        if (!todo.status && todo.completed === true) {
          todo.status = 'Done';
          this.log(`Mapped completed=true to status='Done' for "${todo.text}"`);
        }
        return todo;
      });

      this.todos = result.todos;
      this.transitionTo(ReasoningState.TODOS_EXTRACTED);
      this.log(`Extracted ${this.todos.length} todos`);
    } catch (err) {
      this.error('Failed to extract todos', err as Error);
      throw err;
    }
  }

  /**
   * Step 3: Match todos to Notion tasks
   */
  private async matchTodos(): Promise<void> {
    if (this._state !== ReasoningState.TODOS_EXTRACTED) {
      throw new Error(`Cannot match todos from state ${this._state}`);
    }

    try {
      this.log('Matching todos to Notion tasks...');

      // Search for Notion tasks using keywords from todos
      const allNotionTasks: any[] = [];
      const seenTaskIds = new Set<string>();
      let connectionErrorCount = 0;
      const connectionErrorThreshold = 3; // Warn after 3 connection errors

      for (const todo of this.todos) {
        // Extract keywords (simplified - could be improved)
        const keywords = this.extractKeywords(todo.text);
        if (keywords.length > 0) {
          try {
            const searchQuery = keywords.slice(0, 2).join(' ');
            console.debug(
              `[orchestrator] Generated search query for "${todo.text}": "${searchQuery}" (project: ${todo.project || 'none'})`,
            );
            const tasks = await this.notionClient.searchTasks(searchQuery, todo.project);
            console.debug(
              `[orchestrator] Search returned ${tasks.length} tasks for query "${searchQuery}"`,
            );
            for (const task of tasks) {
              if (task.id && !seenTaskIds.has(task.id)) {
                seenTaskIds.add(task.id);
                allNotionTasks.push(task);
                // Log the task name for debugging
                const taskProps = extractNotionTaskProperties(task);
                console.debug(
                  `[orchestrator] Added candidate: "${taskProps.name || 'unnamed'}" (id: ${task.id}, project: ${taskProps.project || 'none'})`,
                );
              } else if (task.id) {
                console.debug(`[orchestrator] Skipped duplicate task: ${task.id}`);
              }
            }
          } catch (searchError: any) {
            // Check if this is a connection error
            const isConnectionError =
              searchError?.isConnectionError === true ||
              searchError?.message?.includes('Not connected') ||
              searchError?.message?.includes('connection');

            if (isConnectionError) {
              connectionErrorCount++;
              if (connectionErrorCount === 1) {
                this.warn(
                  `Notion MCP connection error detected. Searches will return empty results. Please reconnect to Notion.`,
                );
              }
              // Don't log every single connection error to avoid spam
              if (connectionErrorCount <= connectionErrorThreshold) {
                console.debug(
                  `[orchestrator] Connection error for todo "${todo.text}" (${connectionErrorCount}/${connectionErrorThreshold})`,
                );
              }
            } else {
              this.warn(`Failed to search Notion for todo "${todo.text}": ${searchError}`);
            }
          }
        } else {
          console.debug(`[orchestrator] No keywords extracted for todo: "${todo.text}"`);
        }
      }

      // Add a summary warning if we had many connection errors
      if (connectionErrorCount > connectionErrorThreshold) {
        this.warn(
          `Notion MCP connection errors occurred for ${connectionErrorCount} searches. Matching will proceed with available results, but some todos may not be matched. Please reconnect to Notion for full matching.`,
        );
      }

      console.debug(
        `[orchestrator] Found ${allNotionTasks.length} total unique Notion candidates for ${this.todos.length} todos`,
      );
      if (allNotionTasks.length > 0) {
        console.debug(
          `[orchestrator] Candidate task names: ${allNotionTasks
            .map((t) => {
              const props = extractNotionTaskProperties(t);
              return `"${props.name || 'unnamed'}"`;
            })
            .join(', ')}`,
        );
      }
      this.notionTasksSnapshot = allNotionTasks;
      this.todos = await this.notionClient.matchTodosToNotionTasks(this.todos, allNotionTasks);
      this.transitionTo(ReasoningState.TODOS_MATCHED);

      const matchedCount = this.todos.filter((t) => t.isMatched).length;
      this.log(`Matched ${matchedCount} of ${this.todos.length} todos`);
    } catch (err) {
      this.error('Failed to match todos', err as Error);
      throw err;
    }
  }

  /**
   * Stage A: Update matched Notion task bodies with new transcript info
   */
  private async updateMatchedTodos(): Promise<void> {
    if (this._state !== ReasoningState.TODOS_MATCHED) {
      throw new Error(`Cannot update matched todos from state ${this._state}`);
    }

    try {
      this.log('Updating matched Notion task bodies...');

      const matchedTodos = this.todos.filter((t) => t.isMatched && t.notionId);
      this.log(`Updating ${matchedTodos.length} matched tasks`);

      for (const todo of matchedTodos) {
        if (!todo.notionId) continue;

        try {
          // Fetch existing body
          const existingBody = await this.notionClient.fetchPageBody(todo.notionId);

          // Use LLM to merge with transcript context
          const updatedBody = await this.llmClient.updateMatchedTodoBody(
            todo,
            existingBody,
            this.transcript,
            this.dailyNoteRichMarkdown,
          );

          // Update in Notion
          await this.notionClient.updatePageBody(todo.notionId, updatedBody);

          // Store updated body in todo.description
          todo.description = updatedBody;
          this.log(`Updated body for task: ${todo.text}`);
        } catch (err) {
          this.warn(`Failed to update matched todo "${todo.text}": ${err}`);
        }
      }

      // Transition to TODOS_AUGMENTED after updating matched todos
      // Stage B will run from this state
      this.transitionTo(ReasoningState.TODOS_AUGMENTED);
    } catch (err) {
      this.error('Failed to update matched todos', err as Error);
      throw err;
    }
  }

  /**
   * Stage B: Augment unmatched todos with project neighborhood context
   */
  private async augmentUnmatchedTodos(): Promise<void> {
    // After Stage A, we should be in TODOS_AUGMENTED
    if (this._state !== ReasoningState.TODOS_AUGMENTED) {
      throw new Error(`Cannot augment unmatched todos from state ${this._state}`);
    }

    try {
      this.log('Augmenting unmatched todos with project context...');

      const unmatchedTodos = this.todos.filter((t) => !t.isMatched);
      this.log(`Augmenting ${unmatchedTodos.length} unmatched todos`);

      // Group unmatched todos by project
      const todosByProject = new Map<string, Todo[]>();
      for (const todo of unmatchedTodos) {
        const project = todo.project || 'Personal';
        const existing = todosByProject.get(project) || [];
        existing.push(todo);
        todosByProject.set(project, existing);
      }

      // Augment each unmatched todo
      for (const todo of unmatchedTodos) {
        try {
          const project = todo.project || 'Personal';

          // Retrieve project neighborhood: existing tasks in same project
          const existingTasks: Array<{ title: string; body?: string }> = [];
          try {
            const projectTasks = await this.notionClient.searchTasks('', project);
            for (const task of projectTasks.slice(0, 10)) {
              // Extract title and optionally body
              const title = this.extractTaskTitle(task);
              if (title) {
                existingTasks.push({ title });
              }
            }
          } catch (err) {
            this.warn(`Failed to fetch project neighborhood for "${project}": ${err}`);
          }

          // Get other todos in this run in same project
          const otherTodosInRun =
            todosByProject.get(project)?.filter((t) => t.id !== todo.id) || [];

          // Use LLM to refine todo
          const refined = await this.llmClient.refineTodoWithProjectContext(
            todo,
            {
              existingTasks,
              otherTodosInRun,
            },
            this.transcript,
            this.dailyNoteRichMarkdown,
          );

          // Update todo in place (preserve schema)
          Object.assign(todo, refined);
          this.log(`Augmented todo: ${todo.text}`);
        } catch (err) {
          this.warn(`Failed to augment unmatched todo "${todo.text}": ${err}`);
        }
      }

      // Transition to TODOS_AUGMENTED after completing augmentation
      this.transitionTo(ReasoningState.TODOS_AUGMENTED);
    } catch (err) {
      this.error('Failed to augment unmatched todos', err as Error);
      throw err;
    }
  }

  /**
   * Step 4: Sync todos to Notion (create new, update existing)
   */
  private async syncToNotion(): Promise<void> {
    if (this._state !== ReasoningState.TODOS_AUGMENTED) {
      throw new Error(`Cannot sync to Notion from state ${this._state}`);
    }

    try {
      this.log('Syncing todos to Notion...');

      // Create new todos (unmatched ones)
      const newTodos = this.todos.filter((t) => !t.isMatched);
      for (const todo of newTodos) {
        try {
          const result = await this.notionClient.createTodo(todo);
          todo.notionId = result.id;
          todo.notionUrl = result.url;
          todo.isMatched = true; // Now it's created, so it's "matched"
          this.log(`Created new task: ${todo.text}`);
        } catch (err) {
          this.warn(`Failed to create todo "${todo.text}": ${err}`);
        }
      }

      // Matched todos were already updated in Stage A
      this.transitionTo(ReasoningState.NOTION_UPDATED);
      this.log(`Synced ${this.todos.length} todos to Notion`);
    } catch (err) {
      this.error('Failed to sync to Notion', err as Error);
      throw err;
    }
  }

  /**
   * Extract keywords from todo text for Notion search
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'me',
      'him',
      'her',
      'us',
      'them',
      'about',
      'email',
      'check',
      'get',
      'buy',
      'need',
      'want',
      'go',
    ]);

    const rawTokens = text.split(/[\s/]+/);
    const normalizeToken = (token: string): string => token.toLowerCase().replace(/[^\w]/g, '');
    const isCandidate = (token: string): boolean => token.length >= 3 && !stopWords.has(token);
    const isProperNoun = (token: string): boolean =>
      /^[A-Z][a-z]/.test(token) || /^[A-Z]{2,}/.test(token);

    const candidates = rawTokens.map(normalizeToken).filter((token) => isCandidate(token));

    const properNouns = rawTokens
      .map((token) => ({
        raw: token,
        normalized: normalizeToken(token),
      }))
      .filter(({ raw, normalized }) => isCandidate(normalized) && isProperNoun(raw))
      .map(({ normalized }) => normalized);

    const seen = new Set<string>();
    const prioritized: string[] = [];

    for (const token of properNouns) {
      if (seen.has(token)) continue;
      seen.add(token);
      prioritized.push(token);
    }

    const sorted = candidates
      .filter((token) => !seen.has(token))
      .sort((a, b) => b.length - a.length);

    const keywords = [...prioritized, ...sorted];
    console.debug(`[orchestrator] Extracted keywords for "${text}": ${keywords.join(', ')}`);
    return keywords;
  }

  /**
   * Find the best matching project from a list of valid projects
   */
  private findBestProjectMatch(input: string, validProjects: string[]): string | null {
    const normalizedInput = input
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
    if (!normalizedInput) return null;

    // 1. Exact match (after normalization)
    const exactMatch = validProjects.find(
      (p) =>
        p
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .trim() === normalizedInput,
    );
    if (exactMatch) return exactMatch;

    // 2. Partial match: valid project contained in input
    const partialMatch = validProjects.find((p) =>
      normalizedInput.includes(
        p
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .trim(),
      ),
    );
    if (partialMatch) return partialMatch;

    // 3. Reversed partial match: input contained in valid project
    const reversedMatch = validProjects.find((p) =>
      p
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim()
        .includes(normalizedInput),
    );
    if (reversedMatch) return reversedMatch;

    // 4. Special cases for common projects
    if (normalizedInput.includes('flow state') || normalizedInput.includes('flwst')) {
      const flwstMatch = validProjects.find(
        (p) => p.toLowerCase().includes('flow state') || p.toLowerCase().includes('flwst'),
      );
      if (flwstMatch) return flwstMatch;
    }

    if (normalizedInput.includes('sherpa')) {
      const sherpaMatch = validProjects.find((p) => p.toLowerCase().includes('sherpa'));
      if (sherpaMatch) return sherpaMatch;
    }

    if (
      normalizedInput.includes('personal') ||
      normalizedInput.includes('home') ||
      normalizedInput.includes('errand')
    ) {
      const personalMatch = validProjects.find((p) => p.toLowerCase().includes('personal'));
      if (personalMatch) return personalMatch;
    }

    return null;
  }

  /**
   * Extract task title from Notion page object
   */
  private extractTaskTitle(task: any): string | null {
    if (task.properties?.Name) {
      if (Array.isArray(task.properties.Name)) {
        return task.properties.Name.map((p: any) => p.plain_text || p).join('');
      } else if (task.properties.Name.title) {
        return task.properties.Name.title.map((t: any) => t.plain_text || t).join('');
      } else if (typeof task.properties.Name === 'string') {
        return task.properties.Name;
      }
    }
    return null;
  }
}

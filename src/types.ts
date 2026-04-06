export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  model?: string;
  mode?: string;
  timestamp: Date;
}

export interface Model {
  id: string;
  name: string;
  icon: string;
  isPro: boolean;
  isMax: boolean;
  hasThinking?: boolean;
}

export interface SearchMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  isPro?: boolean;
}

export interface AskOptions {
  model?: string;
  mode?: string;
  /**
   * Called each time the agentic loop executes a tool autonomously.
   * @param iteration  1-based loop count (max 4)
   * @param command    The shell command being run
   */
  onAgentLoop?: (iteration: number, command: string) => void;
}

export type Overlay = 'model' | 'mode' | null;
export type AppScreen = 'loading' | 'login' | 'chat';

export const MODELS: Model[] = [
  { id: 'sonar',              name: 'Sonar',             icon: '✦', isPro: false, isMax: false },
  { id: 'gpt-5.4',           name: 'GPT-5.4',           icon: '◎', isPro: true,  isMax: false },
  { id: 'gemini-3.1-pro',    name: 'Gemini 3.1 Pro',    icon: '✧', isPro: true,  isMax: false },
  { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', icon: '✦', isPro: true,  isMax: false, hasThinking: true },
  { id: 'claude-opus-4.6',   name: 'Claude Opus 4.6',   icon: '✦', isPro: false, isMax: true  },
  { id: 'nemotron-3-super',  name: 'Nemotron 3 Super',  icon: '◈', isPro: true,  isMax: false },
];

export const MODES: SearchMode[] = [
  { id: 'default',       name: 'Search',               description: 'Standard web search',              icon: '○' },
  { id: 'deep-research', name: 'Deep Research',         description: 'In-depth reports and analysis',    icon: '◉' },
  { id: 'model-council', name: 'Model Council',         description: 'Multiple AI models at once',       icon: '◈', isPro: true },
  { id: 'create',        name: 'Create Files & Apps',   description: 'Generate docs, slides, and apps',  icon: '◻' },
  { id: 'learn',         name: 'Learn Step by Step',    description: 'Interactive learning and quizzes', icon: '◷' },
];

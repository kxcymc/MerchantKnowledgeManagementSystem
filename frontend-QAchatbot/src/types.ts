// User Types
export interface User {
  id: string;
  username: string;
  avatar?: string;
}

// Message Types
export const MessageRole = {
  User: 'user',
  Assistant: 'assistant',
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url?: string;
  size?: number;
}

export interface Message {
  id: string;
  sessionId?: string;
  role: MessageRole;
  content: string;
  attachments?: Attachment[];
  timestamp: number;
  isStreaming?: boolean;
  files? : File[];
}

// Chat Session Types
export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  createdAt?: number;
}

// API Request/Response Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  attachments?: Attachment[];
}

export interface ChatResponse {
  id: string;
  content: string;
  role: MessageRole;
  timestamp: number;
}

// Stream Types
export interface StreamEvent {
  type: 'start' | 'token' | 'end' | 'error';
  data?: string;
  error?: string;
}

// UI State Types
export interface ChatUIState {
  isLoading: boolean;
  error?: string;
  selectedSession?: string;
}

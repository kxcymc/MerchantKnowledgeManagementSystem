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

export interface MessageReference {
  knowledge_id: number;
  title: string;
  type: string;
  file_url: string;
  page?: number; // 向后兼容：总权重最高的页码
  pages?: Array<{ 
    page: number; 
    score: number; // 总权重（所有引用的得分之和）
    totalScore?: number; // 总权重（明确字段）
    count?: number; // 引用次数
    maxScore?: number; // 最大权重（单个引用的最高得分）
  }>; // 所有页码，按总权重排序
  score?: number; // 总权重（所有引用的得分之和）
  chunks?: Array<{ // chunk信息，用于句子匹配
    text: string; // chunk文本
    page: number; // 页码
    score: number; // 得分
  }>;
}

export interface MessageImage {
  name: string;
  type: string;
  size: number;
  dataUrl?: string; // base64或blob URL（可选，用于临时预览）
  url?: string; // 完整的URL（用于持久化显示）
  filename?: string; // 文件名
}

export interface MessageAudio {
  name: string;
  type: string;
  size: number;
  dataUrl?: string; // base64或blob URL（可选，用于临时预览）
  url?: string; // 完整的URL（用于持久化播放）
  filename?: string; // 文件名
}

export interface Message {
  message_id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  attachments?: Attachment[];
  timestamp: number;
  isStreaming?: boolean;
  files?: File[];
  image?: MessageImage; // 图片信息
  audio?: MessageAudio; // 音频信息（可用于播放）
  hasAudio?: boolean; // 向后兼容：是否有语音输入
  references?: MessageReference[];
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

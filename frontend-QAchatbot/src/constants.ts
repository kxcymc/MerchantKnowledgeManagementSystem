import { ChatSession, Message, MessageRole } from './types';

export const MOCK_SESSIONS: ChatSession[] = [
  { id: '1', title: 'Project Brainstorming', updatedAt: Date.now() },
  { id: '2', title: 'React Component Structure', updatedAt: Date.now() - 1000 * 60 * 60 },
  { id: '3', title: 'Translation Request', updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
  { id: '4', title: 'Weekly Report Summary', updatedAt: Date.now() - 1000 * 60 * 60 * 48 },
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: MessageRole.Assistant,
    content: 'Hello! I am Doubao. How can I help you today?',
    timestamp: Date.now() - 10000,
  },
];

export const AVATAR_USER = 'https://picsum.photos/id/64/200/200';
export const AVATAR_AI =
  'https://lf-flow-web-cdn.doubao.com/obj/flow-web-cdn/doubao/logo-square.png'; // Placeholder for Doubao logo feel, or use a generic one

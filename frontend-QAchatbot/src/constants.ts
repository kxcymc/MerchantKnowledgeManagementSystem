import { ChatSession, Message, MessageRole } from './types';

export const MOCK_SESSIONS: ChatSession[] = [
  { id: '1', title: 'Project Brainstorming', updatedAt: Date.now() },
  { id: '2', title: 'React Component Structure', updatedAt: Date.now() - 1000 * 60 * 60 },
  { id: '3', title: 'Translation Request', updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
  { id: '4', title: 'Weekly Report Summary', updatedAt: Date.now() - 1000 * 60 * 60 * 48 },
];

export const INITIAL_MESSAGES: Message[] = [
  {
    message_id: '1',
    session_id: '1',
    role: MessageRole.Assistant,
    content: 'Hello! I am Doubao. How can I help you today?',
    timestamp: Date.now() - 10000,
  },
];

export const AVATAR_USER = 'https://picsum.photos/id/64/200/200';
export const AVATAR_AI =
  'https://lf-flow-web-cdn.doubao.com/obj/flow-web-cdn/doubao/logo-square.png'; // Placeholder for Doubao logo feel, or use a generic one

export const MOCK_REFERENCES = [
  { url: '快速上手飞书妙记', created_at: '2025-10-28' },
  { url: '商家保证金管理规范', created_at: '2021-01-08' },
  { url: '抖音电商规则总览', created_at: '2023-05-15' },
  { url: '如何提高店铺评分', created_at: '2024-02-20' },
  { url: '直播间违规行为解析', created_at: '2023-11-11' },
  { url: '售后服务标准操作流程', created_at: '2022-08-30' },
  { url: '巨量千川投放指南', created_at: '2024-01-01' },
  { url: '达人合作注意事项', created_at: '2023-07-22' },
  { url: '商品橱窗开通条件', created_at: '2022-12-12' },
  { url: '消费者权益保护法解读', created_at: '2021-06-18' },
];

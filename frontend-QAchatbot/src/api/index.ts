import request from './services/request';
import {
  GetChatHistoryResponse,
  SendMessageRequest,
  SendMessageResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
} from './services/types';

// 获取所有会话列表
export interface SessionListItem {
  session_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_at?: string;
}

export interface GetSessionsResponse {
  sessions: SessionListItem[];
}

export const getSessions = (): Promise<GetSessionsResponse> => {
  return request.get('/get-chat-history');
};

// 获取指定会话的历史消息
export interface SessionMessage {
  message_id: number;
  role: 'user' | 'assistant' | 'AI';
  content: string;
  created_at: string;
  sequence_num: number;
  references?: ChatReference[];
}

export interface GetSessionHistoryResponse {
  session: {
    session_id: number;
    title: string;
    created_at: string;
  };
  messages: SessionMessage[];
  pagination: {
    limit: number;
    total: number;
    returned: number;
    hasMoreBefore: boolean;
    earliestMessageId: number | null;
    earliestSequenceNum: number | null;
  };
}

export const getSessionHistory = (
  sessionId: number | string, 
  limit?: number,
  beforeMessageId?: number
): Promise<GetSessionHistoryResponse> => {
  const params: Record<string, string | number> = {};
  if (limit) {
    params.limit = limit;
  }
  if (beforeMessageId) {
    params.before_message_id = beforeMessageId;
  }
  return request.get(`/get-chat-history/${sessionId}`, { params });
};

// 删除会话
export const deleteSession = (sessionId: number | string): Promise<{ success: boolean; deleted_session_id: number; error?: string }> => {
  return request.delete(`/del-chat-session/${sessionId}`);
};

// 重命名会话
export interface RenameSessionRequest {
  title: string;
}

export interface RenameSessionResponse {
  success: boolean;
  session_id: number;
  title: string;
  error?: string;
}

export const renameSession = (sessionId: number | string, title: string): Promise<RenameSessionResponse> => {
  return request.put(`/rename-chat-session/${sessionId}`, { title });
};

// 保留旧的接口以兼容（如果需要）
export const getChatHistory = (): Promise<GetChatHistoryResponse> => {
  return request.get('/get-chat-history');
};

export const sendMessage = (data: SendMessageRequest): Promise<SendMessageResponse> => {
  if (data.attachment) {
    const formData = new FormData();
    formData.append('session_id', String(data.session_id));
    formData.append('message_id', String(data.message_id));
    formData.append('content', data.content);
    formData.append('attachment', data.attachment);
    return request.post('/chat', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return request.post('/chat', data);
};

// ============== RAG Chat API (SSE) ==============

// API Base URL - 与 request.ts 保持一致
// 在开发环境中使用代理，生产环境使用环境变量或默认值
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api');

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReference {
  knowledge_id: number;
  title: string;
  type: string;
  file_url: string;
  page?: number;
  pages?: Array<{ 
    page: number; 
    score: number;
    totalScore?: number;
    count?: number;
    maxScore?: number;
  }>;
  score?: number;
}

export interface ChatSSECallbacks {
  onStart?: (sessionId?: string) => void;
  onToken?: (token: string) => void;
  onDone?: (content: string, references: ChatReference[]) => void;
  onError?: (error: string) => void;
}

/**
 * RAG Chat API - 流式对话
 * @param message 用户消息
 * @param history 对话历史
 * @param sessionId 会话ID
 * @param callbacks SSE 回调函数
 */
export async function chatWithRAG(
  message: string,
  history: ChatMessage[] = [],
  sessionId?: string,
  callbacks?: ChatSSECallbacks
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        history,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'start':
                callbacks?.onStart?.(data.session_id);
                break;
              case 'token':
                callbacks?.onToken?.(data.content);
                break;
              case 'done':
                console.log('收到 done 事件:', { content: data.content?.substring(0, 50), references: data.references, referencesCount: data.references?.length || 0 });
                callbacks?.onDone?.(data.content, data.references || []);
                break;
              case 'error':
                console.error('收到 error 事件:', data.message);
                callbacks?.onError?.(data.message);
                break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    callbacks?.onError?.(error instanceof Error ? error.message : '请求失败');
  }
}
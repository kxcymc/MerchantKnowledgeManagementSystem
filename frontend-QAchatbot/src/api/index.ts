import request from './services/request';
import {
  GetChatHistoryResponse,
  SendMessageRequest,
  SendMessageResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
} from './services/types';

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

export const deleteSession = (params: DeleteSessionRequest): Promise<DeleteSessionResponse> => {
  return request.delete('/del-chat-session', { params });
}

// ============== RAG Chat API (SSE) ==============

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReference {
  filename: string;
  knowledge_id?: number;
  page?: number;
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
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
                callbacks?.onDone?.(data.content, data.references || []);
                break;
              case 'error':
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
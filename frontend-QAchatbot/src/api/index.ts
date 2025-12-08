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

export interface MessageImage {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  filename?: string;
}

export interface MessageAudio {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  filename?: string;
}

export interface ChatSSECallbacks {
  onStart?: (sessionId?: string) => void;
  onToken?: (token: string) => void;
  onDone?: (content: string, references: ChatReference[], userMessageImage?: MessageImage, userMessageAudio?: MessageAudio) => void;
  onError?: (error: string) => void;
}

/**
 * RAG Chat API - 流式对话（支持多模态）
 * @param message 用户消息
 * @param history 对话历史
 * @param sessionId 会话ID
 * @param image 图片文件（可选）
 * @param audio 音频文件（可选）
 * @param files 附件文件数组（可选）
 * @param callbacks SSE 回调函数
 */
/**
 * 上传并解析文件（图片、音频、附件）
 * @param file 文件对象
 * @param type 文件类型：'image' | 'audio' | 'attachment'
 * @param onProgress 进度回调函数
 * @returns 解析结果
 */
export async function uploadAndParseFile(
  file: File,
  type: 'image' | 'audio' | 'attachment',
  onProgress?: (progress: number) => void
): Promise<{
  success: boolean;
  file: {
    id: string;
    url: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    type: string;
  };
  parsedContent: any;
  extractedText: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  // 模拟进度（实际上传进度需要XMLHttpRequest）
  if (onProgress) {
    onProgress(10); // 开始上传
  }

  const response = await fetch(`${API_BASE_URL}/upload-and-parse-file`, {
    method: 'POST',
    body: formData,
  });

  if (onProgress) {
    onProgress(50); // 上传完成，开始解析
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '上传失败' }));
    throw new Error(error.error || '上传失败');
  }

  if (onProgress) {
    onProgress(100); // 解析完成
  }

  const result = await response.json();
  return result;
}

export async function chatWithRAG(
  message: string,
  history: ChatMessage[] = [],
  sessionId?: string,
  imageFile?: ParsedFileInfo,
  audioFile?: ParsedFileInfo,
  attachmentFiles?: ParsedFileInfo[],
  callbacks?: ChatSSECallbacks
): Promise<void> {
  try {
    // 如果有已解析的文件，使用JSON发送文件信息；否则使用JSON发送纯文本
    const hasFiles = imageFile || audioFile || (attachmentFiles && attachmentFiles.length > 0);
    let body: string;
    let headers: HeadersInit;

    if (hasFiles) {
      // 发送已解析的文件信息
      body = JSON.stringify({
        content: message,
        session_id: sessionId,
        history: history,
        parsedFiles: {
          image: imageFile ? {
            id: imageFile.id,
            url: imageFile.url,
            filename: imageFile.filename,
            originalName: imageFile.originalName,
            mimeType: imageFile.mimeType,
            size: imageFile.size,
            extractedText: imageFile.extractedText
          } : undefined,
          audio: audioFile ? {
            id: audioFile.id,
            url: audioFile.url,
            filename: audioFile.filename,
            originalName: audioFile.originalName,
            mimeType: audioFile.mimeType,
            size: audioFile.size,
            extractedText: audioFile.extractedText
          } : undefined,
          attachments: attachmentFiles?.map(f => ({
            id: f.id,
            url: f.url,
            filename: f.filename,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
            extractedText: f.extractedText
          })) || []
        }
      });
      headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };
    } else {
      body = JSON.stringify({
        message,
        history,
        session_id: sessionId,
      });
      headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };
    }

    const response = await fetch(`${API_BASE_URL}/chat?stream=true`, {
      method: 'POST',
      headers,
      body,
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
                console.log('收到 done 事件:', { 
                  content: data.content?.substring(0, 50), 
                  references: data.references, 
                  referencesCount: data.references?.length || 0,
                  hasImage: !!data.user_message_image,
                  hasAudio: !!data.user_message_audio
                });
                callbacks?.onDone?.(
                  data.content, 
                  data.references || [],
                  data.user_message_image,
                  data.user_message_audio
                );
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
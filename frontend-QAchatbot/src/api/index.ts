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
};

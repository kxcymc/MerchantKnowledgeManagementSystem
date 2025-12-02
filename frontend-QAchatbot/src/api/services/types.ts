export type FileType = 'PDF' | '富文本';

export type RoleType = 'user' | 'AI' | 'sys';

export interface ReferencedFile {
  title: string;
  type: FileType;
  file_url: string;
}

export interface MessageInfo {
  message_id: number;
  content: string;
  role: RoleType;
  referencedFiles: ReferencedFile[];
}

export interface SessionInfo {
  session_id: number;
  messages: MessageInfo[];
}

export type GetChatHistoryResponse = SessionInfo[];

export interface SendMessageRequest {
  session_id: number;
  message_id: number;
  content: string;
  attachment?: File;
}

export interface SendMessageResponse {
  content: string;
  referencedFiles: ReferencedFile[];
  nextSessionId: number;
  nextMessageId: number;
}

export interface DeleteSessionRequest {
  session_id: number;
}

export interface DeleteSessionResponse {
  nextSessionId: number;
  nextMessageId: number;
}

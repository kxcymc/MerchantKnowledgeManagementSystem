import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/ChatWindow';
import { ModelSelector } from '@/components/ModelSelector';
import { Message, MessageRole, ChatSession } from '@/types';
import { AVATAR_USER } from '@/constants';
import { Button, Avatar, Dropdown, Message as ArcoMessage } from '@arco-design/web-react';
import { IconMenu, IconPlus } from '@arco-design/web-react/icon';
import styles from './index.module.scss';
import ToLoginIcon from '@/assets/goToLogin.svg'
import LogoutIcon from '@/assets/logout.svg'
import { chatWithRAG, ChatMessage, getSessions, getSessionHistory, deleteSession, renameSession } from '@/api';

interface ChatPageProps {
  isLoggedIn: boolean;
  onLogout: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ isLoggedIn, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 从空数组开始，会话将从后端API加载
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [, setLoadingSessions] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentModelProvider, setCurrentModelProvider] = useState<string>('');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载所有会话列表
  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const response = await getSessions();
      console.log('获取会话列表响应:', response);
      
      // 检查响应格式
      if (!response || !response.sessions) {
        console.error('响应格式错误:', response);
        ArcoMessage.error('响应格式错误');
        return;
      }
      
      // 将后端返回的会话列表转换为前端格式
      console.log('开始格式化会话列表，原始数据:', response.sessions);
      console.log('原始数据类型:', typeof response.sessions, Array.isArray(response.sessions));
      
      if (!Array.isArray(response.sessions)) {
        console.error('sessions 不是数组:', response.sessions);
        ArcoMessage.error('会话列表格式错误');
        return;
      }
      
      const formattedSessions: ChatSession[] = response.sessions.map((session, index) => {
        try {
          // 处理日期格式
          let updatedAt = Date.now();
          let createdAt = Date.now();
          
          if (session.updated_at) {
            const updatedDate = new Date(session.updated_at);
            updatedAt = isNaN(updatedDate.getTime()) ? Date.now() : updatedDate.getTime();
          }
          
          if (session.created_at) {
            const createdDate = new Date(session.created_at);
            createdAt = isNaN(createdDate.getTime()) ? Date.now() : createdDate.getTime();
          }
          
          const formatted = {
            id: String(session.session_id),
            title: session.title || '新对话',
            updatedAt: updatedAt,
            createdAt: createdAt,
          };
          
          if (index < 3) {
            console.log(`格式化会话 ${index + 1}:`, {
              original: session,
              formatted: formatted
            });
          }
          
          return formatted;
        } catch (error) {
          console.error('格式化会话失败:', session, error);
          return {
            id: String(session.session_id || `error-${index}`),
            title: session.title || '新对话',
            updatedAt: Date.now(),
            createdAt: Date.now(),
          };
        }
      });
      // 按更新时间倒序排列
      formattedSessions.sort((a, b) => b.updatedAt - a.updatedAt);
      console.log('设置会话列表，共', formattedSessions.length, '个会话:', formattedSessions);
      setSessions(formattedSessions);
      console.log('会话列表状态已更新');
    } catch (error) {
      console.error('加载会话列表失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      ArcoMessage.error(`加载会话列表失败: ${errorMessage}`);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // 组件挂载时加载会话列表和当前模型信息
  useEffect(() => {
    console.log('组件挂载，开始加载会话列表');
    loadSessions();
    
    // 获取当前模型信息
    const fetchCurrentModel = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api');
        const response = await fetch(`${API_BASE_URL}/llm/current`);
        if (response.ok) {
          const data = await response.json();
          setCurrentModelProvider(data.provider || '');
        }
      } catch (error) {
        console.error('获取当前模型失败:', error);
      }
    };
    fetchCurrentModel();
  }, [loadSessions]);

  // 从URL参数读取session_id，并加载对应的历史消息
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('session_id');
    console.log('URL参数变化:', { sessionIdFromUrl, activeSessionId });
    
    if (sessionIdFromUrl) {
      // 如果URL中的session_id与当前activeSessionId不同，加载历史消息
      if (sessionIdFromUrl !== activeSessionId) {
        console.log('检测到新的session_id，开始加载历史消息:', sessionIdFromUrl);
        setActiveSessionId(sessionIdFromUrl);
        // 使用 ref 来避免依赖项问题
        loadSessionHistory(sessionIdFromUrl).catch(err => {
          console.error('加载历史消息失败:', err);
        });
      } else {
        console.log('session_id未变化，跳过加载');
      }
    } else {
      // 如果没有session_id，清空消息
      console.log('URL中没有session_id，清空消息');
      if (activeSessionId !== null) {
        setActiveSessionId(null);
        setMessages([]);
        setPagination(null);
      }
    }
    // 只依赖 searchParams，避免循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 分页信息
  const [pagination, setPagination] = useState<{
    hasMoreBefore: boolean;
    earliestMessageId: number | null;
    total: number;
  } | null>(null);

  // 加载指定会话的历史消息
  const loadSessionHistory = useCallback(async (sessionId: string | number, beforeMessageId?: number) => {
    try {
      setLoadingHistory(true);
      console.log('加载会话历史:', { sessionId, beforeMessageId });
      
      const response = await getSessionHistory(sessionId, 50, beforeMessageId);
      console.log('收到历史消息响应:', { 
        messageCount: response.messages.length, 
        pagination: response.pagination 
      });
      
      // 将后端返回的消息转换为前端格式
      const formattedMessages: Message[] = response.messages.map(msg => ({
        message_id: String(msg.message_id),
        session_id: String(response.session.session_id),
        role: msg.role === 'user' ? MessageRole.User : MessageRole.Assistant,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        isStreaming: false,
        references: msg.references?.map(ref => ({
          knowledge_id: ref.knowledge_id,
          title: ref.title,
          type: ref.type,
          file_url: ref.file_url || '',
          page: ref.page,
          pages: (ref as any).pages,
          score: ref.score,
        })) || [],
      }));
      
      // 如果是加载更早的消息（分页），则追加到现有消息前面
      if (beforeMessageId) {
        setMessages((prev) => [...formattedMessages, ...prev]);
      } else {
        // 首次加载或重新加载，替换所有消息
        console.log('设置消息列表，消息数量:', formattedMessages.length);
        setMessages(formattedMessages);
      }
      
      // 更新分页信息
      setPagination({
        hasMoreBefore: response.pagination.hasMoreBefore,
        earliestMessageId: response.pagination.earliestMessageId,
        total: response.pagination.total,
      });
      
      console.log('历史消息加载完成，消息数量:', formattedMessages.length, '分页信息:', {
        hasMoreBefore: response.pagination.hasMoreBefore,
        earliestMessageId: response.pagination.earliestMessageId,
        total: response.pagination.total
      });
      
      // 更新会话标题（如果后端返回的标题与当前不同）
      setSessions((prev) =>
        prev.map((session) =>
          session.id === String(response.session.session_id)
            ? { ...session, title: response.session.title || session.title }
            : session
        )
      );
    } catch (error) {
      console.error('加载历史消息失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      ArcoMessage.error(`加载历史消息失败: ${errorMessage}`);
      if (!beforeMessageId) {
        // 只有首次加载失败时才清空消息
        setMessages([]);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // 加载更早的消息（分页）
  const loadMoreMessages = useCallback(async () => {
    if (!activeSessionId || !pagination?.hasMoreBefore || !pagination.earliestMessageId) {
      return;
    }
    await loadSessionHistory(activeSessionId, pagination.earliestMessageId);
  }, [activeSessionId, pagination, loadSessionHistory]);

  const handleSessionSelect = async (id: string) => {
    // 如果点击的是当前活跃的会话，不重复加载
    if (id === activeSessionId) {
      return;
    }
    console.log('点击会话，准备加载:', id);
    // 先清空当前消息，避免显示旧内容
    setMessages([]);
    setPagination(null);
    // 更新URL参数和activeSessionId
    setActiveSessionId(id);
    navigate(`?session_id=${id}`);
    // 直接加载历史消息
    try {
      await loadSessionHistory(id);
    } catch (error) {
      console.error('加载会话历史失败:', error);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    // 清除URL参数
    navigate('/');
  };

  // 将 messages 转换为 API 需要的 history 格式
  const buildHistory = useCallback((msgs: Message[]): ChatMessage[] => {
    return msgs.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
  }, []);

  const handleSendMessage = async (content: string, files?: File[]) => {
    let messageContent = content;
    if (files && files.length > 0) {
      if (content.trim()) {
        messageContent = content;
      } else {
        messageContent = '用抖音商家知识库解读附件内容';
      }
    }
    
    // 确保消息内容不为空
    if (!messageContent || messageContent.trim().length === 0) {
      console.warn('消息内容为空，取消发送');
      return;
    }

    // 如果没有活跃的会话，后端会自动创建新会话
    // 这里不需要手动创建，让后端处理
    let currentSessionId = activeSessionId || '';

    // 创建用户消息
    const newUserMessage: Message = {
      message_id: `msg-${Date.now()}`,
      session_id: currentSessionId,
      role: MessageRole.User,
      content: messageContent,
      timestamp: Date.now(),
      files: files,
    };

    // 立即更新消息（确保用户消息显示）
    setMessages((prev) => [...prev, newUserMessage]);

    // 创建 AI 响应消息（流式更新）
    const aiMessageId = `msg-${Date.now() + 1}`;
    const aiResponse: Message = {
      message_id: aiMessageId,
      session_id: currentSessionId,
      role: MessageRole.Assistant,
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, aiResponse]);

    // 调用 RAG Chat API
    const history = buildHistory(messages);
    
    await chatWithRAG(messageContent, history, currentSessionId || undefined, {
      onToken: (token) => {
        // 流式更新 AI 响应内容
        setMessages((prev) => 
          prev.map((msg) => 
            msg.message_id === aiMessageId
              ? { ...msg, content: msg.content + token }
              : msg
          )
        );
      },
      onStart: (sessionId) => {
        // 如果后端返回了新的session_id，更新状态
        if (sessionId && sessionId !== currentSessionId) {
          const newSessionId = String(sessionId);
          setActiveSessionId(newSessionId);
          currentSessionId = newSessionId;
          navigate(`?session_id=${newSessionId}`);
          
          // 检查会话是否已在列表中，如果不在则添加
          setSessions((prev) => {
            const exists = prev.some(s => s.id === newSessionId);
            if (!exists) {
              return [{
                id: newSessionId,
                title: messageContent.slice(0, 20) + (messageContent.length > 20 ? '...' : ''),
                updatedAt: Date.now(),
                createdAt: Date.now(),
              }, ...prev];
            }
            return prev;
          });
        }
      },
      onDone: (finalContent, references) => {
        // 完成时更新最终内容并移除 streaming 状态，同时保存引用信息
        console.log('收到完成回调:', { finalContent: finalContent?.substring(0, 50), references, referencesCount: references?.length || 0 });
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.message_id === aiMessageId
              ? { ...msg, content: finalContent, isStreaming: false, references: references || [] }
              : msg
          )
        );
        
        // 如果有引用，记录日志
        if (references && references.length > 0) {
          console.log('引用来源:', references);
          console.log('引用详情:', JSON.stringify(references, null, 2));
        } else {
          console.warn('没有收到引用信息');
        }
        
        // 更新会话标题（使用用户第一条消息的前20个字符）
        if (messages.length === 0) {
          setSessions((prev) =>
            prev.map((session) =>
              session.id === currentSessionId
                ? { ...session, title: messageContent.slice(0, 20) + (messageContent.length > 20 ? '...' : '') }
                : session
            )
          );
        }
        
        // 重新加载会话列表以获取最新的更新时间和标题
        loadSessions();
      },
      onError: (error) => {
        // 错误处理
        setMessages((prev) =>
          prev.map((msg) =>
            msg.message_id === aiMessageId
              ? { ...msg, content: `抱歉，发生错误：${error}`, isStreaming: false }
              : msg
          )
        );
      },
    });
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      // 调用后端API删除会话
      const sessionIdNum = parseInt(sessionId);
      if (isNaN(sessionIdNum)) {
        // 如果是本地生成的临时session_id（如 "session-123456"），直接从前端删除
        setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
          navigate('/');
        }
        return;
      }
      
      const response = await deleteSession(sessionIdNum);
      if (response.success) {
        ArcoMessage.success('删除成功');
        // 从列表中移除
        setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        // 如果删除的是当前活跃的会话，清空消息并返回首页
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
          navigate('/');
        }
        // 重新加载会话列表（确保数据同步）
        loadSessions();
      } else {
        ArcoMessage.error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('删除会话失败:', error);
      ArcoMessage.error('删除会话失败');
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      const sessionIdNum = parseInt(sessionId);
      if (isNaN(sessionIdNum)) {
        // 如果是本地生成的临时session_id，直接更新前端状态
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, title: newTitle } : session
          )
        );
        return;
      }
      
      const response = await renameSession(sessionIdNum, newTitle);
      
      if (response && response.success) {
        // 更新会话列表
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, title: newTitle } : session
          )
        );
        // 重新加载会话列表（确保数据同步）
        loadSessions();
      } else {
        console.error('重命名失败:', response?.error || '未知错误');
      }
    } catch (error) {
      console.error('重命名会话异常:', error);
    }
  };

  const toggleSidebar = () => {
    if (isSidebarOpen) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setIsSidebarHovered(false);
    }
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsSidebarHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsSidebarHovered(false);
    }, 200);
  };

  const dropList = (
    <div className={styles.menuContainer}>
      {isLoggedIn ? (
        <div key="1" className={styles.menuItem} onClick={onLogout}>
          <LogoutIcon />
          退出登录
        </div>
      ) : (
        <div key="1" className={styles.menuItem} onClick={() => navigate('/login')}>
          <ToLoginIcon />
          登录
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.chatPageContainer}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={styles.sidebarWrapper}
      >
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId || ''}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          isOpen={isSidebarOpen}
          isHovered={isSidebarHovered}
          toggleOpen={toggleSidebar}
        />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.topNav}>
          <div
            className={`${styles.leftControls} ${isSidebarOpen ? styles.leftControlsHidden : ''}`}
          >
            <div
              onClick={toggleSidebar}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className={styles.menuButton}
            >
              <IconMenu className={styles.iconMenu} />
            </div>

            <Button shape="round" className={styles.newChatButton} onClick={handleNewChat}>
              <IconPlus className={styles.plusIcon} /> 新对话
            </Button>
          </div>

          <div className={styles.centerControls}>
            <ModelSelector
              currentProvider={currentModelProvider}
              onModelChange={(provider) => {
                setCurrentModelProvider(provider);
                // 不显示切换成功的消息
              }}
            />
          </div>

          <div className={styles.rightControls}>
            <Dropdown droplist={dropList} position="br" trigger="click">
              <Avatar size={32} className={styles.userAvatar}>
                <img src={AVATAR_USER} alt="User" />
              </Avatar>
            </Dropdown>
          </div>
        </div>

        <div
          className={styles.chatWindowWrapper}
          style={!activeSessionId && messages.length === 0 ? { marginBottom: '200px' } : {}}
        >
          <ChatWindow
            messages={messages}
            onSendMessage={handleSendMessage}
            isHomeState={!activeSessionId && messages.length === 0}
            hasMoreMessages={pagination?.hasMoreBefore || false}
            onLoadMore={loadMoreMessages}
            loadingHistory={loadingHistory}
          />
        </div>
      </main>
    </div>
  );
};

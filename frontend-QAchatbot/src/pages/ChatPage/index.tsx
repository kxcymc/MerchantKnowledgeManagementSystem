import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/ChatWindow';
import { Message, MessageRole, ChatSession } from '@/types';
import { MOCK_SESSIONS, AVATAR_USER } from '@/constants';
import { Button, Avatar, Dropdown } from '@arco-design/web-react';
import { IconMenu, IconPlus } from '@arco-design/web-react/icon';
import styles from './index.module.scss';
import ToLoginIcon from '@/assets/goToLogin.svg'
import LogoutIcon from '@/assets/logout.svg'
import { chatWithRAG, ChatMessage } from '@/api';

interface ChatPageProps {
  isLoggedIn: boolean;
  onLogout: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ isLoggedIn, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 从初始mock数据开始，但稍后会从URL或状态中更新
  const [sessions, setSessions] = useState<ChatSession[]>(MOCK_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 从URL参数读取session_id
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('session_id');
    if (sessionIdFromUrl) {
      setActiveSessionId(sessionIdFromUrl);
      // 这里可以从服务器加载该会话的消息
      // 目前不在此处清空消息（会导致刚创建的本地 optimistic 消息被覆盖）
      // 后续可以在此处发起请求以加载服务端消息
    }
  }, [searchParams]);

  const handleSessionSelect = (id: string) => {
    setActiveSessionId(id);
    // 切换会话时清空当前消息（或从服务端加载对应会话消息）
    setMessages([]);
    // 更新URL参数
    navigate(`?session_id=${id}`);
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

    // 如果没有活跃的会话，创建新会话
    let currentSessionId = activeSessionId;

    if (!currentSessionId) {
      const newSessionId = `session-${Date.now()}`;
      const newSession: ChatSession = {
        id: newSessionId,
        title: '新对话',
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };
      // 将新会话添加到会话列表顶部
      setSessions((prev) => [newSession, ...prev]);
      currentSessionId = newSessionId;
      setActiveSessionId(newSessionId);
      // 更新URL参数
      navigate(`?session_id=${newSessionId}`);
    }

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
    
    await chatWithRAG(messageContent, history, currentSessionId, {
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
      onDone: (finalContent, references) => {
        // 完成时更新最终内容并移除 streaming 状态
        setMessages((prev) =>
          prev.map((msg) =>
            msg.message_id === aiMessageId
              ? { ...msg, content: finalContent, isStreaming: false }
              : msg
          )
        );
        
        // 如果有引用，可以在这里处理（如显示来源）
        if (references && references.length > 0) {
          console.log('引用来源:', references);
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

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    // 如果删除的是当前活跃的会话，清空消息并返回首页
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      navigate('/');
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
          />
        </div>
      </main>
    </div>
  );
};

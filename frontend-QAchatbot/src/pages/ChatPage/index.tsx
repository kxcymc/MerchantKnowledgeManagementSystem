import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { ChatWindow } from '@/components/ChatWindow';
import { Message, MessageRole } from '@/types';
import { MOCK_SESSIONS, INITIAL_MESSAGES, AVATAR_USER } from '@/constants';
import { Button, Avatar, Dropdown, } from '@arco-design/web-react';
import { IconMenu, IconPlus, } from '@arco-design/web-react/icon';
import styles from './index.module.scss';
import ToLoginIcon from '@/assets/goToLogin.svg'
import LogoutIcon from '@/assets/logout.svg'

interface ChatPageProps {
  isLoggedIn: boolean;
  onLogout: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ isLoggedIn, onLogout }) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();

  const handleSessionSelect = (id: string) => {
    setActiveSessionId(id);
    setMessages(INITIAL_MESSAGES);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleSendMessage = (content: string, files?: File[]) => {
    if (!activeSessionId) {
      setActiveSessionId('new-session');
    }

    let messageContent = content;
    if (files && files.length > 0) {
      if (content.trim()) {
        messageContent = content;
      } else {
        messageContent = '用抖音商家知识库解读附件内容';
      }
    }

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: MessageRole.User,
      content: messageContent,
      timestamp: Date.now(),
      // 可以在此处存储文件对象或文件元数据
      files: files,
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.Assistant,
        content: `I received your message: "${messageContent}". This is a simulated response.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
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
      {isLoggedIn ?
        (<div key='1' className={styles.menuItem} onClick={onLogout}>
          <LogoutIcon />退出登录
        </div>) 
        : 
        (<div key='1' className={styles.menuItem} onClick={() => navigate('/login')}>
          <ToLoginIcon />登录
        </div>)}

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
          sessions={MOCK_SESSIONS}
          activeSessionId={activeSessionId || ''}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
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
            <Dropdown droplist={dropList} position='br' trigger='click'>
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

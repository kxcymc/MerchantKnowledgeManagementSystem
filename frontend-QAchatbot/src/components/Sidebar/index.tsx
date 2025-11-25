import React, { useEffect } from 'react';
import { Button, Avatar } from '@arco-design/web-react';
import { IconMessage, IconMore, IconEdit, IconMenuFold } from '@arco-design/web-react/icon';
import { ChatSession } from '@/types';
import logo from '@/assets/logo.png';
import styles from './index.module.scss';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSessionSelect: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  isHovered: boolean;
  toggleOpen: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  isOpen,
  isHovered,
  toggleOpen,
}) => {
  const showHeader = isOpen;

  let containerStyle: React.CSSProperties = {};
  let layoutClasses = styles.sidebar;

  if (isOpen) {
    layoutClasses += ` ${styles['sidebar--pinned']}`;
  } else {
    layoutClasses += ` ${styles['sidebar--peek']}`;
    containerStyle = {
      top: '64px',
      bottom: '50px',
      left: '20px',
      transform: isHovered ? 'translateX(0)' : 'translateX(-100%)',
      opacity: isHovered ? 1 : 0,
    };
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

      // 检测组合键
      if (isMac) {
        // macOS: Command + K
        if (e.metaKey && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          onNewChat();
        }
      } else {
        // Windows/Linux: Ctrl + K
        if (e.ctrlKey && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          onNewChat();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNewChat]); // 依赖 onNewChat 函数

  return (
    <div className={layoutClasses} style={containerStyle}>
      <div className={styles.innerContainer}>
        {showHeader && (
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <div className={styles.userInfo}>
                <Avatar size={36}>
                  <img src={logo} alt="" />
                </Avatar>
                <span className={styles.username}>抖音商家问答助手</span>
              </div>
              <div className={styles.menuFoldButton} onClick={toggleOpen}>
                <IconMenuFold className={styles.menuFoldIcon} />
              </div>
            </div>
          </div>
        )}

        <div className={`${styles.contentArea} ${!showHeader ? styles['contentArea--peek'] : ''}`}>
          <div className={styles.newChatWrapper}>
            <Button className={styles.newChatButton} onClick={onNewChat}>
              <IconEdit className={styles.newChatIcon} /> 新对话
              <span className={styles.shortcutKey}>⌘ K</span>
            </Button>
          </div>

          <div className={styles.scrollableList}>
            {sessions.length > 0 && <div className={styles.recentTitle}>历史对话</div>}

            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={`
                        ${styles.sessionItem}
                        ${
                          activeSessionId === session.id
                            ? styles['sessionItem--active']
                            : styles['sessionItem--inactive']
                        }
                    `}
              >
                <IconMessage
                  className={`${styles.messageIcon} ${activeSessionId === session.id ? styles['messageIcon--active'] : styles['messageIcon--inactive']}`}
                />
                <span className={styles.sessionTitle}>{session.title}</span>
                {activeSessionId === session.id && <IconMore className={styles.moreIcon} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

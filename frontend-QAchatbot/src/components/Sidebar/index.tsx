import React, { useEffect, useState } from 'react';
import { Button, Avatar, Dropdown, Modal, Input } from '@arco-design/web-react';
import { IconMessage, IconMore, IconEdit, IconMenuFold } from '@arco-design/web-react/icon';
import { ChatSession } from '@/types';
import logo from '@/assets/logo.png';
import styles from './index.module.scss';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSessionSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  isOpen: boolean;
  isHovered: boolean;
  toggleOpen: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  isOpen,
  isHovered,
  toggleOpen,
}) => {
  // 调试：监听 sessions prop 变化
  React.useEffect(() => {
    console.log('Sidebar 接收到的 sessions:', sessions.length, sessions);
  }, [sessions]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = () => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete);
      setDeleteModalVisible(false);
      setSessionToDelete(null);
    }
  };

  const handleRenameClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const session = sessions.find(s => s.id === sessionId);
    setSessionToRename(sessionId);
    setRenameTitle(session?.title || '');
    setRenameModalVisible(true);
  };

  const handleConfirmRename = () => {
    if (sessionToRename && renameTitle.trim()) {
      onRenameSession(sessionToRename, renameTitle.trim());
      setRenameModalVisible(false);
      setSessionToRename(null);
      setRenameTitle('');
    }
  };

  const handleCancelRename = () => {
    setRenameModalVisible(false);
    setSessionToRename(null);
    setRenameTitle('');
  };

  const getDropList = (sessionId: string) => (
    <div className={styles.dropContainer}>
      <div
        className={styles.dropItem}
        onClick={(e) => {
          e.stopPropagation();
          handleRenameClick(e, sessionId);
        }}
      >
        重命名
      </div>
      <div
        className={styles.dropItem}
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteClick(e, sessionId);
        }}
      >
        删除对话
      </div>
    </div>
  );

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
            {sessions.length > 0 && <div className={styles.recentTitle}>历史对话 ({sessions.length})</div>}
            
            {sessions.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#86909c' }}>
                暂无历史对话
              </div>
            )}

            {sessions.map((session, index) => {
              console.log(`渲染会话 ${index + 1}:`, session);
              return (
              <div
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={`
                        ${styles.sessionItem}
                        ${activeSessionId === session.id
                    ? styles['sessionItem--active']
                    : styles['sessionItem--inactive']
                  }
                    `}
              >
                <IconMessage
                  className={`${styles.messageIcon} ${activeSessionId === session.id ? styles['messageIcon--active'] : styles['messageIcon--inactive']}`}
                />
                <span className={styles.sessionTitle}>{session.title}</span>
                {activeSessionId === session.id && (
                  <Dropdown droplist={getDropList(session.id)} position="br" trigger="click">
                    <IconMore className={styles.moreIcon} onClick={(e) => e.stopPropagation()} />
                  </Dropdown>
                )}
              </div>
            );
            })}
          </div>
        </div>
      </div>

      <Modal
        title="删除对话"
        visible={deleteModalVisible}
        onOk={handleConfirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <p>你确定要删除对话吗？删除后无法找回。</p>
      </Modal>

      <Modal
        title="重命名会话"
        visible={renameModalVisible}
        onOk={handleConfirmRename}
        onCancel={handleCancelRename}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ marginBottom: '16px' }}>
          <Input
            value={renameTitle}
            onChange={(value) => setRenameTitle(value)}
            placeholder="请输入新标题"
            maxLength={100}
            showWordLimit
            autoFocus
            onPressEnter={handleConfirmRename}
          />
        </div>
      </Modal>
    </div>
  );
};

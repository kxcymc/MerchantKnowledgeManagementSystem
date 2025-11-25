import React, { useEffect, useRef, useState } from 'react';
import { Message, MessageRole } from '@/types';
import logo from "@/assets/logo.png"
import styles from './index.module.scss';
import { ChatInput } from '@/components/ChatInput';

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (content: string, files?: File[]) => void;
  isHomeState: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, isHomeState }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHomeState) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isHomeState]);

  const handleSend = (files?: File[]) => {
    if (inputValue.trim() || (files && files.length > 0)) {
      onSendMessage(inputValue.trim(), files);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, files?: File[]) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (inputValue.trim() || (files && files.length > 0)) {        
        onSendMessage(inputValue.trim(), files);
        setInputValue('');
      }
    }
  };

  if (isHomeState) {
    return (
      <div className={styles.homeContainer}>
        <h1 className={styles.homeGreeting}>商家您好～ 知识解惑，经营加分！</h1>

        <div className={styles.homeInputArea}>
          <ChatInput inputValue={inputValue}
            setInputValue={setInputValue}
            handleKeyDown={handleKeyDown}
            handleSend={handleSend} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesArea}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.messageRow} ${msg.role === MessageRole.User ? styles.messageRowUser : styles.messageRowAssistant
              }`}
          >
            <div
              className={`${styles.messageContentWrapper} ${msg.role === MessageRole.User ? styles.messageContentWrapperUser : styles.messageContentWrapperAssistant}`}
            >
              {msg.role === MessageRole.Assistant && (
                <div className={styles.avatarWrapper}>
                  <div className={styles.avatarGradient}>
                    <img src={logo} alt="AI" className={styles.avatarImage} />
                  </div>
                </div>
              )}

              <div className={styles.messageBubbleWrapper}>
                <div
                  className={`${styles.messageBubble} ${msg.role === MessageRole.User
                      ? styles.messageBubbleUser
                      : styles.messageBubbleAssistant
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.chatInputFixedArea}>
        <ChatInput minimized inputValue={inputValue}
          setInputValue={setInputValue}
          handleKeyDown={handleKeyDown}
          handleSend={handleSend} />
      </div>
    </div>
  );
};
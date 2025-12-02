import React, { memo, useRef, useState } from 'react';
import styles from './index.module.scss';
import { Button, Input, Tooltip, Notification } from '@arco-design/web-react';
import {
  IconSend,
  IconAttachment,
  IconClose,
  // IconScissor,
  // IconMindMapping,
} from '@arco-design/web-react/icon';

interface ChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent, files?: File[]) => void;
  handleSend: (files?: File[]) => void;
  minimized?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = memo(
  ({ inputValue, setInputValue, handleKeyDown, handleSend, minimized = false }) => {

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const handleAttachmentClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = Array.from(e.target.files || []);
      const validFiles: File[] = [];
      const MAX_FILE_SIZE = 10 * 1024 * 1024;

      if (newFiles.length === 0) {
        e.target.value = '';
        return;
      }

      newFiles.forEach(file => {
        if (file.size > MAX_FILE_SIZE) {
          Notification.error({
            title: '文件过大',
            content: `文件 "${file.name}" 大小超过 10MB，已被忽略。`,
          });
        } else {
          validFiles.push(file);
        }
      });

      if (validFiles.length > 0) {
        setSelectedFiles(prevFiles => [...prevFiles, ...validFiles]);
        Notification.info({
          title: '文件已上传',
          content: `已上传 ${validFiles.length} 个文件。`,
          duration: 3000
        });
      }

      e.target.value = '';
    };

    const handleRemoveFile = (indexToRemove: number) => {
      setSelectedFiles(prevFiles =>
        prevFiles.filter((_, index) => index !== indexToRemove)
      );
    };

    const unifiedHandleSend = () => {
      if (selectedFiles.length > 0) {
        handleSend(selectedFiles);
        setSelectedFiles([]);
      } else if (inputValue.trim()) {
        handleSend();
      }
    }

    const isSendDisabled = !inputValue.trim() && selectedFiles.length === 0;
    const isScrollablePreview = selectedFiles.length > 6;

    return (
      <div className={`${styles.chatInputWrapper} ${minimized ? styles.minimized : 'null'}`}
        style={selectedFiles.length > 0 ? { minHeight: '200px' } : { minHeight: '150px' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="*"
          multiple
        />

        <div className={styles.innerScrollContent}>
          {selectedFiles.length > 0 && (
            <div className={`${styles.chatPreview} ${isScrollablePreview ? styles.scrollablePreview : ''}`}>
              {selectedFiles.map((file, index) => (
                <span key={index} className={styles.previewTag}>
                  <span className={styles.tagName} title={`文件: ${file.name}`}>{`文件: ${file.name}`}</span>
                  <IconClose
                    className={styles.removeIcon}
                    onClick={() => handleRemoveFile(index)}
                  />
                </span>
              ))}
            </div>
          )}

          {isScrollablePreview && <div className={styles.previewDivider} />}

          <Input.TextArea
            placeholder={selectedFiles.length > 0 && inputValue.trim().length === 0 ? '用抖音商家知识库解读附件内容' : "输入您的问题，支持附件上传"}
            value={inputValue}
            onChange={setInputValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                unifiedHandleSend();
              } else {
                handleKeyDown(e, selectedFiles);
              }
            }}
            autoSize={{ minRows: minimized ? 1 : 3, maxRows: 20 }}
            className={styles.chatInputTextarea}
          />
        </div>

        <div className={styles.chatToolbar}>
          <div className={styles.toolbarGroupLeft}>
            <Tooltip content="添加文件">
              <Button
                icon={<IconAttachment />}
                shape="circle"
                className={styles.toolbarButton}
                onClick={handleAttachmentClick}
              />
            </Tooltip>

            {/* <div className={styles.deepThinkButton}>
            <IconMindMapping className={styles.deepThinkIcon} />
            <span className={styles.deepThinkLabel}>深度思考</span>
          </div> */}
          </div>

          <div className={styles.toolbarGroupRight}>

            {/* <Tooltip content="语音输入">
                 <Button icon={<IconVoice />} shape="circle" className={styles.toolbarButton} />
            </Tooltip>
            <div className={styles.toolbarDivider}></div> */}

            <Button
              type="primary"
              shape="circle"
              disabled={isSendDisabled}
              onClick={unifiedHandleSend}
              className={`${styles.sendButton} ${!isSendDisabled ? styles.sendButtonActive : styles.sendButtonInactive}`}
              icon={<IconSend />}
            />
          </div>
        </div>
      </div>
    );
  }
);
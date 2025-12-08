import React, { memo, useRef, useState, useCallback } from 'react';
import styles from './index.module.scss';
import { Button, Input, Tooltip, Notification, Progress } from '@arco-design/web-react';
import {
  IconSend,
  IconAttachment,
  IconClose,
  IconImage,
  IconVoice,
  IconStop,
} from '@arco-design/web-react/icon';
import { uploadAndParseFile } from '@/api';

interface ChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSend: (parsedFiles?: ParsedFileInfo[]) => void;
  minimized?: boolean;
}

export interface ParsedFileInfo {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: 'image' | 'audio' | 'attachment';
  parsedContent: any;
  extractedText: string;
  progress?: number;
  status?: 'uploading' | 'parsing' | 'completed' | 'error';
  error?: string;
  preview?: string; // 用于图片预览
}

export const ChatInput: React.FC<ChatInputProps> = memo(
  ({ inputValue, setInputValue, handleSend, minimized = false }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [parsedFiles, setParsedFiles] = useState<ParsedFileInfo[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // 上传并解析文件
    const uploadAndParse = useCallback(async (file: File, type: 'image' | 'audio' | 'attachment') => {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // 创建临时文件信息
      const tempFileInfo: ParsedFileInfo = {
        id: tempId,
        url: '',
        filename: '',
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        type,
        parsedContent: null,
        extractedText: '',
        progress: 0,
        status: 'uploading',
        // 对于图片和音频，创建预览URL（data URL或blob URL）
        preview: (type === 'image' || type === 'audio') ? URL.createObjectURL(file) : undefined
      };

      // 添加到列表
      setParsedFiles(prev => [...prev, tempFileInfo]);

      try {
        // 上传并解析
        const result = await uploadAndParseFile(
          file,
          type,
          (progress) => {
            setParsedFiles(prev => prev.map(f => 
              f.id === tempId 
                ? { ...f, progress, status: progress < 50 ? 'uploading' : 'parsing' }
                : f
            ));
          }
        );

        // 更新文件信息（保留预览URL）
        setParsedFiles(prev => prev.map(f => 
          f.id === tempId 
            ? {
                ...f,
                ...result.file,
                parsedContent: result.parsedContent,
                extractedText: result.extractedText,
                progress: 100,
                status: 'completed',
                preview: f.preview // 保留原有的预览URL（blob URL）
              }
            : f
        ));

        Notification.success({
          title: '文件解析完成',
          content: `文件 "${file.name}" 已成功解析`,
          duration: 2000,
        });
      } catch (error: any) {
        // 更新错误状态
        setParsedFiles(prev => prev.map(f => 
          f.id === tempId 
            ? {
                ...f,
                status: 'error',
                error: error.message || '解析失败'
              }
            : f
        ));

        Notification.error({
          title: '文件解析失败',
          content: error.message || '文件解析失败，请重试',
        });
      }
    }, []);

    const handleAttachmentClick = () => {
      fileInputRef.current?.click();
    };

    const handleImageClick = () => {
      imageInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = Array.from(e.target.files || []);
      const MAX_FILE_SIZE = 10 * 1024 * 1024;

      if (newFiles.length === 0) {
        e.target.value = '';
        return;
      }

      for (const file of newFiles) {
        if (file.size > MAX_FILE_SIZE) {
          Notification.error({
            title: '文件过大',
            content: `文件 "${file.name}" 大小超过 10MB，已被忽略。`,
          });
          continue;
        }

        // 立即上传并解析
        await uploadAndParse(file, 'attachment');
      }

      e.target.value = '';
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        e.target.value = '';
        return;
      }

      // 验证是否为图片
      if (!file.type.startsWith('image/')) {
        Notification.error({
          title: '文件类型错误',
          content: '请选择图片文件',
        });
        e.target.value = '';
        return;
      }

      // 验证文件大小
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        Notification.error({
          title: '文件过大',
          content: '图片大小不能超过 10MB',
        });
        e.target.value = '';
        return;
      }

      // 立即上传并解析
      await uploadAndParse(file, 'image');
      e.target.value = '';
    };

    const handleRemoveFile = (idToRemove: string) => {
      setParsedFiles(prev => {
        const file = prev.find(f => f.id === idToRemove);
        if (file?.preview) {
          URL.revokeObjectURL(file.preview);
        }
        return prev.filter(f => f.id !== idToRemove);
      });
    };

    const handleRemoveAudio = () => {
      setAudioBlob(null);
      audioChunksRef.current = [];
    };

    // 开始录音
    const startRecording = useCallback(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioBlob(audioBlob);
          // 停止所有音频轨道
          stream.getTracks().forEach(track => track.stop());
          
          // 立即上传并解析音频
          const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
          await uploadAndParse(audioFile, 'audio');
        };
        
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } catch (error) {
        Notification.error({
          title: '录音失败',
          content: '无法访问麦克风，请检查权限设置',
        });
        console.error('录音失败:', error);
      }
    }, [uploadAndParse]);

    // 停止录音
    const stopRecording = useCallback(() => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    }, [isRecording]);

    const unifiedHandleSend = () => {
      // 只发送已解析完成的文件
      const completedFiles = parsedFiles.filter(f => f.status === 'completed');
      
      if (completedFiles.length > 0 || inputValue.trim()) {
        handleSend(completedFiles.length > 0 ? completedFiles : undefined);
        setParsedFiles([]);
        setAudioBlob(null);
        audioChunksRef.current = [];
      }
    };

    // 检查是否有正在处理中的文件
    const hasProcessingFiles = parsedFiles.some(f => f.status === 'uploading' || f.status === 'parsing');
    const hasCompletedFiles = parsedFiles.some(f => f.status === 'completed');
    const isSendDisabled = (!inputValue.trim() && !hasCompletedFiles) || hasProcessingFiles;

    // 按类型分组文件
    const imageFiles = parsedFiles.filter(f => f.type === 'image');
    const audioFiles = parsedFiles.filter(f => f.type === 'audio');
    const attachmentFiles = parsedFiles.filter(f => f.type === 'attachment');

    return (
      <div
        className={`${styles.chatInputWrapper} ${minimized ? styles.minimized : ''}`}
        style={
          parsedFiles.length > 0
            ? { minHeight: '200px' }
            : { minHeight: '150px' }
        }
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="*"
          multiple
        />
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageChange}
          style={{ display: 'none' }}
          accept="image/*"
        />

        <div className={styles.innerScrollContent}>
          {/* 图片预览 */}
          {imageFiles.map((file) => (
            <div key={file.id} className={styles.imagePreviewContainer}>
              <div className={styles.imagePreview}>
                {file.preview && (
                  <img src={file.preview} alt="预览" className={styles.imageThumbnail} />
                )}
                {file.status === 'uploading' || file.status === 'parsing' ? (
                  <div className={styles.progressOverlay}>
                    <Progress
                      percent={file.progress || 0}
                      status={file.status === 'error' ? 'error' : 'normal'}
                      size="small"
                    />
                    <span className={styles.progressText}>
                      {file.status === 'uploading' ? '上传中...' : '解析中...'}
                    </span>
                  </div>
                ) : file.status === 'error' ? (
                  <div className={styles.errorOverlay}>
                    <span className={styles.errorText}>{file.error || '解析失败'}</span>
                  </div>
                ) : null}
                <IconClose
                  className={styles.removeIcon}
                  onClick={() => handleRemoveFile(file.id)}
                />
              </div>
            </div>
          ))}

          {/* 语音预览 */}
          {(audioFiles.length > 0 || (audioBlob && isRecording)) && (
            <div className={styles.audioPreviewContainer}>
              {audioFiles.map((file) => (
                <div key={file.id} className={styles.audioPreview}>
                  <IconVoice className={styles.audioIcon} />
                  <span className={styles.audioLabel}>语音消息</span>
                  {file.status === 'uploading' || file.status === 'parsing' ? (
                    <Progress
                      percent={file.progress || 0}
                      status={file.status === 'error' ? 'error' : 'normal'}
                      size="small"
                      style={{ flex: 1, margin: '0 8px' }}
                    />
                  ) : file.status === 'error' ? (
                    <span className={styles.errorText}>{file.error || '解析失败'}</span>
                  ) : null}
                  <IconClose
                    className={styles.removeIcon}
                    onClick={() => handleRemoveFile(file.id)}
                  />
                </div>
              ))}
              {audioBlob && isRecording && (
                <div className={styles.audioPreview}>
                  <IconVoice className={styles.audioIcon} />
                  <span className={styles.audioLabel}>录音中...</span>
                  <IconClose
                    className={styles.removeIcon}
                    onClick={handleRemoveAudio}
                  />
                </div>
              )}
            </div>
          )}

          {/* 附件文件列表 */}
          {attachmentFiles.length > 0 && (
            <div className={styles.chatPreview}>
              {attachmentFiles.map((file) => (
                <span key={file.id} className={styles.previewTag}>
                  <span className={styles.tagName} title={file.originalName}>
                    {file.originalName}
                  </span>
                  {file.status === 'uploading' || file.status === 'parsing' ? (
                    <Progress
                      percent={file.progress || 0}
                      status={file.status === 'error' ? 'error' : 'normal'}
                      size="small"
                      style={{ width: '60px', margin: '0 4px' }}
                    />
                  ) : file.status === 'error' ? (
                    <span className={styles.errorText} style={{ fontSize: '10px' }}>
                      {file.error || '失败'}
                    </span>
                  ) : (
                    <span className={styles.successIcon}>✓</span>
                  )}
                  <IconClose
                    className={styles.removeIcon}
                    onClick={() => handleRemoveFile(file.id)}
                  />
                </span>
              ))}
            </div>
          )}

          <Input.TextArea
            placeholder={
              parsedFiles.length > 0
                ? '可以添加文字说明'
                : '输入您的问题，支持图片、语音和附件上传'
            }
            value={inputValue}
            onChange={setInputValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isSendDisabled) {
                  unifiedHandleSend();
                }
              }
            }}
            autoSize={{ minRows: minimized ? 1 : 3, maxRows: 20 }}
            className={styles.chatInputTextarea}
          />
        </div>

        <div className={styles.chatToolbar}>
          <div className={styles.toolbarGroupLeft}>
            <Tooltip content="上传图片">
              <Button
                icon={<IconImage />}
                shape="circle"
                className={styles.toolbarButton}
                onClick={handleImageClick}
              />
            </Tooltip>
            <Tooltip content="添加文件">
              <Button
                icon={<IconAttachment />}
                shape="circle"
                className={styles.toolbarButton}
                onClick={handleAttachmentClick}
              />
            </Tooltip>
          </div>

          <div className={styles.toolbarGroupRight}>
            {!isRecording ? (
              <Tooltip content="语音输入">
                <Button
                  icon={<IconVoice />}
                  shape="circle"
                  className={styles.toolbarButton}
                  onClick={startRecording}
                />
              </Tooltip>
            ) : (
              <Tooltip content="停止录音">
                <Button
                  icon={<IconStop />}
                  shape="circle"
                  className={`${styles.toolbarButton} ${styles.recordingButton}`}
                  onClick={stopRecording}
                />
              </Tooltip>
            )}
            <div className={styles.toolbarDivider}></div>

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

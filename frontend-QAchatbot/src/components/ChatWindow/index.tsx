import React, { useEffect, useRef, useState } from 'react';
import { Message, MessageRole, MessageReference } from '@/types';
import logo from '@/assets/logo.png';
import styles from './index.module.scss';
import { ChatInput } from '@/components/ChatInput';
import { IconInfoCircle } from '@arco-design/web-react/icon';
import { Button, Spin } from '@arco-design/web-react';

/**
 * 渲染内容
 */
const renderContentWithCitations = (
  content: string,
  references: MessageReference[],
  _onReferenceClick: (ref: MessageReference) => void
) => {
  if (!content) {
    return <>{content}</>;
  }

  const removeCitations = (text: string): string => {
    return text.replace(/\[\d+\]/g, '').trim();
  };

  // 处理内容：处理加粗文本，区分标题和重要名词
  const processContent = (text: string, baseKey: string = 'content', isTitle: boolean = false): (string | React.ReactElement)[] => {
    const parts: (string | React.ReactElement)[] = [];
    
    // 先记录所有 **文本** 的位置，以便后续处理
    // 处理加粗文本 **文本**
    // 区分三种加粗：
    // 1. ###标题### 或 ##标题## 或 #标题# 或 #标题 - 标题加粗（深蓝色），隐藏 # 符号
    // 2. 中文序号开头的标题（一、二、三、等）- 标题加粗（深蓝色），支持 ##一、标题 格式，隐藏 # 符号
    // 3. **文本** - 重要名词加粗（黑色）
    // 4. 【文本】 - 重要名词加粗（黑色）
    const titleRegex = /(#{1,3})\s*(.+?)(?:\s*\1|$)/g; // 匹配 #标题#、##标题##、###标题### 或 #标题（末尾无#）
    const chineseTitleRegex = /^(#{0,3})\s*([一二三四五六七八九十]+[、.])\s*(.+?)$/; // 匹配 一、标题、二、标题 或 ##一、标题 等
    const boldRegex = /\*\*(.+?)\*\*/g;
    const bracketRegex = /【(.+?)】/g; // 匹配 【文本】
    
    // 记录所有 **文本** 的匹配位置，用于后续过滤
    const boldMatches: Array<{ start: number; end: number }> = [];
    boldRegex.lastIndex = 0;
    let boldMatch: RegExpExecArray | null;
    while ((boldMatch = boldRegex.exec(text)) !== null) {
      boldMatches.push({
        start: boldMatch.index,
        end: boldMatch.index + boldMatch[0].length
      });
    }
    
    const allMatches: Array<{ index: number; text: string; fullMatch: string; type: 'title' | 'bold' | 'bracket' }> = [];
    let match: RegExpExecArray | null;
    
    // 收集所有匹配
    titleRegex.lastIndex = 0;
    while ((match = titleRegex.exec(text)) !== null) {
      const titleText = match[2].trim(); // 标题文本
      const fullMatch = match[0]; // 完整匹配（包含 # 符号），用于跳过
      
      allMatches.push({
        index: match.index,
        text: titleText, // 只保存标题文本，不包含 # 符号
        fullMatch: fullMatch, // 完整匹配（包含 # 符号），用于跳过
        type: 'title'
      });
    }
    
    // 检查中文序号开头的标题（只在行首匹配）
    const lines = text.split('\n');
    let currentIndex = 0;
    lines.forEach(line => {
      const chineseMatch = line.match(chineseTitleRegex);
      if (chineseMatch) {
        const fullTitle = chineseMatch[0];
        const hashPrefix = chineseMatch[1] || ''; // 可选的 # 前缀
        const numberPart = chineseMatch[2]; // 中文数字部分（如"一、"）
        const titleText = chineseMatch[3]; // 标题内容
        const fullTitleText = numberPart + titleText; // 完整的标题文本（不含#）
        
        // 检查是否与已有标题重叠
        const overlaps = allMatches.some(m => 
          currentIndex >= m.index && currentIndex < m.index + m.fullMatch.length
        );
        if (!overlaps) {
          allMatches.push({
            index: currentIndex + hashPrefix.length, // 跳过 # 前缀
            text: fullTitleText,
            fullMatch: fullTitle,
            type: 'title'
          });
        }
      }
      currentIndex += line.length + 1; // +1 for newline
    });
    
    // 使用之前记录的 boldMatches 来添加加粗匹配
    boldMatches.forEach(boldMatchInfo => {
      // 重新匹配以获取完整信息
      const matchText = text.substring(boldMatchInfo.start, boldMatchInfo.end);
      const reMatch = matchText.match(/\*\*(.+?)\*\*/);
      if (reMatch) {
        // 检查是否与标题重叠
        const overlaps = allMatches.some(m => 
          boldMatchInfo.start >= m.index && boldMatchInfo.start < m.index + m.fullMatch.length
        );
        if (!overlaps) {
          allMatches.push({
            index: boldMatchInfo.start,
            text: reMatch[1],
            fullMatch: reMatch[0],
            type: 'bold'
          });
        }
      }
    });
    
    // 收集【】中的内容
    bracketRegex.lastIndex = 0;
    while ((match = bracketRegex.exec(text)) !== null) {
      // 检查是否与标题或加粗重叠
      const overlaps = allMatches.some(m => 
        match!.index >= m.index && match!.index < m.index + m.fullMatch.length
      );
      if (!overlaps) {
        allMatches.push({
          index: match.index,
          text: match[1], // 只保存【】中的文本
          fullMatch: match[0], // 完整匹配（包含【】），用于跳过
          type: 'bracket'
        });
      }
    }
    
    // 按位置排序
    allMatches.sort((a, b) => a.index - b.index);

    // 如果没有加粗文本，过滤掉所有 # 和 * 符号后返回
    if (allMatches.length === 0) {
      const cleanedText = text.replace(/#+/g, '').replace(/\*{1,}/g, '');
      return [cleanedText];
    }

    // 处理加粗文本
    let lastIndex = 0;
    allMatches.forEach((matchInfo, matchIdx) => {
      // 添加匹配前的文本，过滤掉未匹配的 #、* 符号
      if (matchInfo.index > lastIndex) {
        let beforeText = text.substring(lastIndex, matchInfo.index);
        // 过滤掉所有的 # 和 * 符号（包括 **、*** 等）
        beforeText = beforeText.replace(/#+/g, '').replace(/\*{1,}/g, '');
        if (beforeText) {
          parts.push(
            <React.Fragment key={`${baseKey}-before-${matchIdx}`}>
              {beforeText}
            </React.Fragment>
          );
        }
      }

      // 根据类型添加不同样式的加粗文本
      if (matchInfo.type === 'title') {
        // 标题加粗（深蓝色），隐藏 # 符号，只显示标题文本
        parts.push(
          <strong
            key={`${baseKey}-title-${matchIdx}`}
            style={{
              color: '#1e40af',
              fontWeight: 600,
              fontSize: isTitle ? 'inherit' : '1.05em'
            }}
          >
            {matchInfo.text}
          </strong>
        );
      } else if (matchInfo.type === 'bracket') {
        // 【】中的内容加粗：黑色，保留【】符号
        parts.push(
          <strong
            key={`${baseKey}-bracket-${matchIdx}`}
            style={{
              color: '#000000',
              fontWeight: 600
            }}
          >
            【{matchInfo.text}】
          </strong>
        );
      } else {
        // 重要名词加粗：黑色（标题之外的内容部分）
        parts.push(
          <strong
            key={`${baseKey}-bold-${matchIdx}`}
            style={{
              color: '#000000',
              fontWeight: 600
            }}
          >
            {matchInfo.text}
          </strong>
        );
      }

      lastIndex = matchInfo.index + matchInfo.fullMatch.length;
    });

    // 添加最后剩余的文本，过滤掉未匹配的 #、* 符号
    if (lastIndex < text.length) {
      let afterText = text.substring(lastIndex);
      // 过滤掉所有的 # 和 * 符号（包括 **、*** 等）
      afterText = afterText.replace(/#+/g, '').replace(/\*{1,}/g, '');
      if (afterText) {
        parts.push(
          <React.Fragment key={`${baseKey}-after`}>
            {afterText}
          </React.Fragment>
        );
      }
    }

    // 最后，对所有字符串部分再次过滤，确保所有 ** 符号都被移除
    const cleanedParts = parts.map((part, idx) => {
      if (typeof part === 'string') {
        const cleaned = part.replace(/#+/g, '').replace(/\*{1,}/g, '');
        return cleaned;
      }
      // 如果是 React 元素，检查其 children 是否为字符串
      if (React.isValidElement(part)) {
        const props = part.props as { children?: string | React.ReactNode };
        if (typeof props.children === 'string') {
          const cleanedChildren = props.children.replace(/#+/g, '').replace(/\*{1,}/g, '');
          return React.cloneElement(part, { key: part.key || `cleaned-${idx}` }, cleanedChildren);
        }
        // 如果是 React.Fragment，递归清理其 children
        if (part.type === React.Fragment && Array.isArray(props.children)) {
          const cleanedChildren = props.children.map((child: React.ReactNode) => {
            if (typeof child === 'string') {
              return child.replace(/#+/g, '').replace(/\*{1,}/g, '');
            }
            return child;
          });
          return React.cloneElement(part, { key: part.key || `cleaned-${idx}` }, cleanedChildren);
        }
      }
      return part;
    });

    return cleanedParts;
  };

  // 移除引用标记后处理内容
  const cleanedContent = removeCitations(content);
  
  // 格式化内容：处理换行、列表等，返回格式化后的文本数组
  // 返回格式：普通文本为字符串，来源标注为 { type: 'source', text: '文档名', paragraphIndex: number }
  const formatContentToSentences = (text: string): (string | { type: 'source'; text: string; paragraphIndex: number })[] => {
    const sentences: (string | { type: 'source'; text: string; paragraphIndex: number })[] = [];
    
    // 先按段落分割（双换行）
    const paragraphs = text.split(/\n\n+/);
    
    paragraphs.forEach((paragraph, paraIdx) => {
      if (paraIdx > 0) {
        sentences.push('\n\n'); // 段落分隔标记
      }
      
      // 检查是否是来源标注 [来源：文档名]
      const sourceRegex = /^[\s]*\[来源[：:]\s*(.+?)\][\s]*$/;
      // 检查是否是列表项（以 -、*、数字开头）
      const listItemRegex = /^[\s]*([-*•]|\d+[\.\)])\s+(.+)$/;
      const lines = paragraph.split(/\n/);
      
      lines.forEach((line, lineIdx) => {
        if (lineIdx > 0) {
          sentences.push('\n'); // 行分隔标记
        }
        
        // 优先检查是否是来源标注
        const sourceMatch = line.match(sourceRegex);
        if (sourceMatch) {
          sentences.push({ type: 'source', text: sourceMatch[1], paragraphIndex: paraIdx });
        } else {
          const match = line.match(listItemRegex);
          if (match) {
            sentences.push(`• ${match[2]}`); // 统一使用 • 作为列表标记
          } else {
            sentences.push(line);
          }
        }
      });
    });
    
    return sentences;
  };
  
  // 格式化内容并渲染
  const formattedSentences = formatContentToSentences(cleanedContent);
  const result: (string | React.ReactElement)[] = [];
  
  // 创建一个函数，根据文档名匹配到对应的reference
  const findReferenceByTitle = (docTitle: string): MessageReference | null => {
    if (!references || references.length === 0) {
      return null;
    }
    
    // 尝试精确匹配
    let matched = references.find(ref => ref.title === docTitle);
    if (matched) {
      return matched;
    }
    
    // 尝试部分匹配（去掉扩展名等）
    const normalizedTitle = docTitle.replace(/\.(pdf|docx?|txt)$/i, '').trim();
    matched = references.find(ref => {
      const normalizedRefTitle = ref.title.replace(/\.(pdf|docx?|txt)$/i, '').trim();
      return normalizedRefTitle === normalizedTitle || ref.title.includes(normalizedTitle) || normalizedTitle.includes(normalizedRefTitle);
    });
    
    return matched || null;
  };
  
  // 获取reference的页码数组
  const getPagesFromReference = (ref: MessageReference): number[] => {
    const pages: number[] = [];
    if (ref.pages && ref.pages.length > 0) {
      ref.pages.forEach(pageInfo => {
        if (!pages.includes(pageInfo.page)) {
          pages.push(pageInfo.page);
        }
      });
    } else if (ref.page !== undefined) {
      pages.push(ref.page);
    }
    return pages.sort((a, b) => a - b);
  };
  
  // 根据段落索引和文档名，尝试匹配对应的页码
  // 如果同一个文档有多个chunk，尝试根据段落位置匹配
  const getPagesForParagraph = (docTitle: string, paragraphIndex: number): number[] => {
    const matchedRef = findReferenceByTitle(docTitle);
    if (!matchedRef) {
      return [];
    }
    
    // 如果有chunks信息，尝试根据段落位置匹配
    if (matchedRef.chunks && matchedRef.chunks.length > 0) {
      // 简单策略：根据段落索引选择对应的chunk页码
      // 这里可以根据实际需求调整匹配逻辑
      const chunkIndex = Math.min(paragraphIndex, matchedRef.chunks.length - 1);
      const page = matchedRef.chunks[chunkIndex]?.page;
      if (page !== undefined) {
        return [page];
      }
    }
    
    // 如果没有chunks信息，返回所有页码（降级处理）
    return getPagesFromReference(matchedRef);
  };
  
  // 合并所有相同文档的来源标注（即使不连续）
  // 策略：收集所有来源标注，按文档名分组，合并页码，只在每个文档的第一次出现位置渲染
  const sourceMap = new Map<string, { pages: Set<number>; firstIdx: number; allIndices: number[] }>();
  
  formattedSentences.forEach((sentence, idx) => {
    if (typeof sentence === 'object' && sentence.type === 'source') {
      const pages = getPagesForParagraph(sentence.text, sentence.paragraphIndex);
      
      if (!sourceMap.has(sentence.text)) {
        // 第一次遇到这个文档的来源标注
        sourceMap.set(sentence.text, {
          pages: new Set(pages),
          firstIdx: idx,
          allIndices: [idx]
        });
      } else {
        // 已经存在，合并页码
        const existing = sourceMap.get(sentence.text)!;
        pages.forEach(page => existing.pages.add(page));
        existing.allIndices.push(idx);
      }
    }
  });
  
  // 转换为数组格式，方便查找
  const mergedSources: Array<{ docTitle: string; pages: number[]; firstIdx: number; allIndices: number[] }> = [];
  sourceMap.forEach((value, docTitle) => {
    mergedSources.push({
      docTitle,
      pages: Array.from(value.pages).sort((a, b) => a - b),
      firstIdx: value.firstIdx,
      allIndices: value.allIndices
    });
  });
  
  // 渲染格式化后的内容
  formattedSentences.forEach((sentence, idx) => {
    if (sentence === '\n\n') {
      result.push(<br key={`break-para-${idx}`} />);
    } else if (sentence === '\n') {
      result.push(<br key={`break-line-${idx}`} />);
    } else if (typeof sentence === 'object' && sentence.type === 'source') {
      // 检查是否是合并后的来源标注的第一次出现位置
      const mergedSource = mergedSources.find(ms => ms.firstIdx === idx);
      if (mergedSource) {
        // 只在第一次出现位置渲染合并后的来源标注
        const pageText = mergedSource.pages.length > 0 ? `（第 ${mergedSource.pages.join('、')} 页）` : '';
        
        result.push(
          <div
            key={`source-${idx}`}
            style={{
              marginTop: '4px',
              marginBottom: '4px',
              fontSize: '11px',
              color: '#9ca3af',
              fontStyle: 'italic',
              lineHeight: 1.4
            }}
          >
            [来源：{mergedSource.docTitle}{pageText}]
          </div>
        );
      }
      // 如果不是第一次出现位置，跳过渲染（已合并）
    } else if (typeof sentence === 'string' && sentence.startsWith('• ')) {
      // 列表项
      const listContent = sentence.substring(2);
      const content = processContent(listContent, `list-${idx}`);
      result.push(
        <div key={`list-item-${idx}`} style={{ marginLeft: '20px', marginBottom: '0px', lineHeight: 1.5 }}>
          <span style={{ marginRight: '8px', color: '#6b7280' }}>•</span>
          <span>{content}</span>
        </div>
      );
    } else if (typeof sentence === 'string') {
      // 普通文本
      const content = processContent(sentence, `text-${idx}`);
      result.push(<span key={`text-${idx}`}>{content}</span>);
    }
  });
  
  return <>{result}</>;
};

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (content: string, files?: File[]) => void;
  isHomeState: boolean;
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
  loadingHistory?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  messages, 
  onSendMessage, 
  isHomeState,
  hasMoreMessages = false,
  onLoadMore,
  loadingHistory = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 调试：监听 messages 变化
  useEffect(() => {
    console.log('ChatWindow 接收到的 props:', {
      messagesCount: messages.length,
      isHomeState,
      hasMoreMessages,
      loadingHistory,
      messages: messages.map(m => ({ id: m.message_id, role: m.role, content: m.content?.substring(0, 50) }))
    });
  }, [messages, isHomeState, hasMoreMessages, loadingHistory]);

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

  const handleReferenceClick = (ref: MessageReference) => {
    if (!ref.file_url && !ref.knowledge_id) {
      return;
    }

    // 构建预览 URL（使用 qa-chatbot-backend 的代理 API）
    let previewUrl = '';
    if (ref.type === 'PDF' && ref.knowledge_id) {
      // PDF 文件：使用后端文件接口（通过 qa-chatbot-backend 代理），支持页码参数
      previewUrl = `/api/file/${ref.knowledge_id}`;
      if (ref.page) {
        // 使用查询参数传递页码，后端会处理
        previewUrl += `?page=${ref.page}`;
      }
    } else if (ref.knowledge_id) {
      // 富文本文件：使用预览页面
      previewUrl = `http://localhost:5173/knowledge-management/RichTextPreview?knowledge_id=${ref.knowledge_id}`;
    } else if (ref.file_url) {
      // 如果 file_url 是相对路径，通过代理 API 访问
      if (ref.file_url.startsWith('/uploads/')) {
        // 从 file_url 中提取 knowledge_id（如果可能）
        // 否则使用 file_url 的相对路径
        previewUrl = `/api/file${ref.file_url}`;
      } else if (ref.file_url.startsWith('http')) {
        previewUrl = ref.file_url;
      } else {
        previewUrl = `/api/file${ref.file_url}`;
      }
    }

    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  if (isHomeState) {
    return (
      <div className={styles.homeContainer}>
        <h1 className={styles.homeGreeting}>商家您好～ 知识解惑，经营加分！</h1>

        <div className={styles.homeInputArea}>
          <ChatInput
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleKeyDown={handleKeyDown}
            handleSend={handleSend}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messagesArea}>
        {/* 加载更多按钮 */}
        {hasMoreMessages && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            padding: '16px',
            borderBottom: '1px solid #e5e6eb'
          }}>
            <Button 
              type="text" 
              loading={loadingHistory}
              onClick={onLoadMore}
              disabled={loadingHistory}
            >
              {loadingHistory ? '加载中...' : '加载更早的消息'}
            </Button>
          </div>
        )}
        {loadingHistory && messages.length === 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            padding: '40px'
          }}>
            <Spin />
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.message_id}
            className={`${styles.messageRow} ${
              msg.role === MessageRole.User ? styles.messageRowUser : styles.messageRowAssistant
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
                {msg.files && msg.files.length > 0 && (
                  <div className={styles.messageAttachmentsContainer}>
                    {msg.files.map((file, idx) => (
                      <div key={idx} className={styles.attachmentRow} title={file.name}>
                        <span className={styles.attachmentName}>{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className={`${styles.messageBubble} ${
                    msg.role === MessageRole.User
                      ? styles.messageBubbleUser
                      : styles.messageBubbleAssistant
                  }`}
                >
                  {msg.role === MessageRole.Assistant
                    ? (() => {
                        const refs = msg.references || [];
                        console.log('渲染消息内容，引用数量:', refs.length, '引用详情:', refs);
                        return renderContentWithCitations(msg.content, refs, handleReferenceClick);
                      })()
                    : msg.content}
                </div>
                {/* 显示引用信息 */}
                {msg.role === MessageRole.Assistant && msg.references && msg.references.length > 0 && (
                  <div className={styles.referenceContainer}>
                    <div className={styles.referenceHeader}>
                      <IconInfoCircle className={styles.infoIcon} />
                      <span>参考文档 ({msg.references.length})</span>
                    </div>
                    <div className={styles.referenceList}>
                      {msg.references.map((ref, idx) => {
                        // 如果有多个页码，按得分排序显示
                        const pages = ref.pages && ref.pages.length > 0 
                          ? ref.pages.sort((a, b) => {
                              const aScore = a.totalScore || a.score || 0;
                              const bScore = b.totalScore || b.score || 0;
                              return bScore - aScore;
                            })
                          : ref.page 
                            ? [{ page: ref.page, score: ref.score || 0 }]
                            : [];
                        
                        return (
                          <div
                            key={idx}
                            className={styles.referenceItem}
                            onClick={() => handleReferenceClick(ref)}
                            title={`点击预览：${ref.title}${pages.length > 0 ? `（第 ${pages.map(p => p.page).join('、')} 页）` : ''}`}
                          >
                            <div className={styles.referenceIndex}>{idx + 1}</div>
                            <div className={styles.referenceTitle}>
                              <span>{ref.title}</span>
                              {pages.length > 0 && (
                                <span className={styles.referencePage}>
                                  {pages.length === 1 
                                    ? `（第 ${pages[0].page} 页）`
                                    : `（第 ${pages.map(p => p.page).join('、')} 页）`}
                                </span>
                              )}
                            </div>
                            <div className={styles.referenceType}>{ref.type}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.chatInputFixedArea}>
        <ChatInput
          minimized
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleKeyDown={handleKeyDown}
          handleSend={handleSend}
        />
      </div>
    </div>
  );
};

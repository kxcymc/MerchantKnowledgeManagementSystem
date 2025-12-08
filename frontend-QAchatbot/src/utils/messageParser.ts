/**
 * 消息内容解析工具
 * 用于解析后端存储的统一格式（JSON或纯文本）
 */

export interface ParsedMessageContent {
  text: string;
  image: string | null; // data URL
  audio: string | null; // data URL
  isMultimodal: boolean;
}

/**
 * 解析存储格式的content（从后端返回）
 * @param content - 存储的content字符串（可能是纯文本或JSON字符串）
 * @returns 解析结果
 */
export function parseMessageContent(content: string): ParsedMessageContent {
  if (!content) {
    return { text: '', image: null, audio: null, isMultimodal: false };
  }

  // 尝试解析JSON
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && (parsed.image || parsed.audio)) {
      // 是多模态格式
      return {
        text: parsed.text || '',
        image: parsed.image || null,
        audio: parsed.audio || null,
        isMultimodal: true
      };
    }
  } catch (e) {
    // 不是JSON格式，当作纯文本处理
  }

  // 纯文本格式（向后兼容）
  return {
    text: content,
    image: null,
    audio: null,
    isMultimodal: false
  };
}

/**
 * 从data URL中提取MIME类型
 */
export function extractMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : '';
}


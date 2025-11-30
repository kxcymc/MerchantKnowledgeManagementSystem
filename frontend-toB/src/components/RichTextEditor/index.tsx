import React, { useCallback, FC, useState, useEffect, useRef } from 'react';
import { createEditor, Descendant, Editor, Element, Text, Transforms } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps } from 'slate-react';
import { Button, Tooltip, Space, Divider, Modal, Input, InputNumber, Drawer } from '@arco-design/web-react';
import {
    IconBold,
    IconItalic,
    IconUnderline,
    IconList,
    IconUnorderedList,
    IconH1,
    IconH2,
    IconH3,
    IconQuote,
    IconAlignLeft,
    IconAlignCenter,
    IconAlignRight,
    IconStrikethrough,
    IconLink,
    IconUndo,
    IconRedo,
} from '@arco-design/web-react/icon';
import { useSlate } from 'slate-react';
import { withHistory } from 'slate-history';


// --- 类型定义 ---

// 文本对齐类型
type TextAlign = 'left' | 'center' | 'right';

// 基础块级元素类型
interface BaseElement {
    type: string;
    align?: TextAlign;
    lineHeight?: number;
    marginBottom?: number;
    textIndent?: number;
    letterSpacing?: number;
    children: CustomText[];
}

/// 为 Slate 元素和文本定义类型，以便 TypeScript 更好地工作
type CustomElement = BaseElement &
  (| {
      type: 'paragraph';
    }
  | {
      type: 'block-quote';
    }
  | {
      type: 'bulleted-list';
    }
  | {
      type: 'numbered-list';
    }
  | {
      type: 'list-item';
    }
  | {
      type: 'heading-one';
    }
  | {
      type: 'heading-two';
    }
  | {
      type: 'heading-three';
    }
  | {
      type: 'horizontal-rule';
    }
  | {
      type: 'link';
      url: string;
    });

type FormattedText = { 
    text: string; 
    bold?: boolean; 
    italic?: boolean; 
    underline?: boolean;
    strikethrough?: boolean;
};
type CustomText = FormattedText;

declare module 'slate' {
    interface CustomTypes {
        Element: CustomElement;
        Text: CustomText;
    }
}

// 默认值，当编辑器为空时
const initialValue: Descendant[] = [
    {
        type: 'paragraph',
        children: [{ text: '' }],
    },
];

// --- 工具函数 ---

// 元素类型
const LIST_TYPES = ['numbered-list', 'bulleted-list'];
const TEXT_ALIGN_TYPES: TextAlign[] = ['left', 'center', 'right'];

/**
 * 切换块级元素类型（如段落、列表、）
 * @param editor Slate 编辑器实例
 * @param format 要切换到的块级格式
 */
const toggleBlock = (editor: Editor, format: string) => {
    const isAlignFormat = TEXT_ALIGN_TYPES.includes(format as TextAlign);

    const isActive = isBlockActive(
        editor,
        format,
        isAlignFormat ? 'align' : 'type'
    );
    const isList = LIST_TYPES.includes(format);
    const isHeading = format.startsWith('heading-');

    Transforms.unwrapNodes(editor, {
        match: n =>
            !Editor.isEditor(n) &&
            Element.isElement(n) &&
            LIST_TYPES.includes((n as CustomElement).type) &&
            !isAlignFormat,
        split: true,
    });

    let newProperties: Partial<CustomElement>;
    if (isAlignFormat) {
        newProperties = {
            align: isActive ? undefined : (format as TextAlign),
        };
    } else {
        newProperties = {
            type: isActive ? 'paragraph' : isList ? 'list-item' : (format as CustomElement['type']),
            align: isHeading || format === 'block-quote' ? undefined : undefined,
        };
    }

    Transforms.setNodes<CustomElement>(editor, newProperties);

    if (!isActive && isList) {
        const block: CustomElement = { type: format as 'bulleted-list' | 'numbered-list', children: [{ text: '' }] };
        Transforms.wrapNodes(editor, block);
    }
};

/**
 * 切换文本样式（如加粗、斜体）
 * @param editor Slate 编辑器实例
 * @param format 要切换的文本格式
 */
const toggleMark = (editor: Editor, format: keyof FormattedText) => {
    const isActive = isMarkActive(editor, format);

    if (isActive) {
        Editor.removeMark(editor, format);
    } else {
        Editor.addMark(editor, format, true);
    }
};

/**
 * 检查块级元素是否处于激活状态
 * @param editor Slate 编辑器实例
 * @param format 要检查的块级格式
 * @param blockType 属性名，默认为 'type'
 */
const isBlockActive = (editor: Editor, format: string, blockType: 'type' | 'align' = 'type') => {
    const { selection } = editor;
    if (!selection) return false;

    const [match] = Array.from(
        Editor.nodes(editor, {
            at: Editor.unhangRange(editor, selection),
            match: n =>
                !Editor.isEditor(n) &&
                Element.isElement(n) &&
                (n as CustomElement)[blockType as keyof CustomElement] === format,
        })
    );

    return !!match;
};

/**
 * 检查文本样式是否处于激活状态
 * @param editor Slate 编辑器实例
 * @param format 要检查的文本格式
 */
const isMarkActive = (editor: Editor, format: keyof FormattedText) => {
    const marks = Editor.marks(editor);

    return marks ? marks[format] === true : false;
};

/**
 * 插入超链接
 */
const insertLink = (editor: Editor, url: string) => {
    if (Editor.string(editor, [])) {
        Transforms.insertNodes(editor, {
            type: 'link',
            url,
            children: [{ text: url }],
        });
    }
};

/**
 * 插入水平分割线
 */
const insertHorizontalRule = (editor: Editor) => {
    Transforms.insertNodes(editor, {
        type: 'horizontal-rule',
        children: [{ text: '' }],
    });
};

/**
 * 计算文本总数
 */
const calculateTextLength = (content: Descendant[]): number => {
    return content.reduce((count, node) => {
        if (Text.isText(node)) {
            return count + node.text.length;
        }
        if (Element.isElement(node) && 'children' in node) {
            return count + calculateTextLength((node as CustomElement).children);
        }
        return count;
    }, 0);
};

// --- 工具栏按钮组件 ---

interface MarkButtonProps {
    format: keyof FormattedText;
    icon: React.ReactNode;
    label: string;
}

const MarkButton: FC<MarkButtonProps> = ({ format, icon, label }) => {
    // 使用 useSlate 获取当前编辑器上下文
    const editor = useSlate();
    
    // 在渲染时实时计算 isActive
    const isActive = isMarkActive(editor, format);

    return (
        <Tooltip content={label}>
            <Button
                size="small"
                type={isActive ? 'primary' : 'default'}
                icon={icon}
                onMouseDown={event => {
                    event.preventDefault();
                    toggleMark(editor, format);
                }}
            />
        </Tooltip>
    );
};

interface BlockButtonProps {
    format: string;
    icon: React.ReactNode;
    label: string;
}

const BlockButton: FC<BlockButtonProps> = ({ format, icon, label }) => {
    // 使用 useSlate 获取当前编辑器上下文
    const editor = useSlate();
    
    const isAlignFormat = TEXT_ALIGN_TYPES.includes(format as TextAlign);
    const isActive = isBlockActive(
        editor,
        format,
        isAlignFormat ? 'align' : 'type'
    );

    return (
        <Tooltip content={label}>
            <Button
                size="small"
                type={isActive ? 'primary' : 'default'}
                icon={icon}
                onMouseDown={event => {
                    event.preventDefault();
                    toggleBlock(editor, format);
                }}
            />
        </Tooltip>
    );
};

// 超链接按钮
const LinkButton: FC = () => {
    const editor = useSlate();
    const [visible, setVisible] = useState(false);
    const [url, setUrl] = useState('');

    const handleInsertLink = () => {
        if (url.trim()) {
            insertLink(editor, url);
            setUrl('');
            setVisible(false);
        }
    };

    return (
        <>
            <Tooltip content="插入链接">
                <Button
                    size="small"
                    type="default"
                    icon={<IconLink />}
                    onClick={() => setVisible(true)}
                />
            </Tooltip>
            <Modal
                title="插入链接"
                visible={visible}
                onOk={handleInsertLink}
                onCancel={() => setVisible(false)}
            >
                <Input
                    placeholder="请输入链接地址 (如: https://example.com)"
                    value={url}
                    onChange={setUrl}
                    onPressEnter={handleInsertLink}
                />
            </Modal>
        </>
    );
};

// 水平分割线按钮
const HorizontalRuleButton: FC = () => {
    const editor = useSlate();

    return (
        <Tooltip content="插入分割线">
            <Button
                size="small"
                type="default"
                onClick={e => {
                    e.preventDefault();
                    insertHorizontalRule(editor);
                }}
            >
                分割线
            </Button>
        </Tooltip>
    );
};

// 排版设置按钮
const FormattingButton: FC = () => {
    const editor = useSlate();
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [settings, setSettings] = useState({
        lineHeight: 1.5,
        marginBottom: 0.5,
        textIndent: 0,
        letterSpacing: 0,
    });

    const handleApplyFormatting = () => {
        Transforms.setNodes<CustomElement>(
            editor,
            {
                lineHeight: settings.lineHeight,
                marginBottom: settings.marginBottom,
                textIndent: settings.textIndent,
                letterSpacing: settings.letterSpacing,
            },
            { match: n => Element.isElement(n) }
        );
        setDrawerVisible(false);
    };

    return (
        <>
            <Tooltip content="排版设置">
                <Button
                    size="small"
                    type="default"
                    onClick={() => setDrawerVisible(true)}
                >
                    排版
                </Button>
            </Tooltip>
            <Drawer
                title="排版设置"
                placement="right"
                onOk={handleApplyFormatting}
                onCancel={() => setDrawerVisible(false)}
                visible={drawerVisible}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <div style={{ marginBottom: 8 }}>行高: {settings.lineHeight}</div>
                        <InputNumber
                            min={1}
                            max={3}
                            step={0.1}
                            value={settings.lineHeight}
                            onChange={v => setSettings({ ...settings, lineHeight: v || 1.5 })}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 8 }}>段落间距 (em): {settings.marginBottom}</div>
                        <InputNumber
                            min={0}
                            max={2}
                            step={0.1}
                            value={settings.marginBottom}
                            onChange={v => setSettings({ ...settings, marginBottom: v || 0.5 })}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 8 }}>行缩进 (em): {settings.textIndent}</div>
                        <InputNumber
                            min={0}
                            max={2}
                            step={0.1}
                            value={settings.textIndent}
                            onChange={v => setSettings({ ...settings, textIndent: v || 0 })}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 8 }}>字间距 (px): {settings.letterSpacing}</div>
                        <InputNumber
                            min={0}
                            max={10}
                            step={0.5}
                            value={settings.letterSpacing}
                            onChange={v => setSettings({ ...settings, letterSpacing: v || 0 })}
                        />
                    </div>
                </div>
            </Drawer>
        </>
    );
};

// --- 渲染组件 ---

// 渲染块级元素（如段落、列表项、）
const ElementComponent: FC<RenderElementProps> = ({ attributes, children, element }) => {
    const customElement = element as CustomElement;

    const blockStyle = {
        lineHeight: customElement.lineHeight,
        marginBottom: customElement.marginBottom ? `${customElement.marginBottom}em` : undefined,
        textIndent: customElement.textIndent ? `${customElement.textIndent}em` : undefined,
        letterSpacing: customElement.letterSpacing ? `${customElement.letterSpacing}px` : undefined,
        textAlign: customElement.align as 'left' | 'center' | 'right' | undefined,
    };

    switch (customElement.type) {
        case 'block-quote':
            return (
                <blockquote
                    style={{
                        borderLeft: '4px solid #ddd',
                        paddingLeft: '10px',
                        color: '#666',
                        margin: '10px 0',
                        ...blockStyle,
                    }}
                    {...attributes}
                >
                    {children}
                </blockquote>
            );
        case 'bulleted-list':
            return (
                <ul style={{ paddingLeft: '1.5em', ...blockStyle }} {...attributes}>
                    {children}
                </ul>
            );
        case 'numbered-list':
            return (
                <ol style={{ paddingLeft: '1.5em', ...blockStyle }} {...attributes}>
                    {children}
                </ol>
            );
        case 'list-item':
            return <li {...attributes}>{children}</li>;
        case 'heading-one':
            return (
                <h1 style={{ margin: '1em 0 0.5em 0', ...blockStyle }} {...attributes}>
                    {children}
                </h1>
            );
        case 'heading-two':
            return (
                <h2 style={{ margin: '1em 0 0.5em 0', ...blockStyle }} {...attributes}>
                    {children}
                </h2>
            );
        case 'heading-three':
            return (
                <h3 style={{ margin: '1em 0 0.5em 0', ...blockStyle }} {...attributes}>
                    {children}
                </h3>
            );
        case 'horizontal-rule':
            return (
                <div
                    style={{
                        height: '1px',
                        backgroundColor: '#ddd',
                        margin: '1em 0',
                        cursor: 'default',
                    }}
                    {...attributes}
                    contentEditable={false}
                >
                    {children}
                </div>
            );
        case 'link':
            return (
                <a href={customElement.url} target="_blank" rel="noopener noreferrer" {...attributes}>
                    {children}
                </a>
            );
        case 'paragraph':
        default:
            return (
                <p style={{ margin: '0.5em 0', ...blockStyle }} {...attributes}>
                    {children}
                </p>
            );
    }
};

// 渲染文本节点（如加粗、斜体）
const LeafComponent: FC<RenderLeafProps> = ({ attributes, children, leaf }) => {
    if (leaf.bold) {
        children = <strong>{children}</strong>;
    }

    if (leaf.italic) {
        children = <em>{children}</em>;
    }

    if (leaf.underline) {
        children = <u>{children}</u>;
    }

    if (leaf.strikethrough) {
        children = <s>{children}</s>;
    }

    return <span {...attributes}>{children}</span>;
};

// --- 主组件 ---

interface RichTextEditorProps {
    /** 编辑器内容（JSON 格式），用于父组件的表单控制 */
    value?: Descendant[];
    /** 内容变化时的回调函数 */
    onChange?: (value: Descendant[]) => void;
}

const RichTextEditor: FC<RichTextEditorProps> = ({ value, onChange }) => {
    const editorRef = useRef<Editor | null>(null);
    const [editor] = useState(() => {
        const ed = withHistory(withReact(createEditor()));
        editorRef.current = ed;
        return ed;
    });
    const [charCount, setCharCount] = useState(0);
    const [isReady, setIsReady] = useState(false);

    const renderElement = useCallback((props: RenderElementProps) => <ElementComponent {...props} />, []);
    const renderLeaf = useCallback((props: RenderLeafProps) => <LeafComponent {...props} />, []);

    const handleChange = (newValue: Descendant[]) => {
        setCharCount(calculateTextLength(newValue));
        if (onChange && typeof onChange === 'function') {
            onChange(newValue);
        }
    };

    useEffect(() => {
        // 延迟设置 ready 状态，确保 DOM 已准备好
        const timer = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    if (!isReady) {
        return <div style={{ border: '1px solid #eee', borderRadius: 4, padding: 12 }}>初始化编辑器...</div>;
    }

    return (
        <div style={{ border: '1px solid #eee', borderRadius: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Slate editor={editor} initialValue={value?.length > 0 ? value : initialValue} onChange={handleChange}>
                {/* 工具栏 */}
                <div style={{ padding: 8, borderBottom: '1px solid #f3f3f3', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', overflowY: 'auto' }}>
                    <Space>
                        {/* 撤销/重做按钮 */}
                        <Tooltip content="撤销 (Cmd+Z)">
                            <Button
                                size="small"
                                type="default"
                                icon={<IconUndo />}
                                onMouseDown={event => {
                                    event.preventDefault();
                                    editor.undo();
                                }}
                            />
                        </Tooltip>
                        <Tooltip content="重做 (Cmd+Shift+Z)">
                            <Button
                                size="small"
                                type="default"
                                icon={<IconRedo />}
                                onMouseDown={event => {
                                    event.preventDefault();
                                    editor.redo();
                                }}
                            />
                        </Tooltip>
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        {/* 标题和引用块按钮 */}
                        <BlockButton format="heading-one" icon={<IconH1 />} label="一级标题" />
                        <BlockButton format="heading-two" icon={<IconH2 />} label="二级标题" />
                        <BlockButton format="heading-three" icon={<IconH3 />} label="三级标题" />
                        <BlockButton format="block-quote" icon={<IconQuote />} label="引用" />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        {/* 文本样式按钮 */}
                        <MarkButton format="bold" icon={<IconBold />} label="加粗" />
                        <MarkButton format="italic" icon={<IconItalic />} label="斜体" />
                        <MarkButton format="underline" icon={<IconUnderline />} label="下划线" />
                        <MarkButton format="strikethrough" icon={<IconStrikethrough />} label="删除线" />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        {/* 列表块按钮 */}
                        <BlockButton format="bulleted-list" icon={<IconUnorderedList />} label="无序列表" />
                        <BlockButton format="numbered-list" icon={<IconList />} label="有序列表" />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        {/* 文本对齐按钮 */}
                        <BlockButton format="left" icon={<IconAlignLeft />} label="左对齐" />
                        <BlockButton format="center" icon={<IconAlignCenter />} label="居中" />
                        <BlockButton format="right" icon={<IconAlignRight />} label="右对齐" />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        {/* 排版设置 */}
                        <FormattingButton />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        {/* 链接和分割线 */}
                        <LinkButton />
                        <HorizontalRuleButton />
                    </Space>
                    <div style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>
                        字符数: <strong>{charCount}</strong>
                    </div>
                </div>

                {/* 可编辑区域 */}
                <div style={{ minHeight: 200, padding: 12, flex: 1, overflow: 'auto' }}>
                    <Editable
                        renderElement={renderElement}
                        renderLeaf={renderLeaf}
                        placeholder="请输入内容..."
                        spellCheck
                        autoFocus
                        style={{ minHeight: 176 }}
                    />
                </div>
            </Slate>
        </div>
    );
};

export default RichTextEditor;
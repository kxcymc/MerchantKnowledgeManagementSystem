import React, { useCallback, FC, useState, useEffect, useMemo } from 'react';
import { createEditor, Descendant, Editor, Element, Text, Transforms } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps } from 'slate-react';
import { Button, Tooltip, Space, Divider, Modal, Input, InputNumber, Drawer, Message } from '@arco-design/web-react';
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
    IconSettings,
    IconLeft,
    IconRight,
    IconPlus,
    IconDelete,
} from '@arco-design/web-react/icon';
import { useSlate } from 'slate-react';
import { withHistory } from 'slate-history';

// --- 类型定义 ---
type TextAlign = 'left' | 'center' | 'right';

interface BaseElement {
    type: string;
    align?: TextAlign;
    lineHeight?: number;
    marginBottom?: number;
    textIndent?: number;
    letterSpacing?: number;
    children: CustomText[];
}

export type CustomElement = BaseElement &
    (| { type: 'paragraph' }
        | { type: 'block-quote' }
        | { type: 'bulleted-list' }
        | { type: 'numbered-list' }
        | { type: 'list-item' }
        | { type: 'heading-one' }
        | { type: 'heading-two' }
        | { type: 'heading-three' }
        | { type: 'horizontal-rule' }
        | { type: 'link'; url: string });

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

// 默认值
const initialValue: Descendant[] = [
    {
        type: 'paragraph',
        children: [{ text: '' }],
    },
];

// 页面设置默认值 - 移除宽高设置
const DEFAULT_PAGE_SETTINGS = {
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 20,
    marginRight: 20,
};

// --- 工具函数 ---
const LIST_TYPES = ['numbered-list', 'bulleted-list'];
const TEXT_ALIGN_TYPES: TextAlign[] = ['left', 'center', 'right'];

const toggleBlock = (editor: Editor, format: string) => {
    const isAlignFormat = TEXT_ALIGN_TYPES.includes(format as TextAlign);
    const isActive = isBlockActive(editor, format, isAlignFormat ? 'align' : 'type');
    const isList = LIST_TYPES.includes(format);

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
        newProperties = { align: isActive ? undefined : (format as TextAlign) };
    } else {
        newProperties = {
            type: isActive ? 'paragraph' : isList ? 'list-item' : (format as CustomElement['type']),
        };
    }

    Transforms.setNodes<CustomElement>(editor, newProperties);

    if (!isActive && isList) {
        const block: CustomElement = { type: format as 'bulleted-list' | 'numbered-list', children: [{ text: '' }] };
        Transforms.wrapNodes(editor, block);
    }
};

const toggleMark = (editor: Editor, format: keyof FormattedText) => {
    const isActive = isMarkActive(editor, format);
    if (isActive) {
        Editor.removeMark(editor, format);
    } else {
        Editor.addMark(editor, format, true);
    }
};

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

const isMarkActive = (editor: Editor, format: keyof FormattedText) => {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false;
};

const insertLink = (editor: Editor, url: string) => {
    if (Editor.string(editor, [])) {
        Transforms.insertNodes(editor, {
            type: 'link',
            url,
            children: [{ text: url }],
        });
    }
};

const insertHorizontalRule = (editor: Editor) => {
    const ruleNode: CustomElement = {
        type: 'horizontal-rule',
        children: [{ text: '' }],
    };
    const paragraphNode: CustomElement = {
        type: 'paragraph',
        children: [{ text: '' }],
    };
    Transforms.insertNodes(editor, [ruleNode, paragraphNode]);
};

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
    const editor = useSlate();
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
    const editor = useSlate();
    const isAlignFormat = TEXT_ALIGN_TYPES.includes(format as TextAlign);
    const isActive = isBlockActive(editor, format, isAlignFormat ? 'align' : 'type');
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
                    placeholder="请输入链接地址 (如: https://example.com )"
                    value={url}
                    onChange={setUrl}
                    onPressEnter={handleInsertLink}
                />
            </Modal>
        </>
    );
};

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

// 修改页面设置组件，移除宽高设置
const PageSettingsButton: FC<{ settings: typeof DEFAULT_PAGE_SETTINGS; onChange: (settings: typeof DEFAULT_PAGE_SETTINGS) => void }> = ({ settings, onChange }) => {
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleApply = () => {
        onChange(localSettings);
        setDrawerVisible(false);
    };

    return (
        <>
            <Tooltip content="页面设置">
                <Button
                    size="small"
                    type="default"
                    icon={<IconSettings />}
                    onClick={() => setDrawerVisible(true)}
                />
            </Tooltip>
            <Drawer
                title="页面边距设置"
                placement="right"
                onOk={handleApply}
                onCancel={() => setDrawerVisible(false)}
                visible={drawerVisible}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <div style={{ marginBottom: 8 }}>上边距 (px)</div>
                        <InputNumber
                            min={0}
                            max={100}
                            value={localSettings.marginTop}
                            onChange={v => setLocalSettings({ ...localSettings, marginTop: v || DEFAULT_PAGE_SETTINGS.marginTop })}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 8 }}>下边距 (px)</div>
                        <InputNumber
                            min={0}
                            max={100}
                            value={localSettings.marginBottom}
                            onChange={v => setLocalSettings({ ...localSettings, marginBottom: v || DEFAULT_PAGE_SETTINGS.marginBottom })}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 8 }}>左边距 (px)</div>
                        <InputNumber
                            min={0}
                            max={100}
                            value={localSettings.marginLeft}
                            onChange={v => setLocalSettings({ ...localSettings, marginLeft: v || DEFAULT_PAGE_SETTINGS.marginLeft })}
                        />
                    </div>
                    <div>
                        <div style={{ marginBottom: 8 }}>右边距 (px)</div>
                        <InputNumber
                            min={0}
                            max={100}
                            value={localSettings.marginRight}
                            onChange={v => setLocalSettings({ ...localSettings, marginRight: v || DEFAULT_PAGE_SETTINGS.marginRight })}
                        />
                    </div>
                </div>
            </Drawer>
        </>
    );
};

// --- 渲染组件 ---
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

const LeafComponent: FC<RenderLeafProps> = ({ attributes, children, leaf }) => {
    if (leaf.bold) children = <strong>{children}</strong>;
    if (leaf.italic) children = <em>{children}</em>;
    if (leaf.underline) children = <u>{children}</u>;
    if (leaf.strikethrough) children = <s>{children}</s>;
    return <span {...attributes}>{children}</span>;
};

// --- 主组件 ---
interface RichTextEditorProps {
    value?: Descendant[];
    onChange?: (value: Descendant[]) => void;
}

const RichTextEditor: FC<RichTextEditorProps> = ({ value, onChange }) => {
    // 状态管理：pages 存储所有页面的数据，Descendant[][] 结构
    const [pages, setPages] = useState<Descendant[][]>(() => value && value.length > 0 ? [value] : [initialValue]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);

    // 为每一页创建一个独立的 editor 实例，依赖于 currentPageIndex，保证历史记录不混淆
    const editor = useMemo(() => {
        const ed = withHistory(withReact(createEditor()));
        const { isVoid } = ed;
        ed.isVoid = (element) => {
            return element.type === 'horizontal-rule' || isVoid(element);
        };
        return ed;
    }, []);

    const [charCount, setCharCount] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [pageSettings, setPageSettings] = useState(DEFAULT_PAGE_SETTINGS);

    const renderElement = useCallback((props: RenderElementProps) => <ElementComponent {...props} />, []);
    const renderLeaf = useCallback((props: RenderLeafProps) => <LeafComponent {...props} />, []);

    // 处理当前页面的内容变更
    const handleChange = (newValue: Descendant[]) => {
        const newPages = [...pages];
        newPages[currentPageIndex] = newValue;
        setPages(newPages);
        setCharCount(calculateTextLength(newValue));
        
        // 简单触发外部 onChange，回传当前页数据（如果需要回传所有页，需要修改 Props 定义）
        if (onChange && typeof onChange === 'function') {
            onChange(newValue);
        }
    };

    // 切换上一页
    const handlePrevPage = () => {
        if (currentPageIndex > 0) {
            setCurrentPageIndex(prev => prev - 1);
        }
    };

    // 切换下一页
    const handleNextPage = () => {
        if (currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(prev => prev + 1);
        }
    };

    // 新增页面
    const handleAddPage = () => {
        setPages(prev => [...prev, initialValue]);
        setCurrentPageIndex(pages.length); // 切换到新页面
        Message.success('已新增页面');
    };

    // 删除当前页
    const handleDeletePage = () => {
        if (pages.length <= 1) {
            Message.warning('至少保留一页');
            return;
        }
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除第 ${currentPageIndex + 1} 页吗？此操作无法撤销。`,
            onOk: () => {
                const newPages = pages.filter((_, index) => index !== currentPageIndex);
                setPages(newPages);
                // 如果删除的是最后一页，向前移动；否则停留在当前索引（即原来的下一页）
                if (currentPageIndex >= newPages.length) {
                    setCurrentPageIndex(newPages.length - 1);
                } else {
                    // 强制刷新 editor 状态
                    // 由于 key={currentPageIndex} 可能没变，但内容变了，这里 index 没变但内容变了
                    // 依赖 Slate 的 initialValue 变化通常需要 key 变化或者重置
                    // 在这种情况下，我们可能需要临时重置一下 index 或者 key 策略
                }
                Message.success('页面已删除');
            }
        });
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // 更新字符数统计
    useEffect(() => {
        const currentContent = pages[currentPageIndex] || initialValue;
        setCharCount(calculateTextLength(currentContent));
    }, [pages, currentPageIndex]);

    if (!isReady) {
        return <div style={{ border: '1px solid #eee', borderRadius: 4, padding: 12 }}>初始化编辑器...</div>;
    }

    // 修改编辑器样式，改为继承父级宽高
    const editorStyle: React.CSSProperties = {
        width: '100%',
        height: '586px',
        padding: `${pageSettings.marginTop}px ${pageSettings.marginRight}px ${pageSettings.marginBottom}px ${pageSettings.marginLeft}px`,
        background: '#fff',
        boxSizing: 'border-box',
    };

    return (
        <div style={{ border: '1px solid #eee', borderRadius: 4, display: 'flex', flexDirection: 'column', height: 'inherit', width:'inherit', overflow: 'hidden' }}>
            {/* 使用 key 强制重新渲染 Slate 组件，以实现页面切换 */}
            <Slate 
                key={currentPageIndex} 
                editor={editor} 
                initialValue={pages[currentPageIndex] || initialValue} 
                onChange={handleChange}
            >
                {/* 工具栏 */}
                <div style={{ padding: 8, borderBottom: '1px solid #f3f3f3', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', overflowY: 'auto' }}>
                    <Space>
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
                        <BlockButton format="heading-one" icon={<IconH1 />} label="一级标题" />
                        <BlockButton format="heading-two" icon={<IconH2 />} label="二级标题" />
                        <BlockButton format="heading-three" icon={<IconH3 />} label="三级标题" />
                        <BlockButton format="block-quote" icon={<IconQuote />} label="引用" />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        <MarkButton format="bold" icon={<IconBold />} label="加粗" />
                        <MarkButton format="italic" icon={<IconItalic />} label="斜体" />
                        <MarkButton format="underline" icon={<IconUnderline />} label="下划线" />
                        <MarkButton format="strikethrough" icon={<IconStrikethrough />} label="删除线" />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        <BlockButton format="bulleted-list" icon={<IconUnorderedList />} label="无序列表" />
                        <BlockButton format="numbered-list" icon={<IconList />} label="有序列表" />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        <BlockButton format="left" icon={<IconAlignLeft />} label="左对齐" />
                        <BlockButton format="center" icon={<IconAlignCenter />} label="居中" />
                        <BlockButton format="right" icon={<IconAlignRight />} label="右对齐" />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        <FormattingButton />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        <LinkButton />
                        <HorizontalRuleButton />
                    </Space>
                    <Divider type="vertical" style={{ margin: 0 }} />
                    <Space>
                        <PageSettingsButton settings={pageSettings} onChange={setPageSettings} />
                    </Space>
                </div>

                {/* 可编辑区域 */}
                <div style={{ flex: 1, overflow: 'auto', background: '#f5f5f5', padding: '20px' }}>
                    <div style={editorStyle}>
                        <Editable
                            renderElement={renderElement}
                            renderLeaf={renderLeaf}
                            placeholder="请输入内容..."
                            spellCheck
                            autoFocus
                        />
                    </div>
                </div>

                {/* 底部页面控制栏 */}
                <div style={{ padding: '8px 16px', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
                    <Space>
                        <Tooltip content="上一页">
                            <Button 
                                size="small" 
                                icon={<IconLeft />} 
                                onClick={handlePrevPage} 
                                disabled={currentPageIndex === 0}
                            />
                        </Tooltip>
                        <span style={{ fontSize: 12, fontWeight: 'bold', minWidth: 60, textAlign: 'center' }}>
                            {currentPageIndex + 1} / {pages.length}
                        </span>
                        <Tooltip content="下一页">
                            <Button 
                                size="small" 
                                icon={<IconRight />} 
                                onClick={handleNextPage} 
                                disabled={currentPageIndex === pages.length - 1}
                            />
                        </Tooltip>
                        <Divider type="vertical" />
                        <Tooltip content="新增页面">
                            <Button size="small" type="primary" icon={<IconPlus />} onClick={handleAddPage}>
                                新增页
                            </Button>
                        </Tooltip>
                        <Tooltip content="删除当前页">
                            <Button 
                                size="small" 
                                status="danger" 
                                icon={<IconDelete />} 
                                onClick={handleDeletePage}
                                disabled={pages.length <= 1}
                            />
                        </Tooltip>
                    </Space>
                    <div style={{ fontSize: 12, color: '#999' }}>
                        字符数: <strong>{charCount}</strong>
                    </div>
                </div>
            </Slate>
        </div>
    );
};

export default RichTextEditor;
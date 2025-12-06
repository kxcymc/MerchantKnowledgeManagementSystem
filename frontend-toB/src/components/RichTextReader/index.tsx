import React, { useCallback, FC, useState, useEffect, useRef, useMemo } from 'react';
import { createEditor, Descendant, Editor } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps } from 'slate-react';
import { withHistory } from 'slate-history';
import { Button, Space, Typography, Divider } from '@arco-design/web-react';

import styles from './style/index.module.less';
import { IconLeft, IconRight } from '@arco-design/web-react/icon';

// 复用编辑器的类型定义（保持不变）
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

type CustomElement = BaseElement &
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
                        borderLeft: '4px solid var(--color-border-2)',
                        paddingLeft: '10px',
                        color: 'var(--color-text-2)',
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
                        backgroundColor: 'var(--color-border-2)',
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
                <p style={{ margin: '0.5em 0', color: 'var(--color-text-1)', ...blockStyle }} {...attributes}>
                    {children}
                </p>
            );
    }
};

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

// 预览组件 props
interface RichTextReaderProps {
    /** Slate JSON 数据；支持单页 `Descendant[]` 或 多页 `Descendant[][]` */
    value: Descendant[] | Descendant[][];
    /** 是否显示预览标题栏 */
    showNavBtn?: boolean;
    /** 自定义样式 */
    style?: React.CSSProperties;
    /** 自定义类名 */
    className?: string;
}

/**
 * 富文本预览组件 - 只读模式
 * 接收 Slate JSON 数据并渲染为不可编辑的文档
 */
const RichTextReader: FC<RichTextReaderProps> = ({
    value,
    style,
    className,
    showNavBtn = true,
}) => {
    const editorRef = useRef<Editor | null>(null);
    const [editor] = useState(() => {
        const ed = withHistory(withReact(createEditor()));
        editorRef.current = ed;
        return ed;
    });
    const [isReady, setIsReady] = useState(false);

    const pages: Descendant[][] = useMemo(() => {
        return Array.isArray(value) && value.length > 0 && Array.isArray(value[0])
            ? (value as Descendant[][])
            : [(value as Descendant[]) || [{ type: 'paragraph', children: [{ text: '' }] }]];
    }, [value]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);

    const calculateTextLength = useCallback((content: Descendant[]): number => {
        return content.reduce((count, node) => {
            // Text node
            if ('text' in node && typeof node.text === 'string') return count + node.text.length;
            // Element node
            if ('children' in node && Array.isArray(node.children)) return count + calculateTextLength(node.children);
            return count;
        }, 0);
    }, []);

    const [charCount, setCharCount] = useState(() => calculateTextLength(pages[currentPageIndex] || []));

    useEffect(() => {
        setCharCount(calculateTextLength(pages[currentPageIndex] || []));
    }, [pages, currentPageIndex, calculateTextLength]);

    const renderElement = useCallback((props: RenderElementProps) => <ElementComponent {...props} />, []);
    const renderLeaf = useCallback((props: RenderLeafProps) => <LeafComponent {...props} />, []);

    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 0);
        return () => clearTimeout(timer);
    }, []);

    if (!isReady) {
        return <div className={styles.loading}>加载预览中...</div>;
    }

    return (
        <div
            className={`${styles.readerContainer} ${className || ''}`}
            style={style}
        >

            <div className={styles.header}>
                <Space className={styles.headerContent}>
                    <Space className={styles.navGroup}>
                        {showNavBtn && (
                            <>
                                <Button
                                    onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                                    disabled={currentPageIndex === 0}
                                    size="large"
                                    type='primary'
                                    icon={<IconLeft />}
                                >
                                    上一页
                                </Button>
                                <Button
                                    onClick={() => setCurrentPageIndex(p => Math.min(pages.length - 1, p + 1))}
                                    disabled={currentPageIndex >= pages.length - 1}
                                    size="large"
                                    type='primary'
                                >
                                    下一页<IconRight />
                                </Button>
                            </>
                        )}
                        <Typography.Text className={styles.pageInfo}>
                            第 {currentPageIndex + 1} / {pages.length} 页
                        </Typography.Text>
                    </Space>

                    <Typography.Text className={styles.charCount}>
                        字符数: {charCount}
                    </Typography.Text>
                </Space>
            </div>
            <Divider style={{ margin: 0 }} />


            <Slate
                key={`${currentPageIndex}-${value ? 'loaded' : 'empty'}-${pages.length}`} // 强制重新渲染当数据加载完成
                editor={editor}
                initialValue={pages[currentPageIndex] || [{ type: 'paragraph', children: [{ text: '' }] }]}
            >
                {/* 可编辑区域 - 只读模式 */}
                <div className={styles.contentWrapper}>
                    <Editable
                        renderElement={renderElement}
                        renderLeaf={renderLeaf}
                        readOnly={true}
                        className={styles.editableArea}
                    />
                </div>
            </Slate>
        </div>
    );
};

export default RichTextReader;
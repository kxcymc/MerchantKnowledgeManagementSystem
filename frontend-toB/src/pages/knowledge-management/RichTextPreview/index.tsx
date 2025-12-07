import React, { useContext, useEffect, useState } from "react";
import { useHistory, useLocation } from 'react-router-dom';
import styles from './style/index.module.less';
import RichTextReader from "@/components/RichTextReader";
import { Button, Modal, Message, Spin } from "@arco-design/web-react";
import { GlobalContext } from '@/context';
import { Descendant } from 'slate';
import { emptyData } from "@/constant";


const RichTextPreview = () => {
    const location = useLocation();
    const history = useHistory();
    const { theme, setTheme } = useContext(GlobalContext);
    const knowledgeIdParam = new URLSearchParams(location.search).get('knowledge_id');
    const [content, setContent] = useState<Descendant[][] | Descendant[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!knowledgeIdParam || Number.isNaN(Number(knowledgeIdParam))) {
            history.replace(`expection/404?errRoute=${encodeURIComponent(JSON.stringify([location.pathname, location.search].join('')))}`);
            return;
        }

        const fetchContent = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`/api/query?knowledge_id=${knowledgeIdParam}`);
                
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || '获取内容失败');
                }

                const data = await res.json();
                
                // 检查是否是富文本类型
                if (data.type !== 'json') {
                    setError('该文档不是富文本类型，无法预览');
                    setContent(null);
                    return;
                }

                // 解析 content 字段
                if (data.content) {
                    // content 可能是 Descendant[][] 或 Descendant[]
                    // RichTextReader 组件可以处理这两种格式
                    setContent(data.content);
                } else {
                    setError('该文档没有内容');
                    setContent(null);
                }
            } catch (err) {
                console.error('获取富文本内容失败:', err);
                setError(err instanceof Error ? err.message : '获取内容失败');
                setContent(null);
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [knowledgeIdParam, history, location.pathname, location.search]);

    useEffect(() => {
        if (theme==='dark'){
            Modal.confirm({
                title: '建议',
                content: (
                    <div style={{ textAlign: 'center' }}>
                        建议切换为亮色模式，获取更好预览效果。
                    </div>
                ),
                okText: '切换',
                onOk: () => setTheme('light'),
            });
        }
    }, [theme, setTheme])

    const handleBack = () => {
        if (history.length > 1) {
            history.goBack();
        } else {
            history.replace('/');
        }
    };

    // 默认值：空内容
    const defaultContent: Descendant[] = emptyData as Descendant[];

    return (
        <div className={styles.wrapper}>
            <Button key="back" type="outline" onClick={handleBack} className={styles.backBtn}>
                返回
            </Button>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <Spin size="large" />
                </div>
            ) : error ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <Message type="error" content={error} />
                </div>
            ) : content ? (
                <RichTextReader value={content}></RichTextReader>
            ) : (
                <RichTextReader value={defaultContent}></RichTextReader>
            )}
        </div>
    );
}

export default RichTextPreview;
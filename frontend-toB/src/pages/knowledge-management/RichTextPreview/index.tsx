import React, { useContext, useEffect, useState } from "react";
import { useHistory, useLocation } from 'react-router-dom';
import styles from './style/index.module.less';
import RichTextReader from "@/components/RichTextReader";
import { RICH_TEXT_MULTIPLE_DATA, RICH_TEXT_SINGLE_DATA, EMPTY_DOCUMENT } from "@/constant";
import { Button, Modal } from "@arco-design/web-react";
import { GlobalContext } from '@/context';
import { getKnowledgeDetail } from '@/api';
import type { Descendant } from 'slate';


const RichTextPreview = () => {
    const location = useLocation();
    const history = useHistory();
    const { theme, setTheme } = useContext(GlobalContext);
    const knowledgeIdParam = new URLSearchParams(location.search).get('knowledge_id');
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

    const [content, setContent] = React.useState<Descendant[]>(EMPTY_DOCUMENT);

    useEffect(() => {
        if (knowledgeIdParam) {
            getKnowledgeDetail({ knowledge_id: Number(knowledgeIdParam) })
                .then(res => {
                    if (res.data && res.data.content) {
                        let contentData = res.data.content;
                        if (typeof contentData === 'string') {
                            try {
                                contentData = JSON.parse(contentData);
                            } catch (e) {
                                console.error('Parse content error', e);
                            }
                        }
                        setContent(contentData);
                    }
                })
                .catch(err => {
                    console.error(err);
                });
        }

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
    }, [knowledgeIdParam])
    const handleBack = () => {
        if (history.length > 1) {
            history.goBack();
        } else {
            history.replace('/');
        }
    };

    return (
        <div className={styles.wrapper}>
            <Button key="back" type="outline" onClick={handleBack} className={styles.backBtn}>
                返回
            </Button>
            {/* <RichTextReader value={RICH_TEXT_SINGLE_DATA} showNavBtn={false}></RichTextReader> */}
            <RichTextReader 
                value={content} 
                showNavBtn={Array.isArray(content) && Array.isArray(content[0]) && content.length > 1}
            />
        </div>
    );
}

export default RichTextPreview;
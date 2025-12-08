import React, { useContext, useEffect, useState } from "react";
import { useHistory, useLocation } from 'react-router-dom';
import styles from './style/index.module.less';
import RichTextReader from "@/components/RichTextReader";
import { EMPTY_DOCUMENT } from "@/constant";
import { Button, Modal, Spin } from "@arco-design/web-react";
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
    const [content, setContent] = useState<Descendant[] | Descendant[][] | null>(null);

    useEffect(() => {
        if (!knowledgeIdParam || Number.isNaN(Number(knowledgeIdParam))) {
            history.replace(`expection/404?errRoute=${encodeURIComponent(JSON.stringify([location.pathname, location.search].join('')))}`);
            return;
        }

        const fetchContent = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const res = await getKnowledgeDetail({ knowledge_id: Number(knowledgeIdParam) });
                
                console.log('API Response:', res); // 调试日志
                
                if (res.data && res.data.content) {
                    let contentData = res.data.content;
                    
                    // 如果 content 是字符串，尝试解析
                    if (typeof contentData === 'string') {
                        try {
                            contentData = JSON.parse(contentData);
                        } catch (e) {
                            console.error('Parse content error', e);
                            setError('内容解析失败');
                            return;
                        }
                    }
                    
                    console.log('Parsed content:', contentData); // 调试日志
                    setContent(contentData);
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
        if (theme === 'dark') {
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
    }, [theme, setTheme]);

    const handleBack = () => {
        if (history.length > 1) {
            history.goBack();
        } else {
            history.replace('/');
        }
    };

    // 判断是否显示导航按钮
    const shouldShowNavBtn = content && Array.isArray(content) && content.length > 1 && Array.isArray(content[0]);

    return (
        <div className={styles.wrapper}>
            <Button key="back" type="outline" onClick={handleBack} className={styles.backBtn}>
                返回
            </Button>
            
            {loading && (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Spin size={40} />
                    <div style={{ marginTop: '20px' }}>加载中...</div>
                </div>
            )}
            
            {error && (
                <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
                    {error}
                </div>
            )}
            
            {!loading && !error && content && (
                <RichTextReader 
                    value={content} 
                    showNavBtn={shouldShowNavBtn}
                />
            )}
        </div>
    );
}

export default RichTextPreview;
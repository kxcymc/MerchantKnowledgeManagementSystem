import React, { useContext, useEffect } from "react";
import { useHistory, useLocation } from 'react-router-dom';
import styles from './style/index.module.less';
import RichTextReader from "@/components/RichTextReader";
import { RICH_TEXT_MULTIPLE_DATA, RICH_TEXT_SINGLE_DATA } from "@/constant";
import { Button, Modal } from "@arco-design/web-react";
import { GlobalContext } from '@/context';


const RichTextPreview = () => {
    const location = useLocation();
    const history = useHistory();
    const { theme, setTheme } = useContext(GlobalContext);
    const knowledgeIdParam = new URLSearchParams(location.search).get('knowledge_id');
    if (!knowledgeIdParam || Number.isNaN(Number(knowledgeIdParam))) {
        history.replace(`expection/404?errRoute=${encodeURIComponent(JSON.stringify([location.pathname, location.search].join('')))}`);
    }

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
    }, [])
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
            <RichTextReader value={RICH_TEXT_MULTIPLE_DATA}></RichTextReader>
        </div>
    );
}

export default RichTextPreview;
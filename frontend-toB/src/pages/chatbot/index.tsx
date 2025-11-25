import React from 'react';
import { Card, Typography } from '@arco-design/web-react';
import useLocale from '@/utils/useLocale';
import locale from './locale';

export default function QAchatbot() {
    const t = useLocale(locale);
    return (
        <div style={{ padding: 24 }}>
            <Card>
                <Typography.Title heading={5} style={{ marginTop: 0 }}>
                    {t['chatbot.title']}
                </Typography.Title>
                <Typography.Paragraph>{t['chatbot.desc']}</Typography.Paragraph>
            </Card>
        </div>
    );
}

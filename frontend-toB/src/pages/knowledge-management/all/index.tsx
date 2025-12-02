import React, { useEffect, useState } from 'react';
import { Card, Typography, Table, Button, Tag, Popconfirm, Message } from '@arco-design/web-react';
import useLocale from '@/utils/useLocale';
import locale from '../locale';

type Knowledge = {
    knowledge_id: string;
    title: string;
    scene_id: string;
    type: string;
    file_size: string;
    created_at: string;
    status: string;
};

export default function KnowledgeAll() {
    const t = useLocale(locale);
    const [data, setData] = useState<Knowledge[]>([]);

    const fetchList = async () => {
        try {
            const res = await fetch('/api/knowledge');
            const json = await res.json();
            if (json && json.data) {
                setData(json.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchList();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.code === 0) {
                Message.success('删除成功');
                setData((prev) => prev.filter((i) => i.knowledge_id !== id));
            } else {
                Message.error('删除失败');
            }
        } catch (err) {
            Message.error('删除出错');
        }
    };

    const columns = [
        {
            title: '标题',
            dataIndex: 'title',
            render: (col, row) => <a>{col}</a>,
        },
        { title: '场景', dataIndex: 'scene_id' },
        { title: '类型', dataIndex: 'type' },
        { title: '大小', dataIndex: 'file_size' },
        { title: '创建时间', dataIndex: 'created_at' },
        {
            title: '状态',
            dataIndex: 'status',
            render: (status) => (
                <Tag color={status === '生效中' ? 'green' : 'grey'}>{status}</Tag>
            ),
        },
        {
            title: '操作',
            dataIndex: 'op',
            render: (_, row) => (
                <>
                    <Button type="text" onClick={() => window.location.pathname = '/knowledge-creation'}>编辑</Button>
                    <Popconfirm
                        title="确认删除？"
                        onOk={() => handleDelete(row.knowledge_id)}
                    >
                        <Button type="text" status="danger">删除</Button>
                    </Popconfirm>
                </>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Typography.Title heading={5} style={{ marginTop: 0 }}>
                            {t['knowledgeManagement.all.title']}
                        </Typography.Title>
                        <Typography.Paragraph>{t['knowledgeManagement.all.desc']}</Typography.Paragraph>
                    </div>
                    <div>
                        <Button type="primary" onClick={() => (window.location.pathname = '/knowledge-creation')}>新建知识</Button>
                    </div>
                </div>

                <Table
                    style={{ marginTop: 16 }}
                    rowKey="knowledge_id"
                    data={data}
                    columns={columns}
                />
            </Card>
        </div>
    );
}

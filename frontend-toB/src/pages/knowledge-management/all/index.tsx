import React, { useEffect, useState } from 'react';
import { Card, Typography, Table, Button, Tag, Message, Modal } from '@arco-design/web-react';
import { knowledgeList, KnowledgeDoc } from '@/constant';
import { useHistory } from 'react-router-dom';



export default function KnowledgeAll() {
    const [data, setData] = useState<KnowledgeDoc[]>(knowledgeList);
    const history = useHistory();

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

    const handleDelete = async (id: string, title: string) => {
        const del = async () => {
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
        }
        Modal.confirm({
            title: '二次确认',
            content: (
                <div style={{ textAlign: 'center' }}>
                    {`确定要删除《${title}》吗？`}
                </div>
            ),
            onOk: del,
        });
    };

    const columns = [
        {
            title: '文档标题',
            dataIndex: 'title',
            render: (col, row) => <a>{col}</a>,
        },
        { title: '所属业务', dataIndex: 'business' },
        {
            title: '所属场景',
            dataIndex: 'scene',
            render: (scene) => (
                <>{scene ? scene : '在该业务下通用'}</>
            )
        },
        { title: '文档类型', dataIndex: 'type' },
        { title: '文档大小', dataIndex: 'file_size' },
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
                    <Button type="text" onClick={() => history.push('/knowledge-creation')}>编辑</Button>
                    <Button type="text" status="danger" onClick={() => handleDelete(row.knowledge_id, row.title)}>删除</Button>
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
                            全部
                        </Typography.Title>
                        <Typography.Paragraph>知识文档列表</Typography.Paragraph>
                    </div>
                    <div>
                        <Button type="primary" onClick={() => history.push('/knowledge-creation')}>新建知识</Button>
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

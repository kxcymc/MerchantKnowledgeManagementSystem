import React, { useEffect, useState } from 'react';
import {
    Card,
    Typography,
    Table,
    Button,
    Tag,
    Message,
    Modal,
    PaginationProps,
    Space
} from '@arco-design/web-react';
import { IconPlus } from '@arco-design/web-react/icon';
import { knowledgeList, KnowledgeDoc } from '@/constant';
import { useHistory } from 'react-router-dom';
import SearchForm from './form';
import styles from './style/index.module.less';

const { Title } = Typography;

export default function KnowledgeAll() {
    const [data, setData] = useState<KnowledgeDoc[]>(knowledgeList);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState<PaginationProps>({
        sizeCanChange: true,
        showTotal: true,
        pageSize: 10,
        current: 1,
        pageSizeChangeResetCurrent: true,
    });
    const [formParams, setFormParams] = useState({});
    const history = useHistory();

    const fetchList = async () => {
        setLoading(true);
        try {
            const { current, pageSize } = pagination;
            const query = new URLSearchParams({
                page: String(current),
                pageSize: String(pageSize),
                ...formParams
            }).toString();

            const res = await fetch(`/api/knowledge?${query}`);
            const json = await res.json();
            if (json && json.data) {
                setData(json.data);
                if (json.total) {
                    setPagination((prev) => ({ ...prev, total: json.total }));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [pagination.current, pagination.pageSize, JSON.stringify(formParams)]);

    const handleDelete = async (id: string, title: string) => {
        const del = async () => {
            try {
                // const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
                // const json = await res.json();
                // if (json.code === 0) {
                //     Message.success('删除成功');
                //     setData((prev) => prev.filter((i) => i.knowledge_id !== id));
                // } else {
                //     Message.error('删除失败');
                // }
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

    function onChangeTable(pagination) {
        setPagination(pagination);
    }

    function handleSearch(params) {        
        setPagination({ ...pagination, current: 1 });
        setFormParams(params);
    }

    const columns = [
        {
            title: '文档标题',
            dataIndex: 'title',
            render: (col) => <Typography.Text copyable>{col}</Typography.Text>,
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
        {
            title: '文档大小',
            dataIndex: 'file_size',
            sorter: (a, b) => {
                const toBytes = (sizeStr) => {
                    const match = sizeStr.toString().trim().match(/^([\d.]+)\s*([a-zA-Z]+)$/);
                    if (!match) return parseFloat(sizeStr) || 0;

                    const num = parseFloat(match[1]);
                    const unit = match[2].toLowerCase();

                    const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
                    return num * (units[unit] || 1);
                };

                return toBytes(a.file_size) - toBytes(b.file_size);
            }
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        },
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
        <Card>
            <Title heading={6}>全部知识文档</Title>
            <SearchForm onSearch={handleSearch} />
            <div className={styles['button-group']}>
                <Space>
                    <Button type="primary" icon={<IconPlus />} onClick={() => history.push('/knowledge-creation')}>
                        新建知识
                    </Button>
                </Space>
            </div>
            <Table
                rowKey="knowledge_id"
                loading={loading}
                onChange={onChangeTable}
                pagination={pagination}
                data={data}
                columns={columns}
            />
        </Card>
    );
}
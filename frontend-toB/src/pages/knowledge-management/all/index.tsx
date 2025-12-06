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
import { getKnowledgeList, deleteKnowledge, getFileUrl } from '@/api';

export default function KnowledgeAll() {
    const [data, setData] = useState<KnowledgeDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState<PaginationProps>({
        sizeCanChange: true,
        showTotal: true,
        pageSize: 10,
        current: 1,
        pageSizeChangeResetCurrent: true,
    });
    const [formParams, setFormParams] = useState({});
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const history = useHistory();

    const fetchList = async () => {
        setLoading(true);
        try {
            const { current, pageSize } = pagination;
            // API returns all data, so we handle pagination on client side
            const res = await getKnowledgeList(formParams);
            
            if (res && res.data) {
                const start = (current - 1) * pageSize;
                const end = start + pageSize;
                const pageData = res.data.slice(start, end) as any;
                setData(pageData);
                setPagination((prev) => ({ ...prev, total: res.data.length }));
            }
        } catch (err) {
            console.error(err);
            Message.error('获取列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [pagination.current, pagination.pageSize, JSON.stringify(formParams)]);

    const handleBatchDelete = () => {
        if (selectedRowKeys.length === 0) {
            Message.warning('请先选择要删除的文件');
            return;
        }

        const del = async () => {
            try {
                const deletePromises = selectedRowKeys.map(id => 
                    deleteKnowledge({ knowledge_id: Number(id) })
                );
                await Promise.all(deletePromises);
                
                Message.success(`成功删除 ${selectedRowKeys.length} 个文件`);
                // Refresh list
                fetchList();
                setSelectedRowKeys([]);
            } catch (err) {
                console.error(err);
                Message.error('删除出错');
            }
        };

        Modal.confirm({
            title: '二次确认',
            content: (
                <div style={{ textAlign: 'center' }}>
                    {`确定要删除选中的 ${selectedRowKeys.length} 个文件吗？`}
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

    function previewKnowledge(id: number, type: string, url = '') {
        if (type === 'pdf' || type === 'PDF') {
            const previewUrl = getFileUrl(id);
            window.open(previewUrl, '_blank');
        } else {
            history.push(`/knowledge-management/RichTextPreview?knowledge_id=${id.toString()}`)
        }
    }

    const goEditPage = (id: number, title: string, type: string) => {
        history.push(`/knowledge-management/edit?knowledge_id=${id.toString()}&title=${title}&type=${type}`)
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
                    <Button type='secondary' onClick={() => previewKnowledge(row.knowledge_id, row.type, row.pdf_url)}>预览</Button>
                    <Button type="text" onClick={() => goEditPage(row.knowledge_id, row.title, row.type)}>编辑</Button>
                </>
            ),
        },
    ];

    return (
        <Card>
            <SearchForm onSearch={handleSearch} />
            <div className={styles['button-group']}>
                <Space>
                    <Button type="primary" icon={<IconPlus />} onClick={() => history.push('/knowledge-creation')}>
                        新建知识
                    </Button>
                </Space>
                <Space>
                    <Button type="outline" status='danger' onClick={handleBatchDelete}>
                        删除
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
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys as string[]),
                }}
            />
        </Card>
    );
}
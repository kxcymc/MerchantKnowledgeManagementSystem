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
import { KnowledgeDoc } from '@/constant';
import { useHistory, useLocation } from 'react-router-dom';
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
    const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([]);
    const history = useHistory();
    const location = useLocation();

    const fetchList = async () => {
        setLoading(true);
        try {
            const { current, pageSize } = pagination;
            // 构建查询参数（不包含分页参数，因为后端不支持分页）
            const query = new URLSearchParams({
                ...formParams
            }).toString();

            const res = await fetch(`/api/mul-query?${query}`);
            const results = await res.json();
            
            // 后端返回的是数组格式，需要在前端进行格式化
            if (Array.isArray(results)) {
                // 格式化数据
                const formattedResults = results.map(item => {
                    // 格式化文件大小
                    let fileSizeStr = '';
                    if (item.file_size) {
                        const size = parseInt(item.file_size);
                        if (size < 1024) {
                            fileSizeStr = `${size} B`;
                        } else if (size < 1024 * 1024) {
                            fileSizeStr = `${(size / 1024).toFixed(1)} KB`;
                        } else {
                            fileSizeStr = `${(size / (1024 * 1024)).toFixed(1)} MB`;
                        }
                    }
                    
                    // 格式化日期（包含小时和分钟）
                    let createdAtStr = '';
                    if (item.created_at) {
                        const date = new Date(item.created_at);
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const hours = String(date.getHours()).padStart(2, '0');
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        createdAtStr = `${year}-${month}-${day} ${hours}:${minutes}`;
                    }
                    
                    // 转换类型：后端存储的是 'pdf' 或 'json'，前端期望 'PDF' 或 '富文本'
                    let typeDisplay = item.type;
                    if (item.type === 'pdf') {
                        typeDisplay = 'PDF';
                    } else if (item.type === 'json') {
                        typeDisplay = '富文本';
                    }
                    
                    return {
                        ...item,
                        type: typeDisplay,
                        file_size: fileSizeStr,
                        pdf_url: item.file_url || '',
                        status: item.status || '生效中',
                        created_at: createdAtStr
                    };
                });
                
                // 前端分页处理
                const total = formattedResults.length;
                const offset = (current - 1) * pageSize;
                const paginatedData = formattedResults.slice(offset, offset + pageSize);
                
                setData(paginatedData);
                setPagination((prev) => ({ ...prev, total: total }));
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

    // 监听路由变化，当从其他页面跳转回来时刷新列表
    useEffect(() => {
        if (location.pathname === '/knowledge-management/all') {
            fetchList();
        }
    }, [location.pathname]);

    const handleBatchDelete = () => {
        if (selectedRowKeys.length === 0) {
            Modal.warning({
                title: '提示',
                content: (
                    <div style={{ textAlign: 'center' }}>
                        请先选择要删除的文件
                    </div>
                ),
            });
            return;
        }

        const del = async () => {
            const modal = Modal.info({
                title: '处理中',
                content: (
                    <div style={{ textAlign: 'center' }}>
                        正在删除文件...
                    </div>
                ),
                footer: null,
                closable: false,
                maskClosable: false,
                escToExit: false,
            });

            try {
                const deletePromises = selectedRowKeys.map(id => 
                    fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
                );
                const results = await Promise.all(deletePromises);
                const allSuccess = results.every(res => res.ok);
                
                modal.close();

                if (allSuccess) {
                    Modal.success({
                        title: '成功',
                        content: (
                            <div style={{ textAlign: 'center' }}>
                                {`成功删除 ${selectedRowKeys.length} 个文件`}
                            </div>
                        ),
                    });
                    setSelectedRowKeys([]);
                    // 刷新列表
                    fetchList();
                } else {
                    Modal.error({
                        title: '失败',
                        content: (
                            <div style={{ textAlign: 'center' }}>
                                部分文件删除失败
                            </div>
                        ),
                    });
                    // 即使部分失败也刷新列表
                    fetchList();
                }
            } catch (err) {
                modal.close();
                console.error(err);
                Modal.error({
                    title: '错误',
                    content: (
                        <div style={{ textAlign: 'center' }}>
                            删除出错
                        </div>
                    ),
                });
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
        if (type === 'PDF') {
            // 使用后端文件接口进行预览
            const fileUrl = `/api/file/${id}`;
            window.open(fileUrl, '_blank');
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
                    onChange: (keys) => setSelectedRowKeys(keys as (string | number)[]),
                }}
            />
        </Card>
    );
}
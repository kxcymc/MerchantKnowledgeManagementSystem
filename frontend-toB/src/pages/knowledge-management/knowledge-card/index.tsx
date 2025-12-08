import React, { useEffect, useState } from 'react';
import { Grid, Card, Input, Space, Button, Message, Modal } from '@arco-design/web-react';
import { IconPlus } from '@arco-design/web-react/icon';
import KnowledgeCard from './KnowledgeCard';
import styles from './style/index.module.less';
import { useLocation, useHistory } from 'react-router-dom';
import { RouteMap } from '@/constant';


const { Row, Col } = Grid;

const Index: React.FC = () => {
    const history = useHistory();
    const { pathname } = useLocation();
    const [businessName, setBusinessName] = useState('')
    const [sceneName, setSceneName] = useState('')
    const [fileList, setFileList] = useState([])

    useEffect(() => {
        // 路由变化时，先清空列表，避免显示旧数据
        setFileList([]);
        
        let newBusinessName = '';
        let newSceneName = '';
        
        switch (pathname.split('/').length - 1) {
            case 2:
                newBusinessName = RouteMap[pathname] || '';
                break;
            case 3:
                newBusinessName = RouteMap[pathname.replace(/\/[^/]*$/, '')] || '';
                newSceneName = RouteMap[pathname] || '';
                break;
            default:
                break;
        }
        
        // 更新状态
        setBusinessName(newBusinessName);
        setSceneName(newSceneName);
        
        // 如果没有 businessName，不获取数据
        if (!newBusinessName) {
            return;
        }
        
        // 直接从 pathname 获取数据，避免中间状态
        const fetchData = async () => {
            try {
                // 构建查询参数
                const params: Record<string, string> = {};
                if (newBusinessName) {
                    params.business = newBusinessName;
                }
                if (newSceneName) {
                    params.scene = newSceneName;
                }
                
                const query = new URLSearchParams(params).toString();
                const res = await fetch(`/api/mul-query?${query}`);
                const results = await res.json();
                
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
                            knowledge_id: item.knowledge_id,
                            type: typeDisplay,
                            file_size: fileSizeStr,
                            created_at: createdAtStr,
                            status: item.status || '生效中'
                        };
                    });
                    
                    setFileList(formattedResults);
                } else {
                    setFileList([]);
                }
            } catch (err) {
                console.error('获取知识库列表失败:', err);
                setFileList([]);
            }
        };
        
        fetchData();
    }, [pathname])

    const goEditPage = (id: number, title: string, type: string) => {
        history.push(`/knowledge-management/edit?knowledge_id=${id.toString()}&title=${title}&type=${type}`)
    }

    const deleteKnowledge = (id: number, title: string) => {
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
                const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
                modal.close();
                if (res.ok) {
                    Modal.success({
                        title: '成功',
                        content: (
                            <div style={{ textAlign: 'center' }}>
                                删除成功
                            </div>
                        ),
                    });
                    // 刷新列表
                    setFileList((prev) => prev.filter((i) => i.knowledge_id !== id));
                } else {
                    const json = await res.json();
                    Modal.error({
                        title: '失败',
                        content: (
                            <div style={{ textAlign: 'center' }}>
                                {json.message || '删除失败'}
                            </div>
                        ),
                    });
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
                console.error(err);
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

    const goCreatePage = () => {
        if (businessName) {
            if (sceneName) {
                history.push(`/knowledge-creation?businessName=${businessName}&sceneName=${sceneName}`)
            } else {
                history.push(`/knowledge-creation?businessName=${businessName}`)
            }
        } else {
            history.push(`/knowledge-creation`)
        }
    }    

    return (
        <div className={styles.container} style={{ padding: 24 }}>
            <Card bordered={false}>
                <div className={styles.tabBar}>
                    <Input.Search
                        className={styles.searchBar}
                        placeholder='输入文档名称'
                    />
                    <Space>
                        <Button type="primary" icon={<IconPlus />} onClick={() => goCreatePage()}>
                            {sceneName ? `从“${sceneName || ''}”新建文档` : `从“${businessName || ''}”新建文档`}
                        </Button>
                    </Space>
                </div>

                <div style={{ marginTop: 20 }}>
                    <Row gutter={24} className={styles['card-content']}>
                        {fileList.map((doc) => (
                            <Col key={doc.knowledge_id} xs={24} sm={12} md={8} lg={6} xl={6} xxl={6}>
                                <KnowledgeCard
                                    knowledge_id={doc.knowledge_id}
                                    title={doc.title}
                                    type={doc.type}
                                    file_size={doc.file_size}
                                    created_at={doc.created_at}
                                    status={doc.status}
                                    onEdit={() => goEditPage(doc.knowledge_id, doc.title, doc.type)}
                                    onDelete={() => deleteKnowledge(doc.knowledge_id, doc.title)}
                                />
                            </Col>
                        ))}
                    </Row>
                </div>
            </Card>
        </div>
    );
};

export default Index;
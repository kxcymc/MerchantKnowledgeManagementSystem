import React, { useEffect, useState } from 'react';
import { Grid, Card, Input, Space, Button, Message,Modal } from '@arco-design/web-react';
import { IconPlus } from '@arco-design/web-react/icon';
import KnowledgeCard from './KnowledgeCard';
import { knowledgeList } from '@/constant';
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
        switch (pathname.split('/').length - 1) {
            case 2:
                setBusinessName(RouteMap[pathname])
                break;
            case 3:
                setBusinessName(RouteMap[pathname.replace(/\/[^/]*$/, '')])
                setSceneName(RouteMap[pathname])
                break;
            default:
                break;
        }
    }, [pathname])

    useEffect(() => {
        setFileList(knowledgeList.filter((d) => {
            if (sceneName && businessName) {
                return d.business === businessName && d.scene === sceneName
            }
            if (businessName && !sceneName) {
                return d.business === businessName
            }
        }))
    }, [businessName, sceneName])

    const goEditPage = (id: number, title: string) => {
        history.push(`/knowledge-management/edit?knowledge_id=${id.toString()}&title=${title}`)
    }

    const deleteKnowledge = (id: number, title:string) => {
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


    return (
        <div className={styles.container} style={{ padding: 24 }}>
            <Card bordered={false}>
                <div className={styles.tabBar}>
                    <Input.Search
                        className={styles.searchBar}
                        placeholder='输入文档名称'
                    />
                    <Space>
                        <Button type="primary" icon={<IconPlus />} onClick={() => history.push('/knowledge-creation')}>
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
                                    onEdit={() => goEditPage(doc.knowledge_id, doc.title)}
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
import React, { useEffect, useState } from 'react';
import { Grid, Tabs, Card, Input } from '@arco-design/web-react';
import KnowledgeCard from './KnowledgeCard';
import { knowledgeList } from '@/constant';
import styles from './style/index.module.less';
import { useLocation } from 'react-router-dom';
import { RouteMap } from '@/constant';


const { Row, Col } = Grid;
const { TabPane } = Tabs;

const Index: React.FC = () => {
    const [activeTab, setActiveTab] = useState('all');
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

    useEffect(()=>{
        setFileList(knowledgeList.filter((d) => {
            if (sceneName && businessName){
                return d.business === businessName && d.scene === sceneName
            }
            if(businessName && !sceneName){
                return d.business === businessName
            }
        }))
    },[businessName,sceneName])
    

    return (
        <div className={styles.container} style={{ padding: 24 }}>
            <Card bordered={false}>
                <Tabs
                    activeTab={activeTab}
                    type="rounded"
                    onChange={setActiveTab}
                    extra={
                        <Input.Search
                            style={{ width: 240 }}
                            placeholder="搜索"
                        />
                    }
                >
                    <TabPane key="all" title="全部" />
                    <TabPane key="quality" title="内容质检" />
                    <TabPane key="service" title="服务开通" />
                    <TabPane key="rules" title="规则预置" />
                </Tabs>
                <div style={{ marginTop: 20 }}>
                    <Row gutter={24} className={styles['card-content']}>
                        {fileList.map((doc) => (
                            <Col key={doc.knowledge_id} xs={24} sm={12} md={8} lg={6} xl={6} xxl={6}>
                                <KnowledgeCard
                                    id={doc.knowledge_id}
                                    title={doc.title}
                                    type={doc.type}
                                    file_size={doc.file_size}
                                    created_at={doc.created_at}
                                    status={doc.status}
                                    onEdit={() => { }}
                                    onDelete={() => { }}
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
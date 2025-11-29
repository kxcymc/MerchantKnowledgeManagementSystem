import React from 'react';
import { Grid } from '@arco-design/web-react';
import KnowledgeCard from '../KnowledgeCard';
import { knowledgeList } from '@/constant';

const { Row, Col } = Grid;

export default function KnowledgeBusinessGrowth() {
    const data = knowledgeList.filter((d) => d.business === '经营成长');
    return (
        <div style={{ padding: 24 }}>
            <Row gutter={16}>
                {data.map((doc) => (
                    <Col key={doc.knowledge_id} span={8}>
                        <KnowledgeCard
                            id={doc.knowledge_id}
                            title={doc.title}
                            type={doc.type}
                            file_size={doc.file_size}
                            created_at={doc.created_at}
                            status={doc.status}
                        />
                    </Col>
                ))}
            </Row>
        </div>
    );
}

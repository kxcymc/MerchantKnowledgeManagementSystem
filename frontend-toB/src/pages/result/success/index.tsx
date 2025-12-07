import React, { useEffect, useState } from 'react';
import { Typography, Result, Button, Steps, Card, Space, Statistic, Grid } from '@arco-design/web-react';
import { useHistory, useLocation } from 'react-router-dom';
import axios from 'axios';
import styles from './style/index.module.less';

const Step = Steps.Step;
const { Row, Col } = Grid;

function Success() {
  const history = useHistory();
  const location = useLocation();
  const [stats, setStats] = useState<any>(null);

  // 从 URL 参数获取操作信息
  const params = new URLSearchParams(location.search);
  const operation = params.get('operation') || '知识库操作';
  const knowledgeId = params.get('knowledge_id');

  useEffect(() => {
    // 获取知识库统计信息
    const fetchStats = async () => {
      try {
        const { data } = await axios.get('/api/statistics/overview');
        if (data.success) {
          setStats(data.data);
        }
      } catch (error) {
        console.error('获取统计信息失败:', error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div>
      <div className={styles.wrapper}>
        <Result
          className={styles.result}
          status="success"
          title="操作成功"
          subTitle={`${operation}已成功完成！`}
          extra={[
            <Button 
              key="back" 
              type="primary"
              onClick={() => history.push('/knowledge-management/all')}
            >
              返回知识管理
            </Button>,
            <Button 
              key="view" 
              type="secondary"
              onClick={() => history.push('/visualization/knowledge-insight')}
            >
              查看数据统计
            </Button>,
          ]}
        />
        
        {stats && (
          <Card style={{ marginTop: 24 }}>
            <Typography.Title heading={6} style={{ marginBottom: 16 }}>
              知识库统计概览
            </Typography.Title>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="知识库总数"
                  value={stats.knowledge?.total_knowledge || 0}
                  suffix="个"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="生效中"
                  value={stats.knowledge?.active_knowledge || 0}
                  suffix="个"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="总会话数"
                  value={stats.sessions?.total_sessions || 0}
                  suffix="个"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="总引用数"
                  value={stats.citations?.total_citations || 0}
                  suffix="次"
                />
              </Col>
            </Row>
          </Card>
        )}

        {knowledgeId && (
          <div className={styles['steps-wrapper']} style={{ marginTop: 24 }}>
            <Typography.Paragraph bold>
              知识库处理流程
            </Typography.Paragraph>
            <Steps type="dot" current={4}>
              <Step
                title="上传文件"
                description="文件已上传"
              />
              <Step
                title="解析内容"
                description="内容解析完成"
              />
              <Step
                title="向量化处理"
                description="向量化完成"
              />
              <Step
                title="存储到数据库"
                description="存储完成"
              />
              <Step
                title="处理完成"
                description="知识库已就绪"
              />
            </Steps>
          </div>
        )}
      </div>
    </div>
  );
}

export default Success;
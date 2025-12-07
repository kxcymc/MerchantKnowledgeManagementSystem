import React, { useEffect, useState } from 'react';
import { Card, Grid, Space, Typography, Spin, DatePicker, Button, Message } from '@arco-design/web-react';
import axios from 'axios';
import useLocale from '@/utils/useLocale';
import locale from './locale';
import styles from './style/index.module.less';
import HotKnowledgeHeatmap from './components/HotKnowledgeHeatmap';
import TopQuestionsChart from './components/TopQuestionsChart';
import ZeroHitQuestionsTable from './components/ZeroHitQuestionsTable';

const { Row, Col } = Grid;
const { Title } = Typography;
const { RangePicker } = DatePicker;

function KnowledgeInsight() {
  const t = useLocale(locale);
  const [loading, setLoading] = useState({
    heatmap: false,
    topQuestions: false,
    zeroHit: false,
  });

  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [topQuestionsData, setTopQuestionsData] = useState<any[]>([]);
  const [zeroHitData, setZeroHitData] = useState<any[]>([]);

  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // 获取热点知识分布数据
  const fetchHeatmapData = async () => {
    setLoading((prev) => ({ ...prev, heatmap: true }));
    try {
      const params: any = { limit: 20 };
      if (dateRange) {
        params.startDate = dateRange[0];
        params.endDate = dateRange[1];
      }
      const { data } = await axios.get('/api/statistics/hot-knowledge-distribution', { params });
      if (data.success) {
        setHeatmapData(data.data || []);
      } else {
        Message.error(data.message || t['knowledgeInsight.error.fetchHeatmap']);
      }
    } catch (error: any) {
      Message.error(error.message || t['knowledgeInsight.error.fetchHeatmap']);
      console.error('获取热点知识分布失败:', error);
    } finally {
      setLoading((prev) => ({ ...prev, heatmap: false }));
    }
  };

  // 获取高频问题数据
  const fetchTopQuestionsData = async () => {
    setLoading((prev) => ({ ...prev, topQuestions: true }));
    try {
      const params: any = { limit: 10, minCount: 2 };
      if (dateRange) {
        params.startDate = dateRange[0];
        params.endDate = dateRange[1];
      }
      const { data } = await axios.get('/api/statistics/hot-professional-questions', { params });
      if (data.success) {
        setTopQuestionsData(data.data || []);
      } else {
        Message.error(data.message || t['knowledgeInsight.error.fetchTopQuestions']);
      }
    } catch (error: any) {
      Message.error(error.message || t['knowledgeInsight.error.fetchTopQuestions']);
      console.error('获取高频问题失败:', error);
    } finally {
      setLoading((prev) => ({ ...prev, topQuestions: false }));
    }
  };

  // 获取零命中问题数据
  const fetchZeroHitData = async () => {
    setLoading((prev) => ({ ...prev, zeroHit: true }));
    try {
      const params: any = { limit: 50, orderBy: 'asked_count' };
      if (dateRange) {
        params.startDate = dateRange[0];
        params.endDate = dateRange[1];
      }
      const { data } = await axios.get('/api/statistics/zero-hit-questions', { params });
      if (data.success) {
        setZeroHitData(data.data || []);
      } else {
        Message.error(data.message || t['knowledgeInsight.error.fetchZeroHit']);
      }
    } catch (error: any) {
      Message.error(error.message || t['knowledgeInsight.error.fetchZeroHit']);
      console.error('获取零命中问题失败:', error);
    } finally {
      setLoading((prev) => ({ ...prev, zeroHit: false }));
    }
  };

  // 加载所有数据
  const fetchAllData = () => {
    fetchHeatmapData();
    fetchTopQuestionsData();
    fetchZeroHitData();
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // 处理日期范围变化
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      setDateRange([startDate, endDate]);
    } else {
      setDateRange(null);
    }
  };

  // 应用筛选
  const handleApplyFilter = () => {
    fetchAllData();
  };

  // 重置筛选
  const handleResetFilter = () => {
    setDateRange(null);
    setTimeout(() => {
      fetchAllData();
    }, 100);
  };

  return (
    <Space size={16} direction="vertical" style={{ width: '100%' }}>
      {/* 页面标题和筛选器 */}
      <Card>
        <div className={styles.header}>
          <Title heading={5}>{t['knowledgeInsight.title']}</Title>
          <Space>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              placeholder={[t['knowledgeInsight.dateRange.start'], t['knowledgeInsight.dateRange.end']]}
              style={{ width: 300 }}
            />
            <Button type="primary" onClick={handleApplyFilter}>
              {t['knowledgeInsight.filter.apply']}
            </Button>
            <Button onClick={handleResetFilter}>
              {t['knowledgeInsight.filter.reset']}
            </Button>
          </Space>
        </div>
      </Card>

      {/* 热点知识分布热力图 */}
      <Card>
        <Title heading={6}>{t['knowledgeInsight.heatmap.title']}</Title>
        <div className={styles.chartContainer}>
          <Spin loading={loading.heatmap} style={{ width: '100%', minHeight: 400 }}>
            <HotKnowledgeHeatmap data={heatmapData} />
          </Spin>
        </div>
      </Card>

      <Row gutter={16}>
        {/* 高频问题 Top 10 */}
        <Col span={14}>
          <Card>
            <Title heading={6}>{t['knowledgeInsight.topQuestions.title']}</Title>
            <div className={styles.chartContainer}>
              <Spin loading={loading.topQuestions} style={{ width: '100%', minHeight: 400 }}>
                <TopQuestionsChart data={topQuestionsData} />
              </Spin>
            </div>
          </Card>
        </Col>

        {/* 统计卡片 */}
        <Col span={10}>
          <Card>
            <Title heading={6}>{t['knowledgeInsight.stats.title']}</Title>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>{t['knowledgeInsight.stats.totalKnowledge']}</div>
                <div className={styles.statValue}>{heatmapData.length}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>{t['knowledgeInsight.stats.totalQuestions']}</div>
                <div className={styles.statValue}>{topQuestionsData.length}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>{t['knowledgeInsight.stats.zeroHitCount']}</div>
                <div className={styles.statValue}>{zeroHitData.length}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>{t['knowledgeInsight.stats.totalCitations']}</div>
                <div className={styles.statValue}>
                  {heatmapData.reduce((sum, item) => sum + (item.citation_count || 0), 0)}
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 零命中问题列表 */}
      <Card>
        <Title heading={6}>{t['knowledgeInsight.zeroHit.title']}</Title>
        <Spin loading={loading.zeroHit} style={{ width: '100%' }}>
          <ZeroHitQuestionsTable data={zeroHitData} />
        </Spin>
      </Card>
    </Space>
  );
}

export default KnowledgeInsight;


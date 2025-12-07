import React, { useState, useEffect, useMemo } from 'react';
import PublicOpinionCard, { PublicOpinionCardProps } from './card';
import axios from 'axios';
import { Grid } from '@arco-design/web-react';
import useLocale from '@/utils/useLocale';
import locale from '../locale';

const { Row, Col } = Grid;

const cardInfo = [
  {
    key: 'visitor',
    type: 'line',
  },
  {
    key: 'content',
    type: 'interval',
  },
  {
    key: 'comment',
    type: 'line',
  },
  {
    key: 'share',
    type: 'pie',
  },
];

function PublicOpinion() {
  const t = useLocale(locale);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicOpinionCardProps[]>(
    cardInfo.map((item) => ({
      ...item,
      chartType: item.type as 'line' | 'pie' | 'interval',
      title: t[`dataAnalysis.publicOpinion.${item.key}`],
    }))
  );

  const getData = async () => {
    try {
      const { data } = await axios.get('/api/statistics/overview');
      if (data.success) {
        const overview = data.data;
        const result = cardInfo.map((info) => {
          let count = 0;
          let increment = true;
          let diff = 0;
          let chartData: any[] = [];

          switch (info.key) {
            case 'visitor':
              count = overview.sessions?.total_sessions || 0;
              diff = (overview.sessions?.today_sessions || 0) - (overview.sessions?.yesterday_sessions || 0);
              increment = diff >= 0;
              break;
            case 'content':
              count = overview.messages?.total_messages || 0;
              diff = overview.messages?.today_messages || 0;
              increment = true;
              break;
            case 'comment':
              count = overview.knowledge?.total_knowledge || 0;
              diff = overview.knowledge?.active_knowledge || 0;
              increment = true;
              break;
            case 'share':
              count = overview.citations?.total_citations || 0;
              diff = overview.citations?.cited_knowledge_count || 0;
              increment = true;
              break;
          }

          // 生成简单的趋势数据
          if (overview.trend && overview.trend.length > 0) {
            chartData = overview.trend.map((item: any) => ({
              count: item.count,
              date: item.date,
            }));
          }

          return {
            key: info.key,
            chartType: info.type as 'line' | 'pie' | 'interval',
            title: t[`dataAnalysis.publicOpinion.${info.key}`],
            count,
            increment,
            diff: Math.abs(diff),
            chartData,
          };
        });
        setData(result);
      }
    } catch (error) {
      console.error('获取数据概览失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getData();
  }, []);

  const formatData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      title: t[`dataAnalysis.publicOpinion.${item.key}`],
    }));
  }, [t, data]);

  return (
    <div>
      <Row gutter={20}>
        {formatData.map((item, index) => (
          <Col span={6} key={index}>
            <PublicOpinionCard
              {...item}
              compareTime={t['dataAnalysis.yesterday']}
              loading={loading}
            />
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default PublicOpinion;

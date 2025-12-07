// 数据总览
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Typography,
  Grid,
  Statistic,
  Skeleton,
} from '@arco-design/web-react';
import axios from 'axios';
import {
  IconUser,
  IconEdit,
  IconHeart,
  IconThumbUp,
} from '@arco-design/web-react/icon';
import useLocale from '@/utils/useLocale';
import locale from './locale';
import styles from './style/data-overview.module.less';
import MultiAreaLine from '@/components/Chart/multi-area-line';

const { Title } = Typography;
export default () => {
  const t = useLocale(locale);
  const [overview, setOverview] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [loading, setLoading] = useState(false);

  const getData = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/statistics/overview');
      if (data.success) {
        const overview = data.data;
        // 格式化总览数据
        const overviewData = [
          overview.messages?.total_messages || 0, // 总消息数
          overview.citations?.total_citations || 0, // 总引用数
          overview.knowledge?.total_knowledge || 0, // 总知识库数
          overview.sessions?.total_sessions || 0, // 总会话数
        ];
        
        // 格式化趋势数据
        const chartData = (overview.trend || []).map((item: any) => ({
          date: item.date,
          count: item.count,
        }));

        setLineData(chartData);
        setOverview(overviewData);
      }
    } catch (error) {
      console.error('获取数据总览失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getData();
  }, []);

  const formatedData = useMemo(() => {
    return [
      {
        title: t['multiDAnalysis.dataOverview.contentProduction'],
        icon: <IconEdit />,
        value: overview[0],
        background: 'rgb(var(--orange-2))',
        color: 'rgb(var(--orange-6))',
      },
      {
        title: t['multiDAnalysis.dataOverview.contentClicks'],
        icon: <IconThumbUp />,
        value: overview[1],
        background: 'rgb(var(--cyan-2))',
        color: 'rgb(var(--cyan-6))',
      },
      {
        title: t['multiDAnalysis.dataOverview.contextExposure'],
        value: overview[2],
        icon: <IconHeart />,
        background: 'rgb(var(--arcoblue-1))',
        color: 'rgb(var(--arcoblue-6))',
      },
      {
        title: t['multiDAnalysis.dataOverview.activeUsers'],
        value: overview[3],
        icon: <IconUser />,
        background: 'rgb(var(--purple-1))',
        color: 'rgb(var(--purple-6))',
      },
    ];
  }, [t, overview]);

  return (
    <Grid.Row justify="space-between">
      {formatedData.map((item, index) => (
        <Grid.Col span={24 / formatedData.length} key={`${index}`}>
          <Card className={styles.card} title={null}>
            <Title heading={6}>{item.title}</Title>
            <div className={styles.content}>
              <div
                style={{ backgroundColor: item.background, color: item.color }}
                className={styles['content-icon']}
              >
                {item.icon}
              </div>
              {loading ? (
                <Skeleton
                  animation
                  text={{ rows: 1, className: styles['skeleton'] }}
                  style={{ width: '120px' }}
                />
              ) : (
                <Statistic value={item.value} groupSeparator />
              )}
            </div>
          </Card>
        </Grid.Col>
      ))}
      <Grid.Col span={24}>
        <MultiAreaLine data={lineData} loading={loading} />
      </Grid.Col>
    </Grid.Row>
  );
};

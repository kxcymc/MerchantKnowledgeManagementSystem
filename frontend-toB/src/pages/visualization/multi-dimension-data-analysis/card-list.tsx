import React, { useEffect, useState, useMemo } from 'react';
import {
  Statistic,
  Typography,
  Spin,
  Grid,
  Card,
  Skeleton,
} from '@arco-design/web-react';
import cs from 'classnames';
import { Chart, Line, Interval, Tooltip, Interaction } from 'bizcharts';
import axios from 'axios';
import { IconArrowRise, IconArrowFall } from '@arco-design/web-react/icon';
import styles from './style/card-block.module.less';

const { Row, Col } = Grid;
const { Title, Text } = Typography;
const basicChartProps = {
  pure: true,
  autoFit: true,
  height: 80,
  padding: [0, 10, 0, 10],
};

export interface CardProps {
  key: string;
  title?: string;
  chartData?: any[];
  chartType: string;
  count?: number;
  increment?: boolean;
  diff?: number;
  loading?: boolean;
}

function CustomTooltip(props: { items: any[] }) {
  const { items } = props;
  return (
    <div className={styles.tooltip}>
      {items.map((item, index) => (
        <div key={index}>
          <Text bold>{Number(item.data.y).toLocaleString()}</Text>
        </div>
      ))}
    </div>
  );
}

function SimpleLine(props: { chartData: any[] }) {
  const { chartData } = props;
  return (
    <Chart data={chartData} {...basicChartProps}>
      <Line
        position="x*y"
        shape={['name', ['smooth', 'dash']]}
        color={['name', ['#165DFF', 'rgba(106,161,255,0.3)']]}
      />
      <Tooltip shared={false} showCrosshairs={true}>
        {(_, items) => <CustomTooltip items={items} />}
      </Tooltip>
    </Chart>
  );
}

function SimpleInterval(props: { chartData: any[] }) {
  const { chartData } = props;
  return (
    <Chart data={chartData} {...basicChartProps}>
      <Interval
        position="x*y"
        color={[
          'x',
          (xVal) => {
            if (Number(xVal) % 2 === 0) {
              return '#86DF6C';
            }
            return '#468DFF';
          },
        ]}
      />
      <Tooltip shared={false}>
        {(_, items) => <CustomTooltip items={items} />}
      </Tooltip>
      <Interaction type="active-region" />
    </Chart>
  );
}

function CardBlock(props: CardProps) {
  const { chartType, title, count, increment, diff, chartData, loading } =
    props;

  return (
    <Card className={styles.card}>
      <div className={styles.statistic}>
        <Statistic
          title={
            <Title heading={6} className={styles.title}>
              {title}
            </Title>
          }
          loading={loading}
          value={count}
          extra={
            <div className={styles['compare-yesterday']}>
              {loading ? (
                <Skeleton
                  text={{ rows: 1 }}
                  style={{ width: '100px' }}
                  animation
                />
              ) : (
                <span
                  className={cs(styles['diff'], {
                    [styles['diff-increment']]: increment,
                  })}
                >
                  {diff}
                  {increment ? <IconArrowRise /> : <IconArrowFall />}
                </span>
              )}
            </div>
          }
          groupSeparator
        />
      </div>
      <div className={styles.chart}>
        <Spin style={{ width: '100%' }} loading={loading}>
          {chartType === 'interval' && <SimpleInterval chartData={chartData} />}
          {chartType === 'line' && <SimpleLine chartData={chartData} />}
        </Spin>
      </div>
    </Card>
  );
}

const cardInfo = [
  {
    key: 'userRetentionTrend',
    type: 'line',
  },
  {
    key: 'userRetention',
    type: 'interval',
  },
  {
    key: 'contentConsumptionTrend',
    type: 'line',
  },
  {
    key: 'contentConsumption',
    type: 'interval',
  },
];

const titleMap: Record<string, string> = {
  userRetentionTrend: '会话趋势',
  userRetention: '会话统计',
  contentConsumptionTrend: '消息趋势',
  contentConsumption: '消息统计',
};

function CardList() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(
    cardInfo.map((item) => ({
      ...item,
      chartType: item.type,
    }))
  );

  const getData = async () => {
    setLoading(true);
    try {
      const { data: overviewData } = await axios.get('/api/statistics/overview');
      const { data: activityData } = await axios.get('/api/statistics/daily-activity');
      
      if (overviewData.success && activityData.success) {
        const overview = overviewData.data;
        const activity = activityData.data || [];
        
        const trendData = activity.map((item: any) => ({
          x: item.date,
          y: item.messages || 0,
          name: '消息数',
        }));

        const result = cardInfo.map((info) => {
          let count = 0;
          let diff = 0;
          let chartData: any[] = [];

          switch (info.key) {
            case 'userRetentionTrend':
              count = overview.sessions?.total_sessions || 0;
              diff = overview.sessions?.today_sessions || 0;
              chartData = trendData;
              break;
            case 'userRetention':
              count = overview.sessions?.total_sessions || 0;
              diff = overview.sessions?.today_sessions || 0;
              chartData = activity.slice(-7).map((item: any) => ({
                x: item.date,
                y: item.sessions || 0,
              }));
              break;
            case 'contentConsumptionTrend':
              count = overview.messages?.total_messages || 0;
              diff = overview.messages?.today_messages || 0;
              chartData = trendData;
              break;
            case 'contentConsumption':
              count = overview.messages?.total_messages || 0;
              diff = overview.messages?.today_messages || 0;
              chartData = activity.slice(-7).map((item: any) => ({
                x: item.date,
                y: item.messages || 0,
              }));
              break;
          }

          return {
            key: info.key,
            chartType: info.type,
            count,
            increment: true,
            diff,
            chartData,
          };
        });
        
        setData(result);
      }
    } catch (error) {
      console.error('获取卡片数据失败:', error);
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
      title: titleMap[item.key],
    }));
  }, [data]);

  return (
    <Row gutter={16}>
      {formatData.map((item, index) => (
        <Col span={6} key={index}>
          <CardBlock {...item} loading={loading} />
        </Col>
      ))}
    </Row>
  );
}

export default CardList;
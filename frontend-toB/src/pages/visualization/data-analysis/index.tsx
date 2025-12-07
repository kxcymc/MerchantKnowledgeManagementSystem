import React, { useEffect, useMemo, useState } from 'react';
import { Card, Grid, Table, Space, Typography, Message } from '@arco-design/web-react';
import useLocale from '@/utils/useLocale';
import axios from 'axios';
import locale from './locale';
import PublicOpinion from './public-opinion';
import MultiInterval from '@/components/Chart/multi-stack-interval';
import PeriodLine from '@/components/Chart/period-legend-line';

const { Row, Col } = Grid;

function DataAnalysis() {
  const t = useLocale(locale);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const [chartData, setChartData] = useState([]);
  const [tableData, setTableData] = useState([]);

  // 获取每日活动数据（用于图表）
  const getChartData = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/statistics/daily-activity');
      if (data.success) {
        // 转换为 MultiInterval 图表需要的格式
        const formattedData = (data.data || []).map((item: any) => ({
          time: item.date,
          messages: item.messages || 0,
          sessions: item.sessions || 0,
          count: item.messages || 0, // 用于堆叠图
        }));
        setChartData(formattedData);
      }
    } catch (error: any) {
      console.error('获取图表数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取热点知识分布（用于表格）
  const getTableData = async () => {
    setTableLoading(true);
    try {
      const { data } = await axios.get('/api/statistics/hot-knowledge-distribution', {
        params: { limit: 10 },
      });
      if (data.success) {
        // 转换为表格需要的格式
        const formattedData = (data.data || []).map((item: any, index: number) => ({
          id: index + 1,
          author: item.knowledge?.title || `知识ID: ${item.knowledge_id}`,
          contentCount: item.citation_count || 0,
          clickCount: item.message_count || 0,
        }));
        setTableData(formattedData);
      }
    } catch (error: any) {
      console.error('获取表格数据失败:', error);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    getChartData();
    getTableData();
  }, []);

  const columns = useMemo(() => {
    return [
      {
        title: t['dataAnalysis.authorTable.rank'],
        dataIndex: 'id',
        width: 80,
      },
      {
        title: t['dataAnalysis.authorTable.author'],
        dataIndex: 'author',
        ellipsis: true,
      },
      {
        title: t['dataAnalysis.authorTable.content'],
        dataIndex: 'contentCount',
        width: 150,
        sorter: (a: any, b: any) => a.contentCount - b.contentCount,
        render(x: number) {
          return Number(x).toLocaleString();
        },
      },
      {
        title: t['dataAnalysis.authorTable.click'],
        dataIndex: 'clickCount',
        width: 150,
        sorter: (a: any, b: any) => a.clickCount - b.clickCount,
        render(x: number) {
          return Number(x).toLocaleString();
        },
      },
    ];
  }, [t]);

  return (
    <Space size={16} direction="vertical" style={{ width: '100%' }}>
      <Card>
        <Typography.Title heading={6}>
          {t['dataAnalysis.title.publicOpinion']}
        </Typography.Title>
        <PublicOpinion />
      </Card>
      <Row gutter={16}>
        <Col span={14}>
          <Card>
            <Typography.Title heading={6}>
              {t['dataAnalysis.title.publishingRate']}
            </Typography.Title>
            <MultiInterval 
              data={chartData.flatMap((item: any) => [
                { time: item.time, count: item.messages || 0, name: '消息数' },
                { time: item.time, count: item.sessions || 0, name: '会话数' },
              ])} 
              loading={loading} 
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card>
            <Typography.Title heading={6}>
              {t['dataAnalysis.title.authorsList']}
            </Typography.Title>
            <div style={{ height: '370px' }}>
              <Table
                rowKey="id"
                loading={tableLoading}
                pagination={false}
                data={tableData}
                columns={columns}
              />
            </div>
          </Card>
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <Card>
            <Typography.Title heading={6}>
              {t['dataAnalysis.title.publishingTiming']}
            </Typography.Title>
            <PeriodLine 
              data={chartData.map((item: any) => ({
                time: item.time,
                rate: item.messages || 0,
                name: '消息数',
              }))} 
              loading={loading} 
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
export default DataAnalysis;

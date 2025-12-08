import React, { useEffect, useMemo, useState } from 'react';
import { Card, Grid, Table, Space, Typography } from '@arco-design/web-react';
import axios from 'axios';
import PublicOpinion from './public-opinion';
import MultiInterval from '@/components/Chart/multi-stack-interval';
import PeriodLine from '@/components/Chart/period-legend-line';

const { Row, Col } = Grid;

function DataAnalysis() {
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
        title: '排名',
        dataIndex: 'id',
        width: 80,
      },
      {
        title: '知识标题',
        dataIndex: 'author',
        ellipsis: true,
      },
      {
        title: '引用次数',
        dataIndex: 'contentCount',
        width: 150,
        sorter: (a: any, b: any) => a.contentCount - b.contentCount,
        render(x: number) {
          return Number(x).toLocaleString();
        },
      },
      {
        title: '消息数量',
        dataIndex: 'clickCount',
        width: 150,
        sorter: (a: any, b: any) => a.clickCount - b.clickCount,
        render(x: number) {
          return Number(x).toLocaleString();
        },
      },
    ];
  }, []);

  return (
    <Space size={16} direction="vertical" style={{ width: '100%' }}>
      <Card>
        <Typography.Title heading={6}>
          数据概览
        </Typography.Title>
        <PublicOpinion />
      </Card>
      <Row gutter={16}>
        <Col span={14}>
          <Card>
            <Typography.Title heading={6}>
              每日活动趋势
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
              热门知识榜单
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
              消息时段分布
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
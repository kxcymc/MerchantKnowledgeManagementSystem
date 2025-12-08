import React, { useState, useEffect } from 'react';
import { Typography, Card, Grid, Space } from '@arco-design/web-react';
import axios from 'axios';
import HorizontalInterval from '@/components/Chart/horizontal-interval';
import AreaPolar from '@/components/Chart/area-polar';
import FactMultiPie from '@/components/Chart/fact-multi-pie';
import DataOverview from './data-overview';
import CardList from './card-list';

const { Row, Col } = Grid;
const { Title } = Typography;

function DataAnalysis() {
  const [loading, setLoading] = useState(false);
  const [interval, setInterval] = useState([]);
  const [polarLoading, setPolarLoading] = useState(false);
  const [polar, setPolar] = useState({ list: [], fields: [] });
  const [multiPieLoading, setMultiPieLoading] = useState(false);
  const [multiPie, setMultiPie] = useState([]);

  // 获取每日活动数据
  const getInterval = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/statistics/daily-activity');
      if (data.success) {
        // 转换为图表需要的格式
        const formattedData = (data.data || []).map((item: any) => ({
          type: item.date,
          value: item.messages || 0,
        }));
        setInterval(formattedData);
      }
    } catch (error) {
      console.error('获取每日活动数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取业务分类数据（极坐标图）
  const getPolar = async () => {
    setPolarLoading(true);
    try {
      const { data } = await axios.get('/api/statistics/knowledge-by-business');
      if (data.success) {
        const list = (data.data || []).map((item: any) => ({
          item: item.business || '未分类',
          count: item.count || 0,
        }));
        const fields = ['item', 'count'];
        setPolar({ list, fields });
      }
    } catch (error) {
      console.error('获取业务分类数据失败:', error);
    } finally {
      setPolarLoading(false);
    }
  };

  // 获取时段分布数据（饼图）
  const getMultiPie = async () => {
    setMultiPieLoading(true);
    try {
      const { data } = await axios.get('/api/statistics/hourly-distribution');
      if (data.success) {
        // 转换为饼图需要的格式
        const formattedData = (data.data || []).map((item: any) => ({
          type: `${item.hour}时`,
          value: item.count || 0,
        }));
        setMultiPie(formattedData);
      }
    } catch (error) {
      console.error('获取时段分布数据失败:', error);
    } finally {
      setMultiPieLoading(false);
    }
  };

  useEffect(() => {
    getInterval();
    getPolar();
    getMultiPie();
  }, []);

  return (
    <Space size={16} direction="vertical" style={{ width: '100%' }}>
      <Row gutter={20}>
        <Col span={16}>
          <Card>
            <Title heading={6}>
              数据总览
            </Title>
            <DataOverview />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Title heading={6}>
              最近7天活动趋势
            </Title>
            <HorizontalInterval
              data={interval}
              loading={loading}
              height={160}
            />
          </Card>
          <Card>
            <Title heading={6}>
              知识库业务分布
            </Title>
            <AreaPolar
              data={polar.list}
              fields={polar.fields}
              height={197}
              loading={polarLoading}
            />
          </Card>
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <CardList />
        </Col>
      </Row>
      <Row>
        <Col span={24}>
          <Card>
            <Title heading={6}>
              消息时段分布
            </Title>
            <FactMultiPie
              loading={multiPieLoading}
              data={multiPie}
              height={240}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
export default DataAnalysis;
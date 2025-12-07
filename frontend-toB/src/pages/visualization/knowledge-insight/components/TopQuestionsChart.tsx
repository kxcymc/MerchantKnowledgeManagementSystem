import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Empty } from '@arco-design/web-react';

interface TopQuestionsChartProps {
  data: any[];
}

function TopQuestionsChart({ data }: TopQuestionsChartProps) {
  const option = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    // 取前10个，按问题数量排序
    const sortedData = [...data]
      .sort((a, b) => (b.question_count || 0) - (a.question_count || 0))
      .slice(0, 10)
      .reverse(); // 反转以便从下往上显示

    const questions = sortedData.map((item) => {
      const question = item.representative_question || '';
      // 如果问题太长，截断
      return question.length > 30 ? question.substring(0, 30) + '...' : question;
    });

    const questionCounts = sortedData.map((item) => item.question_count || 0);
    const sessionCounts = sortedData.map((item) => item.session_count || 0);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          const dataIndex = params[0].dataIndex;
          const item = sortedData[dataIndex];
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 8px;">${item.representative_question}</div>
              <div>提问次数: <strong>${item.question_count}</strong></div>
              <div>涉及会话: ${item.session_count}</div>
              <div>首次提问: ${item.first_asked_at ? new Date(item.first_asked_at).toLocaleDateString() : '-'}</div>
              <div>最近提问: ${item.last_asked_at ? new Date(item.last_asked_at).toLocaleDateString() : '-'}</div>
            </div>
          `;
        },
      },
      grid: {
        left: '25%',
        right: '10%',
        top: '10%',
        bottom: '10%',
      },
      xAxis: {
        type: 'value',
        name: '提问次数',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          formatter: '{value}',
        },
      },
      yAxis: {
        type: 'category',
        data: questions,
        axisLabel: {
          interval: 0,
          fontSize: 11,
        },
      },
      series: [
        {
          name: '提问次数',
          type: 'bar',
          data: questionCounts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#83bff6' },
              { offset: 0.5, color: '#188df0' },
              { offset: 1, color: '#188df0' },
            ]),
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#2378f7' },
                { offset: 0.7, color: '#2378f7' },
                { offset: 1, color: '#83bff6' },
              ]),
            },
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}',
            color: '#333',
          },
        },
        {
          name: '会话数',
          type: 'bar',
          data: sessionCounts,
          itemStyle: {
            color: '#91cc75',
            opacity: 0.7,
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}',
            color: '#333',
          },
        },
      ],
      legend: {
        data: ['提问次数', '会话数'],
        top: '5%',
      },
    };
  }, [data]);

  if (!option) {
    return (
      <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="暂无数据" />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 500, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}

export default TopQuestionsChart;


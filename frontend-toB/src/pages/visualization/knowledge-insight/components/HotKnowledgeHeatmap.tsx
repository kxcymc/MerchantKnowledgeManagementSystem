import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Empty } from '@arco-design/web-react';

interface HotKnowledgeHeatmapProps {
  data: any[];
}

function HotKnowledgeHeatmap({ data }: HotKnowledgeHeatmapProps) {
  const option = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    // 准备数据：取前20个，按引用次数排序
    const sortedData = [...data]
      .sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0))
      .slice(0, 20);

    // 构建热力图数据
    const heatmapData = sortedData.map((item, index) => [
      index,
      0,
      item.citation_count || 0,
      item.message_count || 0,
      item.session_count || 0,
      item.knowledge?.title || `知识ID: ${item.knowledge_id}`,
    ]);

    // 构建知识标题列表
    const knowledgeNames = sortedData.map(
      (item) => item.knowledge?.title || `知识ID: ${item.knowledge_id}`
    );

    // 计算最大值用于颜色映射
    const maxCitations = Math.max(...sortedData.map((item) => item.citation_count || 0), 1);

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const data = params.data;
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 8px;">${data[5]}</div>
              <div>引用次数: <strong>${data[2]}</strong></div>
              <div>消息数量: ${data[3]}</div>
              <div>会话数量: ${data[4]}</div>
            </div>
          `;
        },
      },
      grid: {
        height: '60%',
        top: '10%',
        left: '15%',
        right: '10%',
      },
      xAxis: {
        type: 'category',
        data: knowledgeNames,
        splitArea: {
          show: true,
        },
        axisLabel: {
          rotate: 45,
          interval: 0,
          fontSize: 11,
          formatter: (value: string) => {
            // 如果标题太长，截断并显示省略号
            return value.length > 15 ? value.substring(0, 15) + '...' : value;
          },
        },
      },
      yAxis: {
        type: 'category',
        data: ['引用热度'],
        splitArea: {
          show: true,
        },
      },
      visualMap: {
        min: 0,
        max: maxCitations,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        inRange: {
          color: ['#e0f3ff', '#0066cc', '#003d7a'],
        },
        text: ['高', '低'],
        textStyle: {
          color: '#333',
        },
      },
      series: [
        {
          name: '引用次数',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (params: any) => {
              return params.data[2];
            },
            color: '#fff',
            fontSize: 12,
            fontWeight: 'bold',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
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

export default HotKnowledgeHeatmap;


import React, { useMemo } from 'react';
import { Table, Tag, Typography } from '@arco-design/web-react';
import { Empty } from '@arco-design/web-react';
import useLocale from '@/utils/useLocale';
import locale from '../locale';

const { Text } = Typography;

interface ZeroHitQuestionsTableProps {
  data: any[];
}

function ZeroHitQuestionsTable({ data }: ZeroHitQuestionsTableProps) {
  const t = useLocale(locale);

  const columns = useMemo(
    () => [
      {
        title: t['knowledgeInsight.zeroHit.table.rank'],
        dataIndex: 'rank',
        width: 80,
        render: (_: any, __: any, index: number) => {
          const rank = index + 1;
          let color = 'gray';
          if (rank === 1) color = 'red';
          else if (rank === 2) color = 'orange';
          else if (rank === 3) color = 'gold';
          return <Tag color={color}>#{rank}</Tag>;
        },
      },
      {
        title: t['knowledgeInsight.zeroHit.table.question'],
        dataIndex: 'question_text',
        ellipsis: true,
        render: (text: string) => (
          <Text style={{ maxWidth: 400 }} ellipsis={{ showTooltip: true }}>
            {text}
          </Text>
        ),
      },
      {
        title: t['knowledgeInsight.zeroHit.table.askedCount'],
        dataIndex: 'asked_count',
        width: 120,
        sorter: (a: any, b: any) => (a.asked_count || 0) - (b.asked_count || 0),
        render: (count: number) => (
          <Tag color="blue" style={{ fontSize: 13, fontWeight: 'bold' }}>
            {count || 0}
          </Tag>
        ),
      },
      {
        title: t['knowledgeInsight.zeroHit.table.firstAsked'],
        dataIndex: 'first_asked_at',
        width: 180,
        render: (date: string) =>
          date ? new Date(date).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' }) : '-',
      },
      {
        title: t['knowledgeInsight.zeroHit.table.lastAsked'],
        dataIndex: 'last_asked_at',
        width: 180,
        sorter: (a: any, b: any) => {
          const dateA = a.last_asked_at ? new Date(a.last_asked_at).getTime() : 0;
          const dateB = b.last_asked_at ? new Date(b.last_asked_at).getTime() : 0;
          return dateA - dateB;
        },
        render: (date: string) =>
          date ? new Date(date).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' }) : '-',
      },
    ],
    [t]
  );

  if (!data || data.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="暂无数据" />
      </div>
    );
  }

  return (
    <Table
      rowKey="question_id"
      data={data}
      columns={columns}
      pagination={{
        pageSize: 10,
        showTotal: true,
        showJumper: true,
      }}
      border={{
        wrapper: true,
        cell: true,
      }}
    />
  );
}

export default ZeroHitQuestionsTable;


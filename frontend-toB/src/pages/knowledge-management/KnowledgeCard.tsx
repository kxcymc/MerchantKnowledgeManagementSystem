import React from 'react';
import { Card, Button, Typography, Grid, Tag } from '@arco-design/web-react';
import styles from '@/style/layout.module.less';

type Props = {
  id: string;
  title: string;
  type: string;
  file_size: string;
  created_at: string;
  status: string;
  preview?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const { Row, Col } = Grid;

const KnowledgeCard: React.FC<Props> = ({
  id,
  title,
  type,
  file_size,
  created_at,
  status,
  preview,
  onEdit,
  onDelete,
}) => {
  return (
    <Card style={{ margin: 8 }} hoverable>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 180 }}>
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ width: 120, marginRight: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 100, height: 100, background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {preview ? <img src={preview} alt={title} style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <div style={{ color: '#999' }}>预览</div>}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Typography.Title heading={5} style={{ marginTop: 0, marginBottom: 8 }}>{title}</Typography.Title>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ marginBottom: 8 }}>{type} · {file_size}</div>
                <div style={{ color: '#888' }}>{created_at}</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Tag>{status}</Tag>
          </div>
          <div>
            <Button type="primary" size="mini" onClick={() => onEdit && onEdit(id)} style={{ marginRight: 8 }}>编辑</Button>
            <Button status="danger" size="mini" onClick={() => onDelete && onDelete(id)}>删除</Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default KnowledgeCard;

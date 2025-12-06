import React from 'react';
import { Card, Button, Typography, Tag, Descriptions, Modal } from '@arco-design/web-react';
import { IconFile, IconCheckCircleFill, IconCloseCircleFill } from '@arco-design/web-react/icon';
import cs from 'classnames';
import styles from './style/index.module.less';
import { useHistory } from 'react-router-dom';
import { getFileUrl } from '@/api';

type Props = {
  knowledge_id: number;
  title: string;
  type: string;
  file_size: string;
  created_at: string;
  status: string;
  preview?: string;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
};

const { Paragraph } = Typography;

const KnowledgeCard: React.FC<Props> = ({
  knowledge_id,
  title,
  type,
  file_size,
  created_at,
  status,
  onEdit,
  onDelete,
}) => {
  const history = useHistory()
  const getStatus = () => {
    if (status === '生效中') {
      return (
        <Tag
          color="green"
          icon={<IconCheckCircleFill />}
          className={styles.status}
          size="small"
        >
          {status}
        </Tag>
      );
    }
    return (
      <Tag
        color="red"
        icon={<IconCloseCircleFill />}
        className={styles.status}
        size="small"
      >
        {status}
      </Tag>
    );
  };
  function previewKnowledge(id: number, type: string, url = '') {
    if (type === 'pdf' || type === 'PDF') {
      const previewUrl = getFileUrl(id);
      window.open(previewUrl, '_blank');
    } else {
      history.push(`/knowledge-management/RichTextPreview?knowledge_id=${id.toString()}`)
    }
  }

  return (
    <Card
      bordered={true}
      className={cs(styles['card-block'])}
      size="small"
      title={
        <>
          <div className={styles.title}>
            <div className={styles.icon}>
              <IconFile />
            </div>
            <Paragraph ellipsis={{ rows: 1 }} style={{ margin: 0, width: '100%' }}>
              {title}
            </Paragraph>
          </div>
        </>
      }
    >
      <div className={styles.content}>
        <div>
          {getStatus()}
        </div>
        <Descriptions
          column={1}
          data={[
            { label: '文件类型', value: type },
            { label: '文件大小', value: file_size },
            { label: '创建时间', value: created_at },
          ]}
        />
      </div>
      <div className={styles.extra}>
        <Button type='secondary' size="mini" onClick={() => previewKnowledge(knowledge_id, type)} style={{ marginLeft: 8 }}>
          预览
        </Button>
        <Button type="primary" size="mini" onClick={() => onEdit && onEdit(knowledge_id)} style={{ marginLeft: 8 }}>
          编辑
        </Button>
        <Button status="danger" size="mini" onClick={() => onDelete && onDelete(knowledge_id)} style={{ marginLeft: 8 }}>
          删除
        </Button>
      </div>
    </Card>
  );
};

export default KnowledgeCard;
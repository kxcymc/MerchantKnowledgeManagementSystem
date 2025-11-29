import React from 'react';
import { Card, Button, Typography, Tag, Descriptions } from '@arco-design/web-react';
import { IconFile, IconCheckCircleFill, IconCloseCircleFill } from '@arco-design/web-react/icon';
import cs from 'classnames';
import styles from './style/index.module.less';

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

const { Paragraph } = Typography;

const KnowledgeCard: React.FC<Props> = ({
  id,
  title,
  type,
  file_size,
  created_at,
  status,
  onEdit,
  onDelete,
}) => {
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
        <div className={styles['btn-group']}>
            <Button type="primary" size="mini" onClick={() => onEdit && onEdit(id)} style={{ marginLeft: 8 }}>
            编辑
            </Button>
            <Button status="danger" size="mini" onClick={() => onDelete && onDelete(id)} style={{ marginLeft: 8 }}>
            删除
            </Button>
        </div>
        <div>
            {getStatus()}
        </div>
      </div>
    </Card>
  );
};

export default KnowledgeCard;
import React, { useEffect, useState } from 'react';
import { Typography, Result, Button } from '@arco-design/web-react';
import { useHistory, useLocation } from 'react-router-dom';
import styles from './style/index.module.less';

function Error() {
  const history = useHistory();
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState('操作失败，请重试');

  useEffect(() => {
    // 从 URL 参数获取错误信息
    const params = new URLSearchParams(location.search);
    const msg = params.get('message') || params.get('error') || '操作失败，请重试';
    setErrorMessage(msg);
  }, [location]);

  return (
    <div>
      <div className={styles.wrapper}>
        <Result
          className={styles.result}
          status="error"
          title="操作失败"
          subTitle={errorMessage}
          extra={[
            <Button 
              key="back" 
              type="primary"
              onClick={() => history.goBack()}
            >
              返回上一步
            </Button>,
            <Button 
              key="home" 
              type="secondary"
              style={{ marginRight: 16 }}
              onClick={() => history.push('/knowledge-management/all')}
            >
              返回知识管理
            </Button>,
          ]}
        />
        <div className={styles['details-wrapper']}>
          <Typography.Title heading={6} style={{ marginTop: 0 }}>
            可能的原因
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <ol>
              <li>文件格式不支持或文件已损坏</li>
              <li>文件大小超过限制（最大 25MB）</li>
              <li>网络连接问题，请检查网络后重试</li>
              <li>服务器处理异常，请稍后重试</li>
            </ol>
          </Typography.Paragraph>
        </div>
      </div>
    </div>
  );
}

export default Error;
import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Result, Button } from '@arco-design/web-react';
import styles from './style/index.module.less';

function Exception404() {
  const history = useHistory();
  const location = useLocation();
  const lastPage = JSON.parse(decodeURIComponent(new URLSearchParams(location.search).get('errRoute')));

  const handleRetry = () => {
    history.replace(lastPage);
  };

  const handleBack = () => {
    if (history.length > 1) {
      history.goBack();
    } else {
      history.replace('/');
    }
  };

  return (
    <div className={styles.wrapper}>
      <Result
        className={styles.result}
        status="404"
        subTitle="抱歉，页面不见了～"
        extra={[
          lastPage && 
          (<Button key="again" onClick={handleRetry} style={{ marginRight: 16 }}>
            重试
          </Button>),
          <Button key="back" type="primary" onClick={handleBack}>
            返回
          </Button>,
        ]}
      />
    </div>
  );
}

export default Exception404;
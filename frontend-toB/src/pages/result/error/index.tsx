import React from 'react';
import { Typography, Result, Button, Link } from '@arco-design/web-react';
import { IconLink } from '@arco-design/web-react/icon';
import styles from './style/index.module.less';

function Success() {
  return (
    <div>
      <div className={styles.wrapper}>
        <Result
          className={styles.result}
          status="error"
          title="提交失败"
          subTitle="请核对修改信息后，再重试"
          extra={[
            <Button key="again" type="secondary" style={{ marginRight: 16 }}>
              回到首页
            </Button>,
            <Button key="back" type="primary">
              返回修改
            </Button>,
          ]}
        />
        <div className={styles['details-wrapper']}>
          <Typography.Title heading={6} style={{ marginTop: 0 }}>
            错误详情
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <ol>
              <li>
                当前域名未备案，备案流程请查看：
                <Link>
                  <IconLink />
                  备案流程
                </Link>
              </li>
              <li>
                你的用户组不具有进行此操作的权限；
                <Link>申请权限</Link>
              </li>
            </ol>
          </Typography.Paragraph>
        </div>
      </div>
    </div>
  );
}

export default Success;
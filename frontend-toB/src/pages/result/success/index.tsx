import React from 'react';
import { Typography, Result, Button, Steps } from '@arco-design/web-react';
import styles from './style/index.module.less';

const Step = Steps.Step;

function Success() {
  return (
    <div>
      <div className={styles.wrapper}>
        <Result
          className={styles.result}
          status="success"
          title="提交成功"
          subTitle="表单提交成功！"
          extra={[
            <Button key="again" type="secondary" style={{ marginRight: 16 }}>
              打印结果
            </Button>,
            <Button key="back" type="primary">
              返回项目列表
            </Button>,
          ]}
        />
        <div className={styles['steps-wrapper']}>
          <Typography.Paragraph bold>
            当前进度
          </Typography.Paragraph>
          <Steps type="dot" current={2}>
            <Step
              title="提交申请"
              description="2020/10/10 14:00:39"
            />
            <Step
              title="直属领导审核"
              description="进行中"
            />
            <Step
              title="购买证书"
              description="未开始"
            />
            <Step
              title="安全测试"
              description="未开始"
            />
            <Step
              title="正式上线"
              description="未开始"
            />
          </Steps>
        </div>
      </div>
    </div>
  );
}

export default Success;
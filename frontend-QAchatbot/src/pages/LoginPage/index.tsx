import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Checkbox, Message, Link } from '@arco-design/web-react';
import { IconUser, IconLock } from '@arco-design/web-react/icon';
import styles from './index.module.scss';
import LoginSVG from '@/assets/login.svg';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const navigate = useNavigate();

  const handleLoginClick = () => {
    if (!agreed) {
      Message.error('请同意用户协议与隐私政策');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
      navigate('/');
      Message.success('登录成功！');
    }, 800);
  };

  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.dynamicBackground}>
        <div className={styles.bgCircleBlue} />
        <div className={styles.bgCirclePurple} />
      </div>

      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.logoWrapper}>
            <LoginSVG />
          </div>
          <h1 className={styles.title}>欢迎使用抖音商家问答AI</h1>
          <p className={styles.subtitle}>请登录（未注册将自动注册）</p>
        </div>

        <div className={styles.inputForm}>
          <Input
            size="large"
            prefix={<IconUser className={styles.inputIcon} />}
            placeholder="手机号码（+86）"
            className={styles.inputField}
          />

          <Input.Password
            size="large"
            prefix={<IconLock className={styles.inputIcon} />}
            placeholder="密码"
            className={styles.inputField}
          />

          <div className={styles.agreementRow}>
            <div className={styles.agreementCheckboxWrapper}>
              <Checkbox checked={agreed} onChange={setAgreed}>
                <span className={styles.agreementText}>
                  我同意{' '}
                  <Link href="#" hoverable={false} className={styles.agreementLink}>
                    用户协议
                  </Link>{' '}
                  和{' '}
                  <Link href="#" hoverable={false} className={styles.agreementLink}>
                    隐私政策
                  </Link>
                </span>
              </Checkbox>
            </div>
            <Link href="#" hoverable={false} className={styles.forgotLink}>
              忘记密码？
            </Link>
          </div>

          <Button
            type="primary"
            size="large"
            long
            loading={loading}
            onClick={handleLoginClick}
            className={styles.loginButton}
          >
            登录
          </Button>
        </div>

        {/* <div className={styles.dividerWrapper}>
          <div className={styles.dividerLine}></div>
          <span className={styles.dividerText}>或用下列方式登录</span>
        </div> */}

        {/* <div className={styles.socialLogin}>
          <Button shape="circle" size="large" className={styles.socialButton}>
            <IconGoogle />
          </Button>
          <Button shape="circle" size="large" className={styles.socialButton}>
            <IconGithub />
          </Button>
        </div> */}
      </div>

      <div className={styles.footerCopyright}>
        <p className={styles.copyrightText}>© 前端&nbsp;&nbsp;&nbsp;2025字节跳动工程训练营</p>
      </div>
    </div>
  );
};

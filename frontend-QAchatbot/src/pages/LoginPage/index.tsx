import React, { useState } from 'react';
import { Button, Input, Checkbox, Message, Link } from '@arco-design/web-react';
import { IconUser, IconLock, IconGithub, IconGoogle } from '@arco-design/web-react/icon';
import styles from './index.module.scss';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleLoginClick = () => {
    if (!agreed) {
      Message.error('Please agree to the User Agreement and Privacy Policy');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
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
            <span className={styles.logoText}>D</span>
          </div>
          <h1 className={styles.title}>Welcome to Doubao</h1>
          <p className={styles.subtitle}>Log in or Sign up to explore the AI world</p>
        </div>

        <div className={styles.inputForm}>
          <Input
            size="large"
            prefix={<IconUser className={styles.inputIcon} />}
            placeholder="Mobile number or Email"
            className={styles.inputField}
          />

          <Input.Password
            size="large"
            prefix={<IconLock className={styles.inputIcon} />}
            placeholder="Password"
            className={styles.inputField}
          />

          <div className={styles.agreementRow}>
            <div className={styles.agreementCheckboxWrapper}>
              <Checkbox checked={agreed} onChange={setAgreed}>
                <span className={styles.agreementText}>
                  I agree to{' '}
                  <Link href="#" hoverable={false} className={styles.agreementLink}>
                    Terms
                  </Link>{' '}
                  &{' '}
                  <Link href="#" hoverable={false} className={styles.agreementLink}>
                    Privacy
                  </Link>
                </span>
              </Checkbox>
            </div>
            <Link href="#" hoverable={false} className={styles.forgotLink}>
              Forgot?
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
            Log In
          </Button>
        </div>

        <div className={styles.dividerWrapper}>
          <div className={styles.dividerLine}></div>
          <span className={styles.dividerText}>Or continue with</span>
        </div>

        <div className={styles.socialLogin}>
          <Button shape="circle" size="large" className={styles.socialButton}>
            <IconGoogle />
          </Button>
          <Button shape="circle" size="large" className={styles.socialButton}>
            <IconGithub />
          </Button>
        </div>
      </div>

      <div className={styles.footerCopyright}>
        <p className={styles.copyrightText}>© 2024 Doubao Design Clone. All rights reserved.</p>
      </div>
    </div>
  );
};

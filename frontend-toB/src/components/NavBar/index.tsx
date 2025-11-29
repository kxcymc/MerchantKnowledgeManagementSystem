import React, { useContext } from 'react';
import {
  Tooltip,
  Button,
} from '@arco-design/web-react';
import {
  IconSunFill,
  IconMoonFill,
  IconSettings,
} from '@arco-design/web-react/icon';
import Logo from '@/assets/logo.svg';
import IconButton from './IconButton';
import styles from './style/index.module.less';
import { GlobalContext } from '@/context';


function Navbar({ show }: { show: boolean }) {
  const { theme, setTheme } = useContext(GlobalContext);
  if (!show) {
    return (
      <div className={styles['fixed-settings']}>
        <Tooltip
          content={
            theme === 'light'
              ? '点击切换为暗黑模式'
              : '点击切换为亮色模式'
          }
        >
          <IconButton
            icon={theme !== 'dark' ? <IconMoonFill /> : <IconSunFill />}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
        </Tooltip>
      </div>
    );
  }


  return (
    <div className={styles.navbar}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <div className={styles['logo-svg']}><Logo /></div>
          <div className={styles['logo-name']}>商家知识管理系统</div>
        </div>
      </div>
      <ul className={styles.right}>
        <li>
          <Tooltip
            content={
              theme === 'light'
                ? '点击切换为暗黑模式'
                : '点击切换为亮色模式'
            }
          >
            <IconButton
              icon={theme !== 'dark' ? <IconMoonFill /> : <IconSunFill />}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            />
          </Tooltip>
        </li>
      </ul>
    </div>
  );
}

export default Navbar;

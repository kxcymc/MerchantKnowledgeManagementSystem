import React, { useContext, useEffect } from 'react';
import {
  Tooltip,
} from '@arco-design/web-react';
import {
  IconSunFill,
  IconMoonFill,
  IconFullscreen,
  IconFullscreenExit,
} from '@arco-design/web-react/icon';
import Logo from '@/assets/logo.svg';
import IconButton from './IconButton';
import styles from './style/index.module.less';
import { GlobalContext } from '@/context';


function Navbar({ show, isFullscreen, onFullscreenChange }: { show: boolean; isFullscreen?: boolean; onFullscreenChange?: (value: boolean) => void }) {
  const { theme, setTheme } = useContext(GlobalContext);
  
  const handleFullscreenClick = () => {
  // 触发回调通知React状态变化
  if (onFullscreenChange) {
    onFullscreenChange(!isFullscreen);
  }

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

// 在组件挂载时添加全屏状态监听
useEffect(() => {
  const handleFullscreenChange = () => {
    const isFullscreenActive = document.fullscreenElement;
    
    if (onFullscreenChange) {
      onFullscreenChange(!!isFullscreenActive);
    }
  };

  document.addEventListener('fullscreenchange', handleFullscreenChange);

  return () => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  };
}, [onFullscreenChange]);

  if (!show) {
    return (
      <div className={styles['fixed-settings']}>
        {onFullscreenChange && (
          <Tooltip content={isFullscreen ? '退出全屏' : '进入全屏'}>
            <IconButton
              icon={isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
              onClick={handleFullscreenClick}
            />
          </Tooltip>
        )}
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
          <Tooltip content={isFullscreen ? '退出全屏' : '进入全屏'}>
            <IconButton
              icon={isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
              onClick={handleFullscreenClick}
            />
          </Tooltip>
        </li>
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

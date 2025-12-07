import React, { useState, useEffect } from 'react';
import { Dropdown, Button } from '@arco-design/web-react';
import { IconDown } from '@arco-design/web-react/icon';
import styles from './index.module.scss';

export interface ModelInfo {
  provider: string;
  name: string;
  model: string;
  available: boolean;
}

interface ModelSelectorProps {
  currentProvider?: string;
  onModelChange?: (provider: string, model: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentProvider,
  onModelChange,
}) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [current, setCurrent] = useState<{ provider: string; model: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // 获取模型列表
  const fetchModels = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api');
      const response = await fetch(`${API_BASE_URL}/llm/models`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('获取模型列表失败:', response.status, errorText);
        throw new Error(`获取模型列表失败: ${response.status}`);
      }
      const data = await response.json();
      console.log('获取到的模型列表:', data);
      setModels(data.models || []);
      
      // 优先使用 prop 传入的 currentProvider，否则使用后端返回的 current
      if (currentProvider && data.models) {
        const model = data.models.find((m: ModelInfo) => m.provider === currentProvider);
        if (model) {
          setCurrent({ provider: currentProvider, model: model.model });
        } else {
          setCurrent(data.current || null);
        }
      } else {
        setCurrent(data.current || null);
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
      // 即使失败也显示按钮，只是禁用状态
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  // 当 currentProvider prop 变化时，更新 current 状态
  useEffect(() => {
    if (currentProvider && models.length > 0) {
      const model = models.find((m) => m.provider === currentProvider);
      if (model) {
        setCurrent({ provider: currentProvider, model: model.model });
      }
    }
  }, [currentProvider, models]);

  // 切换模型
  const handleModelSwitch = async (provider: string, model: string) => {
    try {
      setLoading(true);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api');
      const response = await fetch(`${API_BASE_URL}/llm/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, model }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '切换模型失败');
      }

      const data = await response.json();
      setCurrent({ provider: data.provider, model: data.model });
      
      // 调用回调函数通知父组件（不显示消息）
      if (onModelChange) {
        onModelChange(data.provider, data.model);
      }
    } catch (error) {
      console.error('切换模型失败:', error);
      alert(error instanceof Error ? error.message : '切换模型失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取当前显示的模型名称
  const getCurrentModelName = () => {
    if (!current) {
      return '加载中...';
    }
    const model = models.find((m) => m.provider === current.provider);
    return model ? model.name : current.provider;
  };

  // 生成下拉菜单
  const dropList = (
    <div className={styles.dropContainer}>
      {models.map((model) => (
        <div
          key={model.provider}
          className={`${styles.dropItem} ${
            current?.provider === model.provider ? styles.dropItemActive : ''
          } ${!model.available ? styles.dropItemDisabled : ''}`}
          onClick={(e) => {
            e.stopPropagation(); // 阻止事件冒泡
            if (model.available && current?.provider !== model.provider) {
              // 立即关闭下拉框
              setDropdownVisible(false);
              handleModelSwitch(model.provider, model.model);
            } else if (current?.provider === model.provider) {
              // 如果点击的是当前选中的模型，也关闭下拉框
              setDropdownVisible(false);
            }
          }}
          title={!model.available ? '该模型未配置 API Key' : ''}
        >
          <span className={styles.modelName}>{model.name}</span>
          {current?.provider === model.provider && (
            <span className={styles.checkmark}>✓</span>
          )}
          {!model.available && (
            <span className={styles.unavailable}>未配置</span>
          )}
        </div>
      ))}
    </div>
  );

  // 如果没有模型，显示默认文本
  const displayText = models.length === 0 && !loading 
    ? '模型选择' 
    : getCurrentModelName();

  return (
    <Dropdown
      droplist={dropList}
      position="bl"
      trigger="click"
      disabled={loading || models.length === 0}
      popupVisible={dropdownVisible}
      onVisibleChange={(visible) => {
        setDropdownVisible(visible);
      }}
    >
      <Button
        type="text"
        className={styles.selectorButton}
        loading={loading}
        disabled={loading || models.length === 0}
        style={{ 
          visibility: 'visible',
          opacity: (loading || models.length === 0) ? 0.6 : 1 
        }}
      >
        <span className={styles.selectorLabel}>
          {displayText}
        </span>
        <IconDown className={styles.selectorIcon} />
      </Button>
    </Dropdown>
  );
};


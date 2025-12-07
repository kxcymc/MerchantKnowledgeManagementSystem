import React, { useEffect, useState } from 'react';
import { Modal, Spin, Result } from '@arco-design/web-react';
import LoadingManager from '@/utils/LoadingManager';

const GlobalLoading = () => {
    const [visible, setVisible] = useState(false);
    const [state, setState] = useState<'loading' | 'success' | 'fail' | 'idle'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const unsubscribe = LoadingManager.subscribe((newState, newMsg) => {
            setState(newState);
            setMessage(newMsg || '');
            if (newState === 'idle') {
                setVisible(false);
            } else {
                setVisible(true);
            }
        });
        return unsubscribe;
    }, []);

    const renderContent = () => {
        if (state === 'loading') {
            return (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin dot />
                    <div style={{ marginTop: '16px', fontSize: '16px' }}>{message || '正在处理中，请耐心等待...'}</div>
                </div>
            );
        }
        if (state === 'success') {
            return <Result status="success" title={message || '操作成功'} />;
        }
        if (state === 'fail') {
            return <Result status="error" title={message || '操作失败'} />;
        }
        return null;
    };

    return (
        <Modal
            visible={visible}
            footer={null}
            closable={false}
            maskClosable={false}
            simple
            style={{ width: 400 }}
        >
            {renderContent()}
        </Modal>
    );
};

export default GlobalLoading;

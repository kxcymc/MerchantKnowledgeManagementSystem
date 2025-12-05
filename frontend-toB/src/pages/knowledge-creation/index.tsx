import React, { useEffect, useState } from 'react';
import {
    Card,
    Typography,
    Form,
    Input,
    Button,
    Select,
    Message,
    Modal,
    Radio,
    Upload,
} from '@arco-design/web-react';
import { IconUpload, IconClose } from '@arco-design/web-react/icon';
import { UploadItem } from '@arco-design/web-react/es/Upload';
import { useHistory, useLocation } from 'react-router-dom';
import type { Descendant } from 'slate';
import RichTextEditor from '@/components/RichTextEditor/index';

export default function KnowledgeCreation() {
    const [form] = Form.useForm();
    const [hasValue, setHasValue] = useState(false);
    const [mode, setMode] = useState<'pdf' | '富文本' | ''>('');
    const [fileList, setFileList] = useState<UploadItem[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [isShowSceneSelectCol, setIsShowSceneSelectCol] = useState(false);
    const [editorContent, setEditorContent] = useState<Descendant[][]>([
        [{
            type: 'paragraph',
            children: [{ text: '' }],
        }],
    ]);

    const history = useHistory();
    const location = useLocation();
    const { businessName, sceneName } = Object.fromEntries(new URLSearchParams(location.search));
    useEffect(() => {
        if (businessName) {
            form.setFieldValue('business', businessName)
        }
        if (sceneName) {
            form.setFieldValue('scene', sceneName)
        }
    }, [form, businessName, sceneName])



    const onUploadChange = (fl: UploadItem[], file: UploadItem) => {
        form.setFieldValue('files', fl);


        setFileList(fl);
    };

    const handleRemoveFile = (uid: string) => {
        setFileList((prev) => prev.filter((item) => item.uid !== uid));
        if (selectedFile === uid) {
            setSelectedFile('');
        }
    };

    const handleClearAllFiles = () => {
        if (fileList.length === 0) return;

        Modal.confirm({
            title: '二次确认',
            content: (
                <div style={{ textAlign: 'center' }}>
                    确定要清空 {fileList.length} 个已上传的文件吗？
                </div>
            ),
            onOk: () => {
                setFileList([]);
                setSelectedFile('');
                Message.success('已清空所有文件');
            },
        });
    };

    interface Payload {
        business: string;
        scene: string;
        file_url?: string;
        title?: string;
        mode: 'pdf' | '富文本' | '';
        content?: string;
        files?: { name: string; size: number; link?: string }[];
    }

    const handleSubmit = async () => {
        try {
            const values = await form.validate();
            if (!values.business) {
                Message.error('请选择所属业务');
                return;
            }
            if (isShowSceneSelectCol && !values.scene) {
                Message.error('请选择所属场景');
                return;
            }

            const payload: Partial<Payload> = {
                business: values.business,
                scene: values.scene,
                title: values.title || '',
                mode,
            };

            if (mode === '富文本') {
                payload.content = JSON.stringify(editorContent);
            } else {
                payload.files = fileList.map((f) => ({
                    name: f.name || (f.originFile && f.originFile.name) || 'unknown',
                    size: (f.originFile && (f.originFile as File).size) || 0,
                }));
            }

            console.log('提交负载：', payload);
            Message.success('知识创建（前端）提交成功');
            history.push('/knowledge-management/all');
        } catch (err) {
            Message.error('请检查表单必填项');
        }
    };

    const handleValuesChange = () => {
        setHasValue(Object.values(form.getFieldsValue()).some(val =>
            val !== undefined && val !== '' && val !== null
        ));
        if (form.getFieldValue('business') === '招商入驻')
            setIsShowSceneSelectCol(true);
        else {
            setIsShowSceneSelectCol(false);
        }
    }

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <Typography.Title heading={5} style={{ marginTop: 0, textAlign: 'center' }}>
                    上传PDF / 手动输入
                </Typography.Title>

                <Form
                    form={form}
                    style={{ maxWidth: 900, margin: '0 auto' }}
                    labelCol={{ span: 4 }}
                    wrapperCol={{ span: 18 }}
                    onValuesChange={handleValuesChange}
                >
                    <Form.Item label="创建方式">
                        <Radio.Group value={mode} onChange={(val) => setMode(val)}>
                            <Radio value="pdf">PDF 上传</Radio>
                            <Radio value="富文本">手动输入</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item label="所属业务" field="business" rules={[{ required: true, message: '请选择所属业务' }]}>
                        <Select placeholder="请选择业务">
                            <Select.Option value="经营成长">经营成长</Select.Option>
                            <Select.Option value="招商入驻">招商入驻</Select.Option>
                            <Select.Option value="资金结算">资金结算</Select.Option>
                        </Select>
                    </Form.Item>

                    {isShowSceneSelectCol && (
                        <Form.Item label="所属场景" field="scene" rules={[{ required: true, message: '请选择所属场景' }]}>
                            <Select placeholder="请选择场景">
                                <Select.Option value="入驻与退出">入驻与退出</Select.Option>
                                <Select.Option value="保证金管理">保证金管理</Select.Option>
                            </Select>
                        </Form.Item>
                    )}

                    {mode && (
                        <>
                            {mode === 'pdf' && (
                                <>
                                    <Form.Item label="文件上传"
                                        field="files"
                                        rules={[{ required: true, message: '请上传至少一个PDF文件' }]}
                                        getValueFromEvent={(fl) => fl}
                                    >
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            <Upload
                                                accept=".pdf"
                                                multiple
                                                fileList={fileList}
                                                onChange={onUploadChange}
                                                showUploadList={false}
                                                autoUpload={false}
                                            >
                                                <Button type="outline">
                                                    <IconUpload /> 选择 PDF 文件（支持多文件）
                                                </Button>
                                            </Upload>
                                            {fileList.length > 0 && (
                                                <Button
                                                    type="outline"
                                                    status="warning"
                                                    onClick={handleClearAllFiles}
                                                >
                                                    清空
                                                </Button>
                                            )}
                                        </div>

                                        {fileList.length > 0 && (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(3, 1fr)',
                                                gap: 12,
                                                marginTop: 12,
                                                maxHeight: 300,
                                                overflowY: fileList.length > 6 ? 'auto' : 'visible',
                                                padding: 2
                                            }}>
                                                {fileList.map((file) => (
                                                    <div
                                                        key={file.uid}
                                                        style={{
                                                            border: '1px solid #e5e6eb',
                                                            borderRadius: 4,
                                                            padding: 12,
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            background: '#fff'
                                                        }}
                                                    >
                                                        <div style={{
                                                            flex: 1,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            marginRight: 8,
                                                            fontSize: 14,
                                                            color: '#1d2129'
                                                        }}>
                                                            {file.name}
                                                        </div>
                                                        <IconClose
                                                            style={{ cursor: 'pointer', color: '#86909c' }}
                                                            onClick={() => handleRemoveFile(file.uid)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Form.Item>

                                    {fileList.length === 1 &&
                                        (<Form.Item label="文件标题" field="title" rules={[{ required: true, message: '请填写文件标题' }]}>
                                            <Input placeholder="建议和上传的文件名一致" />
                                        </Form.Item>)
                                    }
                                </>
                            )}

                            {mode === '富文本' && (
                                <>
                                    <Form.Item label="文档标题" field="title" rules={[{ required: true, message: '请输入标题' }]}>
                                        <Input placeholder="输入标题" />
                                    </Form.Item>

                                    <Form.Item label="富文本内容" field='text-content' rules={[{ required: true, message: '请输入内容' }]}>
                                        <RichTextEditor
                                            value={editorContent}
                                            onChange={setEditorContent}
                                        />
                                    </Form.Item>
                                </>
                            )}
                        </>
                    )}

                    <Form.Item wrapperCol={{ offset: 4 }}>
                        <Button type="primary" onClick={handleSubmit} disabled={!hasValue}>提交</Button>
                        <Button style={{ marginLeft: 12 }} onClick={() => history.push('/knowledge-management/all')}>取消</Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}
import React, { useRef, useState } from 'react';
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
import { useHistory } from 'react-router-dom';

export default function KnowledgeCreation() {
    const history = useHistory();
    const [form] = Form.useForm();
    const [mode, setMode] = useState<'pdf' | 'manual'>('pdf');
    const [fileList, setFileList] = useState<UploadItem[]>([]);
    const [fileLinks, setFileLinks] = useState<Record<string, string>>({});
    const [selectedFile, setSelectedFile] = useState<string>('');
    const editorRef = useRef<HTMLDivElement | null>(null);

    const insertImage = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = document.createElement('img');
            img.src = String(reader.result);
            img.style.maxWidth = '100%';
            if (editorRef.current) {
                editorRef.current.appendChild(img);
            }
        };
        reader.readAsDataURL(file);
    };

    const onUploadChange = (fl: UploadItem[]) => {
        setFileList(fl);
    };

    const handleRemoveFile = (uid: string) => {
        setFileList((prev) => prev.filter((item) => item.uid !== uid));
        setFileLinks((prev) => {
            const newLinks = { ...prev };
            delete newLinks[uid];
            return newLinks;
        });
        if (selectedFile === uid) {
            setSelectedFile('');
        }
    };

    // 新增：清空所有文件
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
                setFileLinks({});
                setSelectedFile('');
                Message.success('已清空所有文件');
            },
        });
    };

    const handleLinkChange = (uid: string, value: string) => {
        setFileLinks((prev) => ({
            ...prev,
            [uid]: value,
        }));
    };

    interface Payload {
        business: string;
        scene: string;
        file_url?: string;
        title?: string;
        mode: 'pdf' | 'manual';
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
            if (!values.scene) {
                Message.error('请选择所属场景');
                return;
            }

            const payload: Partial<Payload> = {
                business: values.business,
                scene: values.scene,
                title: values.title || '',
                mode,
            };

            if (mode === 'manual') {
                payload.content = editorRef.current ? editorRef.current.innerHTML : '';
            } else {
                payload.files = fileList.map((f) => ({
                    name: f.name || (f.originFile && f.originFile.name) || 'unknown',
                    size: (f.originFile && (f.originFile as File).size) || 0,
                    link: fileLinks[f.uid] || '',
                }));
            }

            console.log('提交负载：', payload);
            Message.success('知识创建（前端）提交成功');
            history.push('/knowledge-management/all');
        } catch (err) {
            Message.error('请检查表单必填项');
        }
    };

    const fileOptions = [
        { label: '选择文件', value: '' },
        ...fileList.map(file => ({
            label: file.name || (file.originFile && file.originFile.name) || 'unknown',
            value: file.uid
        }))
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <Typography.Title heading={5} style={{ marginTop: 0, textAlign: 'center' }}>
                    上传PDF文件（可批量）/ 手动输入富文本
                </Typography.Title>

                <Form
                    form={form}
                    style={{ maxWidth: 900, margin: '0 auto' }}
                    labelCol={{ span: 4 }}
                    wrapperCol={{ span: 18 }}
                >
                    <Form.Item label="创建方式">
                        <Radio.Group value={mode} onChange={(val) => setMode(val)}>
                            <Radio value="pdf">PDF 批量上传</Radio>
                            <Radio value="manual">手动富文本输入</Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item label="所属业务" field="business" rules={[{ required: true, message: '请选择所属业务' }]}>
                        <Select placeholder="请选择业务">
                            <Select.Option value="growth">经营成长</Select.Option>
                            <Select.Option value="onboarding">招商入驻</Select.Option>
                            <Select.Option value="settlement">资金结算</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item label="所属场景" field="scene" rules={[{ required: true, message: '请选择所属场景' }]}>
                        <Select placeholder="请选择场景">
                            <Select.Option value="scene_1">场景 1</Select.Option>
                            <Select.Option value="scene_2">场景 2</Select.Option>
                        </Select>
                    </Form.Item>

                    {mode === 'pdf' && (
                        <>
                            <Form.Item label="文件上传" rules={[{ required: true }]}>
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
                                    {/* 新增清空按钮 */}
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
                                (<Form.Item label="文件标题" field="title" rules={[{ required: true }]}>
                                    <Input placeholder="建议和上传的文件名一致" />
                                </Form.Item>)
                            }

                            {fileList.length > 0 &&
                                (
                                    <Form.Item
                                        label="引用链接"
                                        extra="选择文件并填写对应的引用链接，没有则留空"
                                    >
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            <Select
                                                placeholder="选择文件"
                                                value={selectedFile}
                                                onChange={(val) => setSelectedFile(val)}
                                                style={{ width: 200 }}
                                            >
                                                {fileOptions.map(option => (
                                                    <Select.Option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </Select.Option>
                                                ))}
                                            </Select>
                                            <Input
                                                placeholder="填写文件在抖音商家知识中心对应的原文链接"
                                                value={selectedFile ? fileLinks[selectedFile] || '' : ''}
                                                onChange={(val) => {
                                                    if (selectedFile) {
                                                        handleLinkChange(selectedFile, val);
                                                    }
                                                }}
                                                disabled={!selectedFile}
                                                style={{ flex: 1 }}
                                            />
                                        </div>
                                    </Form.Item>
                                )
                            }
                        </>
                    )}

                    {mode === 'manual' && (
                        <>
                            <Form.Item label="标题" field="title" rules={[{ required: true, message: '请输入标题' }]}>
                                <Input placeholder="输入标题" />
                            </Form.Item>

                            <Form.Item label="富文本内容" field="content" rules={[{ required: true, message: '请输入内容' }]}>
                                <div style={{ border: '1px solid #eee', borderRadius: 4 }}>
                                    <div style={{ padding: 8, borderBottom: '1px solid #f3f3f3', display: 'flex', gap: 8 }}>
                                        <Button size="small" onClick={() => document.execCommand('bold')}>加粗</Button>
                                        <Button size="small" onClick={() => document.execCommand('italic')}>斜体</Button>
                                        <label style={{ margin: 0 }}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={(e) => {
                                                    const f = e.target.files && e.target.files[0];
                                                    if (f) insertImage(f);
                                                    e.currentTarget.value = '';
                                                }}
                                            />
                                            <Button size="small">插入图片</Button>
                                        </label>
                                    </div>
                                    <div
                                        ref={editorRef}
                                        contentEditable
                                        style={{ minHeight: 200, padding: 12 }}
                                    />
                                </div>
                            </Form.Item>
                        </>
                    )}

                    <Form.Item wrapperCol={{ offset: 4 }}>
                        <Button type="primary" onClick={handleSubmit}>提交</Button>
                        <Button style={{ marginLeft: 12 }} onClick={() => history.push('/knowledge-management/all')}>取消</Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}
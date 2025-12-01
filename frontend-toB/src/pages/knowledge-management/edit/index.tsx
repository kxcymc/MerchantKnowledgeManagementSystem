import React, { useState } from 'react';
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
import { useLocation, useHistory } from 'react-router-dom';
import type { Descendant } from 'slate';
import RichTextEditor from '@/components/RichTextEditor/index';

export default function KnowledgeCreation() {
    const location = useLocation();
    const history = useHistory();
    const [form] = Form.useForm();
    const [mode, setMode] = useState<'pdf' | '富文本' | ''>('');
    const [uploadedFile, setUploadedFile] = useState<UploadItem | null>(null);
    const [fileLink, setFileLink] = useState<string>('');

    const params = new URLSearchParams(location.search)
    const knowledgeIdParam = params.get('knowledge_id');
    if (!knowledgeIdParam || Number.isNaN(Number(knowledgeIdParam))) {
        history.replace(`expection/404?errRoute=${encodeURIComponent(JSON.stringify([location.pathname, location.search].join('')))}`);
    }
    const DocTitleParam = params.get('title') ? '《' + params.get('title') + '》' : '';
    const fileTypeParam = params.get('type') || '';

    // 修改：处理单个文件上传
    const onUploadChange = (fl: UploadItem[]) => {
        // 只保留最新选择的文件
        if (fl && fl.length > 0) {
            setUploadedFile(fl[fl.length - 1]);
        } else {
            setUploadedFile(null);
        }
    };

    const handleRemoveFile = () => {
        setUploadedFile(null);
        setFileLink('');
        Message.success('文件已移除');
    };

    const handleLinkChange = (value: string) => {
        setFileLink(value);
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
                // 修改：将单个文件包装成数组格式提交
                if (uploadedFile) {
                    payload.files = [{
                        name: uploadedFile.name || (uploadedFile.originFile && uploadedFile.originFile.name) || 'unknown',
                        size: (uploadedFile.originFile && (uploadedFile.originFile as File).size) || 0,
                        link: fileLink,
                    }];
                }
            }

            console.log('提交负载：', payload);
            Message.success('知识创建（前端）提交成功');
            history.push('/knowledge-management/all');
        } catch (err) {
            Message.error('请检查表单必填项');
        }
    };

    const handleValuesChange = () => {
        if (form.getFieldValue('business') === '招商入驻')
            setIsShowSceneSelectCol(true);
        else setIsShowSceneSelectCol(false);
    }

    const handleBack = () => {
        if (history.length > 1) {
            history.goBack();
        } else {
            history.replace('/');
        }
    };

    function previewKnowledge(id: number, type: string, url = '') {
        if (type === 'PDF') {
            if (url) window.open(url, '_blank');
            else
                Modal.info({
                    title: '该PDF不支持预览'
                })
        } else {
            history.push(`/knowledge-management/RichTextPreview?knowledge_id=${id.toString()}`)
        }
    }

    const [editorContent, setEditorContent] = useState<Descendant[]>([
        {
            type: 'paragraph',
            children: [{ text: '' }],
        },
    ]);
    const [isShowSceneSelectCol, setIsShowSceneSelectCol] = useState(false);

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <Button key="back" type="outline" onClick={handleBack}>
                    返回
                </Button>
                <Typography.Title heading={5} style={{ marginTop: 0, textAlign: 'center' }}>
                    {`${DocTitleParam}文档编辑`}
                </Typography.Title>

                <Form
                    form={form}
                    style={{ maxWidth: 900, margin: '0 auto' }}
                    labelCol={{ span: 4 }}
                    wrapperCol={{ span: 18 }}
                    onValuesChange={handleValuesChange}
                >
                    <Form.Item label="原文件预览">
                        <Button type='secondary' size="large" onClick={() => previewKnowledge(Number(knowledgeIdParam), fileTypeParam)} style={{ marginLeft: 8 }}>
                            点击预览
                        </Button>
                    </Form.Item>
                    <Form.Item label="编辑方式"
                        extra='修改将覆盖原文件'
                        field='type'
                        rules={[{ required: true, message: '请选择一种编辑方式' }]}>
                        <Radio.Group value={mode} onChange={(val) => setMode(val)}>
                            <Radio value="pdf">PDF 上传</Radio>
                            <Radio value="富文本">手动输入</Radio>
                        </Radio.Group>
                    </Form.Item>

                    {mode &&
                        (
                            <>
                                <Form.Item label="编辑业务" field="business" rules={[{ required: true, message: '请选择所属业务' }]}>
                                    <Select placeholder="请选择业务">
                                        <Select.Option value="经营成长">经营成长</Select.Option>
                                        <Select.Option value="招商入驻">招商入驻</Select.Option>
                                        <Select.Option value="资金结算">资金结算</Select.Option>
                                    </Select>
                                </Form.Item>

                                {isShowSceneSelectCol && (
                                    <Form.Item label="编辑场景" field="scene" rules={[{ required: true, message: '请选择所属场景' }]}>
                                        <Select placeholder="请选择场景">
                                            <Select.Option value="入驻与退出">入驻与退出</Select.Option>
                                            <Select.Option value="保证金管理">保证金管理</Select.Option>
                                        </Select>
                                    </Form.Item>
                                )}

                                {mode === 'pdf' && (
                                    <>
                                        <Form.Item label="新文件上传"
                                            field="files"
                                            rules={[{ required: true, message: '请上传一个PDF文件' }]}
                                            getValueFromEvent={(files) => files}
                                        >
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <Upload
                                                    accept=".pdf"
                                                    fileList={uploadedFile ? [uploadedFile] : []}
                                                    onChange={onUploadChange}
                                                    showUploadList={false}
                                                    autoUpload={false}
                                                    multiple={false} // 明确禁止多选
                                                >
                                                    <Button type="outline">
                                                        <IconUpload /> 选择 PDF 文件
                                                    </Button>
                                                </Upload>
                                            </div>

                                            {uploadedFile && (
                                                <div
                                                    style={{
                                                        border: '1px solid #e5e6eb',
                                                        borderRadius: 4,
                                                        padding: 12,
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        background: '#fff',
                                                        marginTop: 12
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
                                                        {uploadedFile.name}
                                                    </div>
                                                    <IconClose
                                                        style={{ cursor: 'pointer', color: '#86909c' }}
                                                        onClick={handleRemoveFile}
                                                    />
                                                </div>
                                            )}
                                        </Form.Item>

                                        <Form.Item label="文件标题" field="title" rules={[{ required: true, message: '请填写文件标题' }]}>
                                            <Input placeholder="建议和上传的文件名一致" />
                                        </Form.Item>

                                        <Form.Item
                                            label="引用链接"
                                            extra="没有则留空"
                                            field='attachedLinks'
                                        >
                                            <Input
                                                placeholder="填写文件在抖音商家知识中心对应的原文链接"
                                                value={''}
                                                onChange={(val) => handleLinkChange(val)}
                                                style={{ width: '100%' }}
                                            />
                                        </Form.Item>
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
                        <Button type="primary" onClick={handleSubmit}>提交</Button>
                        <Button style={{ marginLeft: 12 }} onClick={() => history.push('/knowledge-management/all')}>取消</Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}
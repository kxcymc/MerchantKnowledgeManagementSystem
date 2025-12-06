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
import { updateKnowledge, getFileUrl } from '@/api';

export default function KnowledgeCreation() {
    const location = useLocation();
    const history = useHistory();
    const [form] = Form.useForm();
    const [hasValue, setHasValue] = useState(false);
    const [mode, setMode] = useState<'pdf' | '富文本' | ''>('');
    const [uploadedFile, setUploadedFile] = useState<UploadItem | null>(null);

    const params = new URLSearchParams(location.search)
    const knowledgeIdParam = params.get('knowledge_id');
    if (!knowledgeIdParam || Number.isNaN(Number(knowledgeIdParam))) {
        history.replace(`expection/404?errRoute=${encodeURIComponent(JSON.stringify([location.pathname, location.search].join('')))}`);
    }
    const DocTitleParam = params.get('title') ? '《' + params.get('title') + '》' : '';
    const fileTypeParam = params.get('type') || '';

    // 修改：处理单个文件上传
    const onUploadChange = (fl: UploadItem[], file: UploadItem) => {
        // 只保留最新选择的文件
        if (fl && fl.length > 0) {
            setUploadedFile(fl[fl.length - 1]);
        } else {
            setUploadedFile(null);
        }
    };

    const handleRemoveFile = () => {
        setUploadedFile(null);
        Message.success('文件已移除');
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
            const id = Number(knowledgeIdParam);

            if (mode === '富文本') {
                await updateKnowledge({
                    knowledge_id: id,
                    title: values.title,
                    content: JSON.stringify(editorContent),
                    business: values.business,
                    scene: values.scene,
                });
            } else {
                // PDF mode
                const payload: any = {
                    knowledge_id: id,
                    title: values.title,
                    business: values.business,
                    scene: values.scene,
                };
                
                if (uploadedFile && uploadedFile.originFile) {
                    payload.document = uploadedFile.originFile;
                }
                
                await updateKnowledge(payload);
            }

            Message.success('知识更新成功');
            history.push('/knowledge-management/all');
        } catch (err) {
            console.error(err);
            Message.error('更新失败，请检查表单或网络');
        }
    };

    const handleValuesChange = () => {
        setHasValue(Object.values(form.getFieldsValue()).some(val =>
            val !== undefined && val !== '' && val !== null
        ));
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
        if (type === 'pdf' || type === 'PDF') {
            const previewUrl = getFileUrl(id);
            window.open(previewUrl, '_blank');
        } else {
            history.push(`/knowledge-management/RichTextPreview?knowledge_id=${id.toString()}`)
        }
    }

    const [editorContent, setEditorContent] = useState<Descendant[][]>([
        [{
            type: 'paragraph',
            children: [{ text: '' }],
        }],
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
                    >
                        <Radio.Group value={mode} onChange={(val) => setMode(val)}>
                            <Radio value="pdf">PDF 上传</Radio>
                            <Radio value="富文本">手动输入</Radio>
                        </Radio.Group>
                    </Form.Item>

                    {mode &&
                        (
                            <>
                                <Form.Item label="编辑业务" field="business">
                                    <Select placeholder="请选择业务">
                                        <Select.Option value="经营成长">经营成长</Select.Option>
                                        <Select.Option value="招商入驻">招商入驻</Select.Option>
                                        <Select.Option value="资金结算">资金结算</Select.Option>
                                    </Select>
                                </Form.Item>

                                {isShowSceneSelectCol && (
                                    <Form.Item label="编辑场景" field="scene">
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
                                            getValueFromEvent={(fl) => fl}
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

                                        <Form.Item label="编辑文档标题" field="title">
                                            <Input placeholder="建议和上传的文件名一致" />
                                        </Form.Item>
                                    </>
                                )}

                                {mode === '富文本' && (
                                    <>
                                        <Form.Item label="编辑文档标题" field="title">
                                            <Input placeholder="输入标题" />
                                        </Form.Item>

                                        <Form.Item label="新富文本内容" field='text-content'>
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
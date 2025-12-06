import React, { useState, useEffect } from 'react';
import {
    Card,
    Typography,
    Form,
    Input,
    Button,
    Select,
    Message,
    Radio,
    Upload,
} from '@arco-design/web-react';
import { IconUpload, IconClose } from '@arco-design/web-react/icon';
import { UploadItem } from '@arco-design/web-react/es/Upload';
import { useLocation, useHistory } from 'react-router-dom';
import type { Descendant } from 'slate';
import RichTextEditor from '@/components/RichTextEditor/index';
import { updateKnowledge, getFileUrl, getKnowledgeDetail } from '@/api';

export default function KnowledgeEdit() {
    const location = useLocation();
    const history = useHistory();
    const [form] = Form.useForm();
    const [hasValue, setHasValue] = useState(false);
    const [mode, setMode] = useState<'pdf' | '富文本' | ''>('');
    const [uploadedFile, setUploadedFile] = useState<UploadItem | null>(null);

    const trimPdfSuffix = (str: any) => {
        if (typeof str !== 'string') return str;
        if (str.slice(-4).toLowerCase() === '.pdf') {
            return str.slice(0, -4);
        }
        return str;
    }

    const params = new URLSearchParams(location.search)
    const knowledgeIdParam = params.get('knowledge_id');
    if (!knowledgeIdParam || Number.isNaN(Number(knowledgeIdParam))) {
        history.replace(`expection/404?errRoute=${encodeURIComponent(JSON.stringify([location.pathname, location.search].join('')))}`);
    }
    const DocTitleParam = params.get('title') ? '《' + trimPdfSuffix(params.get('title')) + '》' : '';
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

    // 获取详情并回显
    useEffect(() => {
        // 根据 URL type 初始化 mode（保证回显时可以直接显示对应编辑区）
        const normalizedType = (fileTypeParam || '').toLowerCase();
        if (normalizedType === '富文本'.toLowerCase() || normalizedType === 'richtext') {
            setMode('富文本');
        } else if (normalizedType === 'pdf') {
            setMode('pdf');
        } else {
            setMode('');
        }

        if (!knowledgeIdParam) return;

        getKnowledgeDetail({ knowledge_id: Number(knowledgeIdParam) })
            .then(res => {
                console.log(res);

                if (res && res.data) {
                    const knowledgeItem = res.data;

                    // 回显表单字段
                    form.setFieldsValue({
                        title: trimPdfSuffix(knowledgeItem.title),
                        business: knowledgeItem.business,
                        scene: knowledgeItem.scene,
                    });

                    // setFieldsValue 不会触发 onValuesChange，所以在这里手动同步
                    // 是否显示场景选择列
                    setIsShowSceneSelectCol(knowledgeItem.business === '招商入驻');

                    // 是否存在表单值（用于提交按钮可用性）
                    setHasValue(
                        [knowledgeItem.title, knowledgeItem.business, knowledgeItem.scene].some(val =>
                            val !== undefined && val !== '' && val !== null
                        )
                    );


                    // 回显富文本内容
                    if (knowledgeItem && knowledgeItem.content) {
                        let contentData: any = knowledgeItem.content;
                        if (typeof contentData === 'string') {
                            try {
                                contentData = JSON.parse(contentData);
                            } catch (e) {
                                console.error('Parse content error', e);
                            }
                        }
                        // 确保格式为 Descendant[][]
                        if (Array.isArray(contentData) && contentData.length > 0) {
                            if (Array.isArray(contentData[0])) {
                                setEditorContent(contentData as Descendant[][]);
                            } else {
                                setEditorContent([contentData] as Descendant[][]);
                            }
                        }
                    }
                }
            })
            .catch(err => console.error(err));
        // 依赖 knowledgeIdParam / fileTypeParam，参数变化时重新拉取并回显
    }, [knowledgeIdParam, fileTypeParam, form]);

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
                                                    multiple={false}
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
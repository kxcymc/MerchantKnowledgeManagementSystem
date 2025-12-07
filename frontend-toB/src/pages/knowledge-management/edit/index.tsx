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

    const onUploadChange = (fl: UploadItem[], file: UploadItem) => {
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

            if (!knowledgeIdParam) {
                Message.error('知识ID无效');
                return;
            }

            const currentType = mode === '富文本' ? 'json' : 'pdf';
            const isTypeConversion = originalType && originalType !== currentType;

            if (isTypeConversion) {
                try {
                    const deleteResponse = await fetch(`/api/knowledge/${knowledgeIdParam}`, {
                        method: 'DELETE',
                    });

                    if (!deleteResponse.ok) {
                        const errorData = await deleteResponse.json();
                        throw new Error(errorData.message || '删除旧记录失败');
                    }

                    if (mode === '富文本') {
                        const payload = {
                            business: values.business,
                            scene: values.scene || '',
                            title: values.title || '',
                            content: JSON.stringify(editorContent),
                            type: 'json'
                        };

                        const createResponse = await fetch('/api/add', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload),
                        });

                        if (!createResponse.ok) {
                            const errorData = await createResponse.json();
                            throw new Error(errorData.message || '创建新记录失败');
                        }

                        Message.success('类型转换成功：已删除旧记录并创建新记录');
                    } else if (mode === 'pdf') {
                        if (!uploadedFile || !uploadedFile.originFile) {
                            Message.error('类型转换为PDF时，必须上传PDF文件');
                            return;
                        }

                        const formData = new FormData();
                        formData.append('document', uploadedFile.originFile as File);
                        formData.append('business', values.business);
                        formData.append('scene', values.scene || '');
                        formData.append('title', values.title || uploadedFile.name || '未知标题');

                        const createResponse = await fetch('/api/add', {
                            method: 'POST',
                            body: formData,
                        });

                        if (!createResponse.ok) {
                            const errorData = await createResponse.json();
                            throw new Error(errorData.message || '创建新记录失败');
                        }

                        Message.success('类型转换成功：已删除旧记录并创建新记录');
                    }

                    history.push('/knowledge-management/all');
                } catch (err) {
                    console.error('类型转换失败:', err);
                    Message.error(err instanceof Error ? err.message : '类型转换失败');
                }
            } else {
                if (mode === '富文本') {
                    const payload = {
                        knowledge_id: knowledgeIdParam,
                        business: values.business,
                        scene: values.scene || '',
                        title: values.title || '',
                        content: JSON.stringify(editorContent)
                    };

                    const response = await fetch('/api/update', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || '更新失败');
                    }

                    const result = await response.json();
                    Message.success(result.message || '知识更新成功');
                    history.push('/knowledge-management/all');
                } else if (mode === 'pdf') {
                    const formData = new FormData();
                    
                    if (uploadedFile && uploadedFile.originFile) {
                        formData.append('document', uploadedFile.originFile as File);
                    }
                    
                    formData.append('knowledge_id', knowledgeIdParam);
                    formData.append('business', values.business);
                    formData.append('scene', values.scene || '');
                    if (values.title) {
                        formData.append('title', values.title);
                    }

                    const response = await fetch('/api/update', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || '更新失败');
                    }

                    const result = await response.json();
                    Message.success(result.message || '知识更新成功');
                    history.push('/knowledge-management/all');
                } else {
                    Message.error('请选择编辑方式');
                }
            }
        } catch (err) {
            console.error('更新失败:', err);
            Message.error(err instanceof Error ? err.message : '更新失败,请检查表单必填项');
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
        if (type === 'PDF' || type === 'pdf') {
            const fileUrl = `/api/file/${id}`;
            window.open(fileUrl, '_blank');
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
    const [originalEditorContent, setOriginalEditorContent] = useState<Descendant[][] | null>(null);
    const [isShowSceneSelectCol, setIsShowSceneSelectCol] = useState(false);
    const [loading, setLoading] = useState(false);
    const [originalType, setOriginalType] = useState<'pdf' | 'json' | ''>('');
    // 移除 editorKey，改用其他方式
    const [editorReady, setEditorReady] = useState(false);

    useEffect(() => {
        if (!knowledgeIdParam) return;

        const loadKnowledge = async () => {
            try {
                setLoading(true);
                // 重置编辑器准备状态
                setEditorReady(false);
                
                const res = await getKnowledgeDetail({ knowledge_id: Number(knowledgeIdParam) }, { skipGlobalLoading: true });
                
                if (res && res.data) {
                    const knowledgeItem = res.data;

                    form.setFieldsValue({
                        title: trimPdfSuffix(knowledgeItem.title),
                        business: knowledgeItem.business,
                        scene: knowledgeItem.scene,
                    });

                    setIsShowSceneSelectCol(knowledgeItem.business === '招商入驻');
                    setHasValue(
                        [knowledgeItem.title, knowledgeItem.business, knowledgeItem.scene].some(val =>
                            val !== undefined && val !== '' && val !== null
                        )
                    );

                    const normalizedUrlType = (fileTypeParam || '').toLowerCase();
                    let targetMode: 'pdf' | '富文本' | '' = '';
                    let targetOriginalType: 'pdf' | 'json' | '' = '';

                    if (knowledgeItem.type === 'json') {
                        targetOriginalType = 'json';
                        if (normalizedUrlType === 'pdf') {
                            targetMode = 'pdf';
                        } else {
                            targetMode = '富文本';
                        }
                    } else if (knowledgeItem.type === 'pdf') {
                        targetOriginalType = 'pdf';
                        if (normalizedUrlType === 'richtext' || normalizedUrlType === '富文本') {
                            targetMode = '富文本';
                        } else {
                            targetMode = 'pdf';
                        }
                    }

                    let formattedContent: Descendant[][];
                    
                    if (knowledgeItem.type === 'json' && knowledgeItem.content) {
                        let contentData: any = knowledgeItem.content;
                        
                        if (typeof contentData === 'string') {
                            try {
                                contentData = JSON.parse(contentData);
                            } catch (e) {
                                console.error('Parse content error', e);
                            }
                        }

                        if (Array.isArray(contentData)) {
                            if (contentData.length > 0 && Array.isArray(contentData[0])) {
                                formattedContent = contentData as Descendant[][];
                            } else if (contentData.length > 0) {
                                formattedContent = [contentData] as Descendant[][];
                            } else {
                                formattedContent = [[{ type: 'paragraph', children: [{ text: '' }] }]];
                            }
                        } else {
                            formattedContent = [contentData] as Descendant[][];
                        }

                        console.log('加载富文本内容:', formattedContent);
                    } else {
                        formattedContent = [[{ type: 'paragraph', children: [{ text: '' }] }]];
                    }

                    // 关键修复：先同步设置所有状态
                    setOriginalType(targetOriginalType);
                    setMode(targetMode);
                    
                    // 延迟设置内容，确保 mode 已经渲染
                    setTimeout(() => {
                        console.log('设置 editorContent:', formattedContent);
                        setEditorContent(formattedContent);
                        setOriginalEditorContent(formattedContent);
                        
                        // 再延迟一点显示编辑器
                        setTimeout(() => {
                            console.log('准备渲染编辑器，editorContent 应该已设置');
                            setEditorReady(true);
                            setLoading(false);
                        }, 50);
                    }, 50);
                } else {
                    setLoading(false);
                }
            } catch (err) {
                console.error('加载知识详情失败:', err);
                Message.error('加载数据失败');
                setLoading(false);
            }
        };

        loadKnowledge();
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
                        <Radio.Group value={mode} onChange={(val) => {
                            setMode(val);
                            if (val === '富文本' && originalType === 'json' && originalEditorContent) {
                                setEditorReady(false);
                                setTimeout(() => {
                                    setEditorContent(originalEditorContent);
                                    setTimeout(() => {
                                        setEditorReady(true);
                                    }, 50);
                                }, 50);
                            }
                        }}>
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
                                        <Form.Item label="新文件上传（可选）"
                                            field="files"
                                            getValueFromEvent={(fl) => fl}
                                            extra="不上传新文件时，将只更新业务、场景等信息"
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
                                                        <IconUpload /> 选择 PDF 文件（可选）
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

                                        <Form.Item label="富文本内容" >
                                            {loading || !editorReady ? (
                                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                                    加载中...
                                                </div>
                                            ) : (
                                                <RichTextEditor
                                                    value={editorContent}
                                                    onChange={setEditorContent}
                                                />
                                            )}
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
import React, { useState, useEffect } from 'react';
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

            if (!knowledgeIdParam) {
                Message.error('知识ID无效');
                return;
            }

            // 检测类型转换
            const currentType = mode === '富文本' ? 'json' : 'pdf';
            const isTypeConversion = originalType && originalType !== currentType;

            if (isTypeConversion) {
                // 类型转换：先删除旧记录，再创建新记录
                try {
                    // 1. 删除旧记录
                    const deleteResponse = await fetch(`/api/knowledge/${knowledgeIdParam}`, {
                        method: 'DELETE',
                    });

                    if (!deleteResponse.ok) {
                        const errorData = await deleteResponse.json();
                        throw new Error(errorData.message || '删除旧记录失败');
                    }

                    // 2. 创建新记录
                    if (mode === '富文本') {
                        // 创建富文本
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
                        // 创建PDF
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
                // 没有类型转换，正常更新
                if (mode === '富文本') {
                    // 富文本模式：发送 JSON 数据
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
                    // PDF 模式：可以只更新场景等信息，不必须上传新文件
                    const formData = new FormData();
                    
                    // 如果上传了新文件，则包含文件
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
            Message.error(err instanceof Error ? err.message : '更新失败，请检查表单必填项');
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
            // 使用后端文件接口进行预览
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
    const [originalEditorContent, setOriginalEditorContent] = useState<Descendant[][] | null>(null); // 保存原始富文本内容
    const [isShowSceneSelectCol, setIsShowSceneSelectCol] = useState(false);
    const [loading, setLoading] = useState(false);
    const [originalType, setOriginalType] = useState<'pdf' | 'json' | ''>(''); // 记录原始类型

    // 加载现有数据
    useEffect(() => {
        const loadKnowledge = async () => {
            if (!knowledgeIdParam) return;
            
            try {
                setLoading(true);
                const res = await fetch(`/api/query?knowledge_id=${knowledgeIdParam}`);
                if (!res.ok) {
                    throw new Error('加载数据失败');
                }
                
                const data = await res.json();
                
                // 设置表单初始值
                if (data.business) {
                    form.setFieldValue('business', data.business);
                    if (data.business === '招商入驻') {
                        setIsShowSceneSelectCol(true);
                    }
                }
                if (data.scene) {
                    form.setFieldValue('scene', data.scene);
                }
                if (data.title) {
                    form.setFieldValue('title', data.title);
                }
                
                // 记录原始类型和内容
                if (data.type === 'json') {
                    setOriginalType('json');
                    setMode('富文本');
                    // content 可能是数组或对象，需要确保格式正确
                    // 后端返回的 content 应该是 Descendant[][] 格式（多页）或 Descendant[] 格式（单页）
                    if (data.content) {
                        let formattedContent: Descendant[][];
                        if (Array.isArray(data.content)) {
                            // 检查是否是二维数组（多页格式）
                            if (data.content.length > 0 && Array.isArray(data.content[0])) {
                                // 多页格式：Descendant[][]
                                formattedContent = data.content;
                            } else if (data.content.length > 0) {
                                // 单页格式：Descendant[]，包装成二维数组
                                formattedContent = [data.content];
                            } else {
                                // 空数组，使用默认值
                                formattedContent = [[{ type: 'paragraph', children: [{ text: '' }] }]];
                            }
                        } else {
                            // 如果不是数组，尝试包装
                            formattedContent = [data.content];
                        }
                        // 确保内容格式正确后再设置
                        console.log('加载富文本内容:', formattedContent);
                        setEditorContent(formattedContent);
                        setOriginalEditorContent(formattedContent); // 保存原始内容
                    } else {
                        // 如果没有内容，使用默认值
                        const defaultContent = [[{ type: 'paragraph', children: [{ text: '' }] }]];
                        setEditorContent(defaultContent);
                        setOriginalEditorContent(defaultContent);
                    }
                } else if (data.type === 'pdf') {
                    setOriginalType('pdf');
                    setMode('pdf');
                }
                
                setHasValue(true);
            } catch (err) {
                console.error('加载知识数据失败:', err);
                Message.error('加载数据失败');
            } finally {
                setLoading(false);
            }
        };
        
        loadKnowledge();
    }, [knowledgeIdParam, form]);

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
                            // 如果切换到富文本模式，且原来是富文本类型，恢复显示原有内容
                            if (val === '富文本' && originalType === 'json' && originalEditorContent) {
                                setEditorContent(originalEditorContent);
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
                                                    multiple={false} // 明确禁止多选
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

                                        <Form.Item label="富文本内容" field='text-content'>
                                            {loading ? (
                                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                                    加载中...
                                                </div>
                                            ) : (
                                                <RichTextEditor
                                                    key={`editor-${knowledgeIdParam}-${originalType}-${mode}`}
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
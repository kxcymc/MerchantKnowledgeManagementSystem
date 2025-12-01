import { IRoute, routes } from "./routes";
import { Descendant } from 'slate';
import { CustomElement } from "@/components/RichTextEditor";


export const emptyData = [
    {
      "type": "paragraph",
      "children": [{"text": ""}]
    }
]

export const RICH_TEXT_EXAMPLE_DATA: Descendant[][] = [
  // 第1页：基础格式测试
  [
    {
      type: 'heading-one',
      align: 'center',
      lineHeight: 1.8,
      marginBottom: 1,
      children: [
        { text: 'Slate', bold: true },
        { text: ' 富文本编辑器', bold: false }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      lineHeight: 1.6,
      marginBottom: 0.5,
      children: [
        { text: '这是一个功能全面的富文本编辑器测试文档，支持多种文本格式和排版选项。' }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      lineHeight: 1.6,
      children: [
        { text: '支持 ' },
        { text: '加粗', bold: true },
        { text: '、' },
        { text: '斜体', italic: true },
        { text: '、' },
        { text: '下划线', underline: true },
        { text: ' 和 ' },
        { text: '删除线', strikethrough: true },
        { text: ' 等基础文本样式。' }
      ]
    } as CustomElement,
    {
      type: 'heading-two',
      align: 'left',
      marginBottom: 0.8,
      children: [
        { text: '列表功能演示' }
      ]
    } as CustomElement,
    {
      type: 'bulleted-list',
      children: [
        {
          type: 'list-item',
          children: [
            { text: '无序列表项 1' }
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            { text: '无序列表项 2' }
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            { text: '无序列表项 3' }
          ]
        } as CustomElement
      ]
    } as CustomElement,
    {
      type: 'numbered-list',
      children: [
        {
          type: 'list-item',
          children: [
            { text: '有序列表项 1' }
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            { text: '嵌套的' },
            { text: '混合', bold: true, italic: true },
            { text: '样式' }
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            { text: '有序列表项 3' }
          ]
        } as CustomElement
      ]
    } as CustomElement,
    {
      type: 'horizontal-rule',
      children: [{ text: '' }]
    } as CustomElement,
    {
      type: 'block-quote',
      align: 'left',
      textIndent: 1,
      letterSpacing: 0.5,
      children: [
        { text: '这是一段引用文字，展示了引用块的样式效果。可以通过设置调整对齐方式、缩进和字间距。' }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      align: 'right',
      marginBottom: 1,
      children: [
        { text: '右对齐的段落示例。' }
      ]
    } as CustomElement
  ],
  // 第2页：标题层级与链接测试
  [
    {
      type: 'heading-one',
      align: 'left',
      children: [
        { text: '标题层级测试', underline: true }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      lineHeight: 1.5,
      children: [
        { text: '以下是不同层级的标题展示：' }
      ]
    } as CustomElement,
    {
      type: 'heading-one',
      children: [
        { text: '一级标题 (H1)' }
      ]
    } as CustomElement,
    {
      type: 'heading-two',
      children: [
        { text: '二级标题 ' },
        { text: '(H2)', italic: true }
      ]
    } as CustomElement,
    {
      type: 'heading-three',
      children: [
        { text: '三级标题 ', strikethrough: false },
        { text: '带粗体', bold: true }
      ]
    } as CustomElement,
    {
      type: 'heading-two',
      align: 'center',
      marginBottom: 1.2,
      children: [
        { text: '链接功能测试' }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      align: 'left',
      children: [
        { text: '支持插入超链接：' },
        {
          type: 'link',
          url: 'https://www.example.com',
          children: [
            { text: '示例链接' }
          ]
        } as CustomElement,
        { text: ' 和 ' },
        {
          type: 'link',
          url: 'https://github.com',
          children: [
            { text: 'GitHub', bold: true }
          ]
        } as CustomElement,
        { text: '。' }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      lineHeight: 2,
      letterSpacing: 1,
      children: [
        { text: '这是一个行高为 2.0、字间距为 1px 的段落，用于测试排版设置功能。' }
      ]
    } as CustomElement,
    {
      type: 'heading-three',
      align: 'right',
      marginBottom: 0.5,
      children: [
        { text: '右对齐的三级标题' }
      ]
    } as CustomElement,
    {
      type: 'bulleted-list',
      children: [
        {
          type: 'list-item',
          children: [
            {
              type: 'link',
              url: 'https://www.w3.org',
              children: [
                { text: '列表中的链接' }
              ]
            } as CustomElement
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            { text: '纯文本列表项' }
          ]
        } as CustomElement
      ]
    } as CustomElement,
    {
      type: 'horizontal-rule',
      children: [{ text: '' }]
    } as CustomElement,
    {
      type: 'paragraph',
      marginBottom: 1.5,
      children: [
        { text: '文末段落，包含所有格式：' },
        { text: '粗体斜体下划线', bold: true, italic: true, underline: true },
        { text: ' 和 ' },
        { text: '删除线组合', strikethrough: true, bold: true }
      ]
    } as CustomElement
  ],
  // 第3页：复杂排版与边距测试
  [
    {
      type: 'heading-two',
      align: 'center',
      lineHeight: 1.8,
      marginBottom: 1,
      children: [
        { text: '复杂排版测试页面' }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      textIndent: 2,
      lineHeight: 1.7,
      marginBottom: 1.5,
      children: [
        { text: '首行缩进 2em 的段落，用于测试中文排版场景。此段落的行高为 1.7，段后间距为 1.5em，确保阅读体验舒适。' }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      textIndent: 2,
      lineHeight: 1.7,
      children: [
        {
          type: 'link',
          url: 'https://www.wikipedia.org',
          children: [
            { text: '维基百科', bold: true }
          ]
        } as CustomElement,
        { text: ' 是一个多语言、内容自由、公开的百科全书协作计划。其内容由全球志愿者共同编写，涵盖几乎所有领域的知识。' }
      ]
    } as CustomElement,
    {
      type: 'block-quote',
      align: 'left',
      lineHeight: 1.5,
      marginBottom: 1.5,
      textIndent: 0,
      children: [
        { text: '引用块内的文字：知识的共享是人类进步的基石。' }
      ]
    } as CustomElement,
    {
      type: 'numbered-list',
      marginBottom: 1.5,
      children: [
        {
          type: 'list-item',
          children: [
            { text: '步骤一：准备材料' }
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            { text: '步骤二：按说明操作' }
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            { text: '步骤三：检查结果，确保' },
            { text: '所有项目', bold: true, underline: true },
            { text: '正确完成' }
          ]
        } as CustomElement
      ]
    } as CustomElement,
    {
      type: 'heading-three',
      align: 'left',
      marginBottom: 0.8,
      children: [
        { text: '混合样式演示' }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      align: 'center',
      lineHeight: 1.6,
      marginBottom: 0.5,
      children: [
        { text: '居中段落，包含 ' },
        { text: '粗体', bold: true },
        { text: '、' },
        { text: '斜体', italic: true },
        { text: '、' },
        { text: '下划线', underline: true },
        { text: ' 和 ' },
        { text: '删除线', strikethrough: true },
        { text: ' 效果。' }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      align: 'right',
      letterSpacing: 2,
      children: [
        { text: '右对齐且字间距为 2px 的段落。' }
      ]
    } as CustomElement,
    {
      type: 'horizontal-rule',
      children: [{ text: '' }]
    } as CustomElement,
    {
      type: 'paragraph',
      lineHeight: 2,
      marginBottom: 2,
      children: [
        { text: '最终段落，行高 2.0，段后间距 2em，用于测试编辑器对复杂排版的支持能力。' }
      ]
    } as CustomElement
  ],
  // 第4页：极限样式与嵌套测试
  [
    {
      type: 'heading-one',
      align: 'center',
      lineHeight: 1.5,
      marginBottom: 1,
      children: [
        { text: '极限样式测试', bold: true, italic: true, underline: true, strikethrough: false }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      align: 'left',
      lineHeight: 3,
      marginBottom: 0.5,
      letterSpacing: 3,
      children: [
        { text: '行高3.0、字间距3px的极端排版测试。', bold: true, italic: true, underline: true, strikethrough: true }
      ]
    } as CustomElement,
    {
      type: 'bulleted-list',
      children: [
        {
          type: 'list-item',
          children: [
            { text: '列表项1：普通文本' }
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            {
              type: 'link',
              url: 'https://www.example.com/page2',
              children: [
                { text: '列表项2：包含链接', bold: true }
              ]
            } as CustomElement
          ]
        } as CustomElement,
        {
          type: 'list-item',
          children: [
            { text: '列表项3：' },
            { text: '粗体', bold: true },
            { text: '和' },
            { text: '斜体', italic: true },
            { text: '混合' }
          ]
        } as CustomElement
      ]
    } as CustomElement,
    {
      type: 'horizontal-rule',
      children: [{ text: '' }]
    } as CustomElement,
    {
      type: 'block-quote',
      align: 'center',
      lineHeight: 2,
      marginBottom: 1.5,
      textIndent: 1,
      children: [
        { text: '居中、带缩进、大段间距的引用块，展示编辑器对多属性组合的支持。', italic: true }
      ]
    } as CustomElement,
    {
      type: 'heading-three',
      align: 'right',
      marginBottom: 1,
      children: [
        { text: '右对齐的三级标题', strikethrough: true }
      ]
    } as CustomElement,
    {
      type: 'paragraph',
      align: 'center',
      textIndent: 0,
      children: [
        { text: '尾段：包含 ' },
        {
          type: 'link',
          url: 'https://www.endofdocument.com',
          children: [
            { text: '最终链接' }
          ]
        } as CustomElement,
        { text: ' 和所有格式 ' },
        { text: 'B', bold: true },
        { text: 'I', italic: true },
        { text: 'U', underline: true },
        { text: 'S', strikethrough: true }
      ]
    } as CustomElement,
    {
      type: 'horizontal-rule',
      children: [{ text: '' }]
    } as CustomElement,
    {
      type: 'paragraph',
      marginBottom: 1,
      children: [
        { text: '测试文档结束。' }
      ]
    } as CustomElement
  ]
];

type RouteMap = Record<string, string>;
/**
 * 自动将嵌套的路由配置转换为平面的 RouteMap
 * 会递归遍历所有子路由
 * 
 * @param routes - 路由配置数组
 * @returns 路由映射对象，key 为 `/` 开头的路径，value 为路由名称
 */
function transformRoutesToMap(routes: IRoute[]): RouteMap {
  const routeMap: RouteMap = {};

  const traverse = (routeList: IRoute[]): void => {
    for (const route of routeList) {
      // 构建完整路径并添加到映射表
      // 注意：key 已经包含完整路径，直接前置 / 即可
      routeMap[`/${route.key}`] = route.name;

      // 递归处理子路由（如果存在）
      if (route.children?.length) {
        traverse(route.children);
      }
    }
  };

  traverse(routes);
  return routeMap;
}

export const RouteMap : RouteMap = transformRoutesToMap(routes);

export type KnowledgeDoc = {
    knowledge_id: number;
    business: '经营成长' | '招商入驻' | '资金结算';
    scene?: '入驻与退出' | '保证金管理';
    title: string;
    type: 'PDF'|'富文本' | string;
    file_size: string;
    created_at: string;
    status: '生效中'| '已失效';
    preview?: string; // url or base64 or placeholder
};

export const knowledgeList: KnowledgeDoc[] = [
    { knowledge_id: 1, business: '招商入驻', scene: '入驻与退出', title: '入驻流程与退出规范（v1）', type: 'PDF', file_size: '1.2 MB', created_at: '2025-11-20', status: '生效中', preview: '' },
    { knowledge_id: 2, business: '招商入驻', scene: '保证金管理', title: '保证金收取与退还流程', type: 'DOCX', file_size: '850 KB', created_at: '2025-10-12', status: '生效中', preview: '' },
    { knowledge_id: 3, business: '经营成长', title: '商家成长策略概览', type: 'PDF', file_size: '2.3 MB', created_at: '2025-09-01', status: '生效中', preview: '' },
    { knowledge_id: 4, business: '资金结算', title: '资金结算周期与对账', type: 'XLSX', file_size: '430 KB', created_at: '2025-08-18', status: '生效中', preview: '' },
    { knowledge_id: 5, business: '经营成长', title: '商家运营增长案例合集', type: 'PDF', file_size: '5.1 MB', created_at: '2025-07-22', status: '已失效', preview: '' },
    { knowledge_id: 6, business: '经营成长', title: '新商家冷启动指南', type: 'PDF', file_size: '1.8 MB', created_at: '2025-06-15', status: '生效中', preview: '' },
    { knowledge_id: 7, business: '招商入驻', scene: '入驻与退出', title: '特殊类目入驻资质要求', type: 'DOCX', file_size: '967 KB', created_at: '2025-05-28', status: '生效中', preview: '' },
    { knowledge_id: 8, business: '资金结算', title: '跨境结算汇率说明', type: 'XLSX', file_size: '612 KB', created_at: '2025-05-10', status: '生效中', preview: '' },
    { knowledge_id: 9, business: '经营成长', title: '广告投放效果优化手册', type: 'PPTX', file_size: '3.2 MB', created_at: '2025-04-22', status: '已失效', preview: '' },
    { knowledge_id: 10, business: '招商入驻', scene: '保证金管理', title: '保证金补缴与扣除规则', type: 'PDF', file_size: '1.1 MB', created_at: '2025-03-18', status: '生效中', preview: '' },
    { knowledge_id: 11, business: '资金结算', title: '月度结算异常处理流程', type: 'DOCX', file_size: '789 KB', created_at: '2025-03-05', status: '生效中', preview: '' },
    { knowledge_id: 12, business: '经营成长', title: '高价值用户运营策略', type: 'PDF', file_size: '2.7 MB', created_at: '2025-02-20', status: '生效中', preview: '' },
    { knowledge_id: 13, business: '招商入驻', scene: '入驻与退出', title: '品牌旗舰店入驻标准', type: 'DOCX', file_size: '923 KB', created_at: '2025-01-28', status: '生效中', preview: '' },
    { knowledge_id: 14, business: '资金结算', title: '结算账户变更申请指引', type: 'PDF', file_size: '1.4 MB', created_at: '2025-01-15', status: '生效中', preview: '' },
    { knowledge_id: 15, business: '经营成长', title: '商品详情页转化率优化', type: 'PPTX', file_size: '4.5 MB', created_at: '2024-12-30', status: '已失效', preview: '' },
    { knowledge_id: 16, business: '招商入驻', scene: '保证金管理', title: '保证金冻结与解冻说明', type: 'XLSX', file_size: '534 KB', created_at: '2024-12-18', status: '生效中', preview: '' },
    { knowledge_id: 17, business: '资金结算', title: '季度对账差异处理指南', type: 'PDF', file_size: '1.9 MB', created_at: '2024-12-05', status: '生效中', preview: '' },
    { knowledge_id: 18, business: '经营成长', title: '直播带货运营规范', type: 'DOCX', file_size: '1.6 MB', created_at: '2024-11-22', status: '生效中', preview: '' },
    { knowledge_id: 19, business: '招商入驻', scene: '入驻与退出', title: '个体工商户入驻指引', type: 'PDF', file_size: '2.1 MB', created_at: '2024-11-10', status: '生效中', preview: '' },
    { knowledge_id: 20, business: '资金结算', title: '退款订单结算处理', type: 'XLSX', file_size: '678 KB', created_at: '2024-10-28', status: '已失效', preview: '' },
    { knowledge_id: 21, business: '经营成长', title: '会员体系建设指南', type: 'PDF', file_size: '3.3 MB', created_at: '2024-10-15', status: '生效中', preview: '' },
    { knowledge_id: 22, business: '招商入驻', scene: '保证金管理', title: '保证金比例调整通知', type: 'DOCX', file_size: '845 KB', created_at: '2024-09-30', status: '生效中', preview: '' },
    { knowledge_id: 23, business: '资金结算', title: '手续费率说明文档', type: 'PDF', file_size: '1.2 MB', created_at: '2024-09-18', status: '生效中', preview: '' },
    { knowledge_id: 24, business: '经营成长', title: '短视频内容创作手册', type: 'PPTX', file_size: '5.8 MB', created_at: '2024-09-05', status: '生效中', preview: '' },
    { knowledge_id: 25, business: '招商入驻', scene: '入驻与退出', title: '店铺转让与承接流程', type: 'DOCX', file_size: '1.1 MB', created_at: '2024-08-25', status: '已失效', preview: '' },
    { knowledge_id: 26, business: '资金结算', title: '提现到账时间说明', type: 'XLSX', file_size: '456 KB', created_at: '2024-08-12', status: '生效中', preview: '' },
    { knowledge_id: 27, business: '经营成长', title: '私域流量运营攻略', type: 'PDF', file_size: '2.4 MB', created_at: '2024-07-30', status: '生效中', preview: '' },
    { knowledge_id: 28, business: '招商入驻', scene: '保证金管理', title: '保证金发票申请流程', type: 'PDF', file_size: '987 KB', created_at: '2024-07-18', status: '生效中', preview: '' },
    { knowledge_id: 29, business: '资金结算', title: '供应链金融结算指引', type: 'DOCX', file_size: '1.7 MB', created_at: '2024-07-05', status: '生效中', preview: '' },
    { knowledge_id: 30, business: '经营成长', title: '大促活动报名指南', type: 'XLSX', file_size: '2.9 MB', created_at: '2024-06-25', status: '已失效', preview: '' },
    { knowledge_id: 31, business: '招商入驻', scene: '入驻与退出', title: '跨境电商入驻政策', type: 'PDF', file_size: '3.1 MB', created_at: '2024-06-12', status: '生效中', preview: '' },
    { knowledge_id: 32, business: '资金结算', title: '发票管理与结算关联', type: 'DOCX', file_size: '1.3 MB', created_at: '2024-05-30', status: '生效中', preview: '' },
    { knowledge_id: 33, business: '经营成长', title: '客服团队管理手册', type: 'PPTX', file_size: '4.2 MB', created_at: '2024-05-18', status: '生效中', preview: '' },
    { knowledge_id: 34, business: '招商入驻', scene: '保证金管理', title: '保证金预警机制说明', type: 'XLSX', file_size: '567 KB', created_at: '2024-05-05', status: '生效中', preview: '' },
    { knowledge_id: 35, business: '资金结算', title: '分账系统操作手册', type: 'PDF', file_size: '2.0 MB', created_at: '2024-04-25', status: '已失效', preview: '' },
    { knowledge_id: 36, business: '经营成长', title: '爆款打造方法论', type: 'DOCX', file_size: '1.5 MB', created_at: '2024-04-12', status: '生效中', preview: '' },
    { knowledge_id: 37, business: '招商入驻', scene: '入驻与退出', title: '经销商入驻合作协议', type: 'PDF', file_size: '2.8 MB', created_at: '2024-03-30', status: '生效中', preview: '' },
    { knowledge_id: 38, business: '资金结算', title: '结算数据报表模板', type: 'XLSX', file_size: '823 KB', created_at: '2024-03-18', status: '生效中', preview: '' },
    { knowledge_id: 39, business: '经营成长', title: '用户评价管理规范', type: 'PDF', file_size: '1.6 MB', created_at: '2024-03-05', status: '生效中', preview: '' },
    { knowledge_id: 40, business: '招商入驻', scene: '保证金管理', title: '历史保证金迁移方案', type: 'DOCX', file_size: '1.2 MB', created_at: '2024-02-25', status: '已失效', preview: '' },
    { knowledge_id: 41, business: '资金结算', title: '虚拟货币结算政策', type: 'PDF', file_size: '3.4 MB', created_at: '2024-02-12', status: '生效中', preview: '' },
    { knowledge_id: 42, business: '经营成长', title: '新品上市推广策略', type: 'PPTX', file_size: '5.3 MB', created_at: '2024-01-30', status: '生效中', preview: '' },
    { knowledge_id: 43, business: '招商入驻', scene: '入驻与退出', title: '快时尚类目入驻标准', type: 'DOCX', file_size: '945 KB', created_at: '2024-01-18', status: '生效中', preview: '' },
    { knowledge_id: 44, business: '资金结算', title: '延迟结算申诉流程', type: 'XLSX', file_size: '678 KB', created_at: '2024-01-05', status: '生效中', preview: '' },
    { knowledge_id: 45, business: '经营成长', title: '供应链协同管理', type: 'PDF', file_size: '2.2 MB', created_at: '2023-12-25', status: '已失效', preview: '' },
    { knowledge_id: 46, business: '招商入驻', scene: '保证金管理', title: '保证金利息计算规则', type: 'PDF', file_size: '876 KB', created_at: '2023-12-12', status: '生效中', preview: '' },
    { knowledge_id: 47, business: '资金结算', title: '结算周期变更申请表', type: 'DOCX', file_size: '512 KB', created_at: '2023-11-30', status: '生效中', preview: '' },
    { knowledge_id: 48, business: '经营成长', title: '社群营销实战案例', type: 'XLSX', file_size: '3.7 MB', created_at: '2023-11-18', status: '生效中', preview: '' },
    { knowledge_id: 49, business: '招商入驻', scene: '入驻与退出', title: '数码家电类目入驻细则', type: 'PDF', file_size: '4.1 MB', created_at: '2023-11-05', status: '生效中', preview: '' },
    { knowledge_id: 50, business: '资金结算', title: '跨境汇款结算指引', type: 'PPTX', file_size: '2.5 MB', created_at: '2023-10-25', status: '已失效', preview: '' },
    { knowledge_id: 51, business: '经营成长', title: '数据驱动决策手册', type: 'DOCX', file_size: '1.9 MB', created_at: '2023-10-12', status: '生效中', preview: '' },
    { knowledge_id: 52, business: '招商入驻', scene: '保证金管理', title: '保证金最低额度标准', type: 'XLSX', file_size: '445 KB', created_at: '2023-09-30', status: '生效中', preview: '' },
    { knowledge_id: 53, business: '资金结算', title: '结算异常自动预警', type: 'PDF', file_size: '1.8 MB', created_at: '2023-09-18', status: '生效中', preview: '' },
    { knowledge_id: 54, business: '经营成长', title: '会员积分体系设计', type: 'DOCX', file_size: '2.6 MB', created_at: '2023-09-05', status: '生效中', preview: '' },
    { knowledge_id: 55, business: '招商入驻', scene: '入驻与退出', title: '食品生鲜类目准入规则', type: 'PDF', file_size: '3.8 MB', created_at: '2023-08-25', status: '已失效', preview: '' },
    { knowledge_id: 56, business: '资金结算', title: '代收代付结算协议', type: 'XLSX', file_size: '789 KB', created_at: '2023-08-12', status: '生效中', preview: '' },
    { knowledge_id: 57, business: '经营成长', title: '商品定价策略指南', type: 'PPTX', file_size: '4.7 MB', created_at: '2023-07-30', status: '生效中', preview: '' },
    { knowledge_id: 58, business: '招商入驻', scene: '保证金管理', title: '保证金争议处理流程', type: 'DOCX', file_size: '1.4 MB', created_at: '2023-07-18', status: '生效中', preview: '' },
    { knowledge_id: 59, business: '资金结算', title: '供应商结算优先级规则', type: 'PDF', file_size: '2.3 MB', created_at: '2023-07-05', status: '生效中', preview: '' },
    { knowledge_id: 60, business: '经营成长', title: '节假日营销日历', type: 'XLSX', file_size: '1.1 MB', created_at: '2023-06-25', status: '已失效', preview: '' },
    { knowledge_id: 61, business: '招商入驻', scene: '入驻与退出', title: '母婴用品类目入驻指南', type: 'PDF', file_size: '5.5 MB', created_at: '2023-06-12', status: '生效中', preview: '' },
    { knowledge_id: 62, business: '资金结算', title: '结算手续费计算明细', type: 'DOCX', file_size: '632 KB', created_at: '2023-05-30', status: '生效中', preview: '' },
    { knowledge_id: 63, business: '经营成长', title: '竞品分析方法论', type: 'XLSX', file_size: '3.2 MB', created_at: '2023-05-18', status: '生效中', preview: '' },
    { knowledge_id: 64, business: '招商入驻', scene: '保证金管理', title: '保证金催缴通知模板', type: 'PDF', file_size: '789 KB', created_at: '2023-05-05', status: '生效中', preview: '' },
    { knowledge_id: 65, business: '资金结算', title: '预付款结算管理规范', type: 'PPTX', file_size: '2.1 MB', created_at: '2023-04-25', status: '已失效', preview: '' },
    { knowledge_id: 66, business: '经营成长', title: '售后服务标准流程', type: 'DOCX', file_size: '1.7 MB', created_at: '2023-04-12', status: '生效中', preview: '' },
    { knowledge_id: 67, business: '招商入驻', scene: '入驻与退出', title: '家居建材类目入驻要求', type: 'PDF', file_size: '4.4 MB', created_at: '2023-03-30', status: '生效中', preview: '' },
    { knowledge_id: 68, business: '资金结算', title: '结算数据API对接文档', type: 'XLSX', file_size: '956 KB', created_at: '2023-03-18', status: '生效中', preview: '' },
    { knowledge_id: 69, business: '经营成长', title: 'KOL合作策略指南', type: 'PDF', file_size: '3.5 MB', created_at: '2023-03-05', status: '生效中', preview: '' },
    { knowledge_id: 70, business: '招商入驻', scene: '保证金管理', title: '保证金凭证管理规范', type: 'DOCX', file_size: '1.0 MB', created_at: '2023-02-25', status: '已失效', preview: '' },
    { knowledge_id: 71, business: '资金结算', title: '多门店结算管理方案', type: 'XLSX', file_size: '1.8 MB', created_at: '2023-02-12', status: '生效中', preview: '' },
    { knowledge_id: 72, business: '经营成长', title: '用户画像分析模板', type: 'PPTX', file_size: '6.2 MB', created_at: '2023-01-30', status: '生效中', preview: '' },
    { knowledge_id: 73, business: '招商入驻', scene: '入驻与退出', title: '母婴用品类目入驻细则', type: 'DOCX', file_size: '2.9 MB', created_at: '2023-01-18', status: '生效中', preview: '' },
    { knowledge_id: 74, business: '资金结算', title: '结算风控管理规范', type: 'PDF', file_size: '2.4 MB', created_at: '2023-01-05', status: '生效中', preview: '' },
    { knowledge_id: 75, business: '经营成长', title: '库存管理最佳实践', type: 'XLSX', file_size: '1.3 MB', created_at: '2022-12-25', status: '已失效', preview: '' },
    { knowledge_id: 76, business: '招商入驻', scene: '保证金管理', title: '保证金退款时效说明', type: 'PDF', file_size: '654 KB', created_at: '2022-12-12', status: '生效中', preview: '' },
    { knowledge_id: 77, business: '资金结算', title: '平台补贴结算规则', type: 'DOCX', file_size: '1.5 MB', created_at: '2022-11-30', status: '生效中', preview: '' },
    { knowledge_id: 78, business: '经营成长', title: 'A/B测试实施指南', type: 'XLSX', file_size: '4.0 MB', created_at: '2022-11-18', status: '生效中', preview: '' },
    { knowledge_id: 79, business: '招商入驻', scene: '入驻与退出', title: '汽车用品类目入驻流程', type: 'PDF', file_size: '3.9 MB', created_at: '2022-11-05', status: '生效中', preview: '' },
    { knowledge_id: 80, business: '资金结算', title: '结算异常人工介入流程', type: 'PPTX', file_size: '1.9 MB', created_at: '2022-10-25', status: '已失效', preview: '' },
    { knowledge_id: 81, business: '经营成长', title: '数据可视化分析指南', type: 'DOCX', file_size: '2.8 MB', created_at: '2022-10-12', status: '生效中', preview: '' },
    { knowledge_id: 82, business: '招商入驻', scene: '保证金管理', title: '保证金账户合并说明', type: 'XLSX', file_size: '723 KB', created_at: '2022-09-30', status: '生效中', preview: '' },
    { knowledge_id: 83, business: '资金结算', title: '供应链金融准入条件', type: 'PDF', file_size: '2.2 MB', created_at: '2022-09-18', status: '生效中', preview: '' },
    { knowledge_id: 84, business: '经营成长', title: '商家成长评分体系', type: 'DOCX', file_size: '1.8 MB', created_at: '2022-09-05', status: '生效中', preview: '' },
    { knowledge_id: 85, business: '招商入驻', scene: '入驻与退出', title: '图书音像类目入驻规范', type: 'PDF', file_size: '5.0 MB', created_at: '2022-08-25', status: '已失效', preview: '' },
    { knowledge_id: 86, business: '资金结算', title: '结算周期选择指南', type: 'XLSX', file_size: '612 KB', created_at: '2022-08-12', status: '生效中', preview: '' },
    { knowledge_id: 87, business: '经营成长', title: '直播话术库与脚本', type: 'PPTX', file_size: '3.6 MB', created_at: '2022-07-30', status: '生效中', preview: '' },
    { knowledge_id: 88, business: '招商入驻', scene: '保证金管理', title: '保证金转账操作指引', type: 'DOCX', file_size: '934 KB', created_at: '2022-07-18', status: '生效中', preview: '' },
    { knowledge_id: 89, business: '资金结算', title: '结算审计应对指南', type: 'PDF', file_size: '2.7 MB', created_at: '2022-07-05', status: '生效中', preview: '' },
    { knowledge_id: 90, business: '经营成长', title: '私域工具使用手册', type: 'XLSX', file_size: '1.4 MB', created_at: '2022-06-25', status: '已失效', preview: '' },
    { knowledge_id: 91, business: '招商入驻', scene: '入驻与退出', title: '宠物用品类目入驻指南', type: 'PDF', file_size: '4.3 MB', created_at: '2022-06-12', status: '生效中', preview: '' },
    { knowledge_id: 92, business: '资金结算', title: '结算数据备份与恢复', type: 'DOCX', file_size: '823 KB', created_at: '2022-05-30', status: '生效中', preview: '' },
    { knowledge_id: 93, business: '经营成长', title: '用户生命周期管理', type: 'XLSX', file_size: '3.1 MB', created_at: '2022-05-18', status: '生效中', preview: '' },
    { knowledge_id: 94, business: '招商入驻', scene: '保证金管理', title: '保证金流水查询方法', type: 'PDF', file_size: '567 KB', created_at: '2022-05-05', status: '生效中', preview: '' },
    { knowledge_id: 95, business: '资金结算', title: '结算异常案例集', type: 'PPTX', file_size: '2.3 MB', created_at: '2022-04-25', status: '已失效', preview: '' },
    { knowledge_id: 96, business: '经营成长', title: '内容营销创作规范', type: 'DOCX', file_size: '1.9 MB', created_at: '2022-04-12', status: '生效中', preview: '' },
    { knowledge_id: 97, business: '招商入驻', scene: '入驻与退出', title: '运动户外类目入驻要求', type: 'PDF', file_size: '3.3 MB', created_at: '2022-03-30', status: '生效中', preview: '' },
    { knowledge_id: 98, business: '资金结算', title: '结算系统升级通知', type: 'XLSX', file_size: '734 KB', created_at: '2022-03-18', status: '生效中', preview: '' },
    { knowledge_id: 99, business: '经营成长', title: '新兴品类增长机会', type: 'PDF', file_size: '2.6 MB', created_at: '2022-03-05', status: '生效中', preview: '' },
    { knowledge_id: 100, business: '招商入驻', scene: '保证金管理', title: '保证金充值渠道说明', type: 'DOCX', file_size: '891 KB', created_at: '2022-02-25', status: '已失效', preview: '' }
];



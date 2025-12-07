import { IRoute, routes } from "./routes";
import { Descendant } from 'slate';
import { CustomElement } from "@/components/RichTextEditor";


export const emptyData = [
    {
      "type": "paragraph",
      "children": [{"text": ""}]
    }
]

// 单页文档
export const RICH_TEXT_SINGLE_DATA: Descendant[] = [
    // 标题
    {
        type: 'heading-one',
        children: [{ text: '📄 富文本编辑器功能演示' }],
    },
    {
        type: 'paragraph',
        children: [{ text: '这是一个功能完整的富文本编辑器示例，展示了所有支持的文本格式和块级元素。' }],
    },
    
    // 基础文本样式
    {
        type: 'heading-two',
        children: [{ text: '🎨 基础文本样式' }],
    },
    {
        type: 'paragraph',
        children: [
            { text: '普通文本 ' },
            { text: '加粗文本', bold: true },
            { text: ' ' },
            { text: '斜体文本', italic: true },
            { text: ' ' },
            { text: '下划线文本', underline: true },
            { text: ' ' },
            { text: '删除线文本', strikethrough: true },
            { text: ' ' },
            { text: '多种样式组合', bold: true, italic: true, underline: true },
        ],
    },
    
    // 标题层级
    {
        type: 'heading-two',
        children: [{ text: '📑 标题层级' }],
    },
    {
        type: 'heading-one',
        children: [{ text: '一级标题 - 最大的标题' }],
    },
    {
        type: 'heading-two',
        children: [{ text: '二级标题 - 次级标题' }],
    },
    {
        type: 'heading-three',
        children: [{ text: '三级标题 - 小标题' }],
    },
    {
        type: 'paragraph',
        children: [{ text: '回到普通段落文本。' }],
    },
    
    // 列表
    {
        type: 'heading-two',
        children: [{ text: '📝 列表' }],
    },
    {
        type: 'paragraph',
        children: [{ text: '无序列表示例：' }],
    },
    {
        type: 'bulleted-list',
        children: [
            {
                type: 'list-item',
                children: [{ text: '无序列表项 1' }],
            },
            {
                type: 'list-item',
                children: [{ text: '无序列表项 2' }],
            },
            {
                type: 'list-item',
                children: [{ text: '无序列表项 3，包含 ' }, { text: '加粗样式', bold: true }],
            },
        ],
    },
    {
        type: 'paragraph',
        children: [{ text: '有序列表示例：' }],
    },
    {
        type: 'numbered-list',
        children: [
            {
                type: 'list-item',
                children: [{ text: '第一步：准备工作' }],
            },
            {
                type: 'list-item',
                children: [{ text: '第二步：执行操作' }],
            },
            {
                type: 'list-item',
                children: [{ text: '第三步：检查结果' }],
            },
        ],
    },
    
    // 引用块
    {
        type: 'heading-two',
        children: [{ text: '💬 引用块' }],
    },
    {
        type: 'block-quote',
        children: [{ text: '这是一个引用块示例。引用通常用于强调重要内容、展示名人名言或引用的文字。' }],
    },
    {
        type: 'block-quote',
        children: [
            { text: '引用块也可以包含 ' },
            { text: '多种文本样式', bold: true, italic: true },
            { text: '，让引用内容更加突出。' },
        ],
    },
    
    // 超链接
    {
        type: 'heading-two',
        children: [{ text: '🔗 超链接' }],
    },
    {
        type: 'paragraph',
        children: [
            { text: '点击访问 ' },
            { type: 'link', url: 'https://www.example.com', children: [{ text: '示例网站' }] } as any,
            { text: ' 了解更多信息。' },
        ],
    },
    {
        type: 'paragraph',
        children: [
            { text: '也可以链接到 ' },
            { type: 'link', url: 'https://github.com', children: [{ text: 'GitHub' }] } as any,
            { text: ' 或 ' },
            { type: 'link', url: 'https://stackoverflow.com', children: [{ text: 'Stack Overflow' }] } as any,
            { text: '。' },
        ],
    },
    
    // 排版样式
    {
        type: 'heading-two',
        children: [{ text: '📐 排版样式示例' }],
    },
    {
        type: 'paragraph',
        lineHeight: 2,
        marginBottom: 1,
        children: [{ text: '这段文本设置了 2 倍行高和 1em 段间距，文本之间更加宽松，阅读体验更好。' }],
    },
    {
        type: 'paragraph',
        textIndent: 2,
        children: [{ text: '这段文本设置了 2em 的首行缩进，常见于中文文章的段落排版，是传统的段落格式。' }],
    },
    {
        type: 'paragraph',
        letterSpacing: 1,
        children: [{ text: '这段文本设置了 1px 的字间距，文字看起来更宽松，适合特殊的排版需求。' }],
    },
    
    // 对齐方式
    {
        type: 'heading-two',
        children: [{ text: '🎯 对齐方式' }],
    },
    {
        type: 'paragraph',
        align: 'left',
        children: [{ text: '左对齐文本：这是最常见的文本对齐方式，文本从左到右排列。' }],
    },
    {
        type: 'paragraph',
        align: 'center',
        children: [{ text: '居中对齐文本：常用于标题或需要强调的段落。' }],
    },
    {
        type: 'paragraph',
        align: 'right',
        children: [{ text: '右对齐文本：常用于特殊排版需求或日期、签名等。' }],
    },
    
    // 水平分割线
    {
        type: 'heading-two',
        children: [{ text: '✂️ 水平分割线' }],
    },
    {
        type: 'paragraph',
        children: [{ text: '上方是水平分割线示例。' }],
    },
    {
        type: 'horizontal-rule',
        children: [{ text: '' }],
    },
    {
        type: 'paragraph',
        children: [{ text: '下方是水平分割线示例。分割线用于分隔不同章节或内容区块。' }],
    },
    
    // 复杂组合
    {
        type: 'heading-two',
        children: [{ text: '🎪 复杂组合示例' }],
    },
    {
        type: 'paragraph',
        children: [
            { text: '在段落中插入 ' },
            { text: '列表', bold: true, underline: true },
            { text: '：' },
        ],
    },
    {
        type: 'bulleted-list',
        children: [
            {
                type: 'list-item',
                children: [
                    { text: '列表项中的 ' },
                    { text: '超链接', italic: true },
                    { text: '： ' },
                    { type: 'link', url: 'https://github.com', children: [{ text: 'GitHub' }] } as any,
                ],
            },
            {
                type: 'list-item',
                children: [
                    { text: '列表项中的 ' },
                    { text: '多种样式', bold: true, strikethrough: true, italic: true },
                    { text: ' 组合' },
                ],
            },
        ],
    },
    {
        type: 'block-quote',
        children: [
            { text: '引用块中的 ' },
            { text: '超链接', bold: true },
            { text: '：访问 ' },
            { type: 'link', url: 'https://www.google.com', children: [{ text: 'Google' }] } as any,
            { text: ' 搜索更多信息。' },
        ],
    },
    {
        type: 'paragraph',
        align: 'center',
        lineHeight: 1.8,
        children: [
            { text: '最后一段，居中对齐，1.8 倍行高，感谢阅读！', italic: true, bold: true },
        ],
    },
];

// 多页文档
export const RICH_TEXT_MULTIPLE_DATA: Descendant[][] = [
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




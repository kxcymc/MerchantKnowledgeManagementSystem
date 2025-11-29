export type IRoute = {
  name: string;
  key: string;
  breadcrumb?: boolean;
  children?: IRoute[];
  ignore?: boolean;
};

export const routes: IRoute[] = [
  {
    name: '知识管理',
    key: 'knowledge-management',
    children: [
      {
        name: '全部',
        key: 'knowledge-management/all',
      },
      {
        name: '经营成长',
        key: 'knowledge-management/business-growth',
      },
      {
        name: '招商入驻',
        key: 'knowledge-management/merchant-onboarding',
        children: [
          {
            name: '入驻与退出',
            key: 'knowledge-management/merchant-onboarding/entry-exit',
            breadcrumb: true,
          },
          {
            name: '保证金管理',
            key: 'knowledge-management/merchant-onboarding/deposit-management',
            breadcrumb: true,
          },
        ],
      },
      {
        name: '资金结算',
        key: 'knowledge-management/fund-settlement',
      },
    ],
  },
  {
    name: '知识创建',
    key: 'knowledge-creation',
  },
  {
    name: '数据可视化',
    key: 'visualization',
    children: [
      {
        name: '分析页',
        key: 'visualization/data-analysis',
      },
      {
        name: '多维数据分析',
        key: 'visualization/multi-dimension-data-analysis',
      },
    ],
  },
  {
    name: '结果页',
    key: 'result',
    children: [
      {
        name: '成功页',
        key: 'result/success',
        breadcrumb: false,
      },
      {
        name: '失败页',
        key: 'result/error',
        breadcrumb: false,
      },
    ],
  },
  {
    name: '异常页',
    key: 'exception',
    children: [
      {
        name: '404',
        key: 'exception/404',
      },
      {
        name: '500',
        key: 'exception/500',
      },
    ],
  },
];

const useRoute = (): [IRoute[], string] => [routes, routes[0].key];

export default useRoute;
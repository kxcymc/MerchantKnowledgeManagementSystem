import { AuthParams } from '@/utils/authentication';

export type IRoute = AuthParams & {
  name: string;
  key: string;
  // 当前页是否展示面包屑
  breadcrumb?: boolean;
  children?: IRoute[];
  // 当前路由是否渲染菜单项，为 true 的话不会在菜单中显示，但可通过路由地址访问。
  ignore?: boolean;
};

export const routes: IRoute[] = [
  {
    name: 'menu.knowledgeManagement',
    key: 'knowledge-management',
    children: [
      {
        name: 'menu.knowledgeManagement.all',
        key: 'knowledge-management/all',
        requiredPermissions: [
          { resource: 'menu.knowledgeManagement.all', actions: ['read', 'write', 'create', 'delete'] },
        ],
      },
      {
        name: 'menu.knowledgeManagement.businessGrowth',
        key: 'knowledge-management/business-growth',
        requiredPermissions: [
          { resource: 'menu.knowledgeManagement.businessGrowth', actions: ['read', 'write', 'create', 'delete'] },
        ],
      },
      {
        name: 'menu.knowledgeManagement.onboarding',
        key: 'knowledge-management/merchant-onboarding',
        requiredPermissions: [
          { resource: 'menu.knowledgeManagement.onboarding', actions: ['read', 'write', 'create', 'delete'] },
        ],
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
        name: 'menu.knowledgeManagement.fundSettlement',
        key: 'knowledge-management/fund-settlement',
        requiredPermissions: [
          { resource: 'menu.knowledgeManagement.fundSettlement', actions: ['read', 'write', 'create', 'delete'] },
        ],
      },
    ],
  },
  {
    name: 'menu.knowledgeCreation',
    key: 'knowledge-creation',
    requiredPermissions: [
      { resource: 'menu.knowledgeCreation', actions: ['read', 'write', 'create', 'delete'] },
    ],
  },
  {
    name: 'menu.visualization',
    key: 'visualization',
    children: [
      {
        name: 'menu.visualization.dataAnalysis',
        key: 'visualization/data-analysis',
        requiredPermissions: [
          { resource: 'menu.visualization.dataAnalysis', actions: ['read'] },
        ],
      },
      {
        name: 'menu.visualization.multiDimensionDataAnalysis',
        key: 'visualization/multi-dimension-data-analysis',
        requiredPermissions: [
          {
            resource: 'menu.visualization.dataAnalysis',
            actions: ['read', 'write'],
          },
          {
            resource: 'menu.visualization.multiDimensionDataAnalysis',
            actions: ['write'],
          },
        ],
        oneOfPerm: true,
      },
    ],
  },
  {
    name: 'menu.result',
    key: 'result',
    children: [
      {
        name: 'menu.result.success',
        key: 'result/success',
        breadcrumb: false,
      },
      {
        name: 'menu.result.error',
        key: 'result/error',
        breadcrumb: false,
      },
    ],
  },
  {
    name: 'menu.exception',
    key: 'exception',
    children: [
      {
        name: 'menu.exception.403',
        key: 'exception/403',
      },
      {
        name: 'menu.exception.404',
        key: 'exception/404',
      },
      {
        name: 'menu.exception.500',
        key: 'exception/500',
      },
    ],
  },
];

export const getName = (path: string, routes) => {
  return routes.find((item) => {
    const itemPath = `/${item.key}`;
    if (path === itemPath) {
      return item.name;
    } else if (item.children) {
      return getName(path, item.children);
    }
  });
};

const useRoute = (): [IRoute[], string] => [routes, routes[0].key];

export default useRoute;

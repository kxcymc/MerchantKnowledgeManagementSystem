export type IRoute =  {
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
      },
      {
        name: 'menu.knowledgeManagement.businessGrowth',
        key: 'knowledge-management/business-growth',
      },
      {
        name: 'menu.knowledgeManagement.onboarding',
        key: 'knowledge-management/merchant-onboarding',
      },
      {
        name: 'menu.knowledgeManagement.fundSettlement',
        key: 'knowledge-management/fund-settlement',
      },
    ],
  },
  {
    name: 'menu.knowledgeCreation',
    key: 'knowledge-creation',
  },
  {
    name: 'menu.visualization',
    key: 'visualization',
    children: [
      {
        name: 'menu.visualization.dataAnalysis',
        key: 'visualization/data-analysis',
      },
      {
        name: 'menu.visualization.multiDimensionDataAnalysis',
        key: 'visualization/multi-dimension-data-analysis',
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

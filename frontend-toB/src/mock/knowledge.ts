import Mock from 'mockjs';

const { Random } = Mock;

// initial mock data
const data = Array.from({ length: 6 }).map(() => ({
  knowledge_id: Random.guid(),
  scene_id: `scene_${Random.integer(1, 4)}`,
  backend_added: Random.integer(0, 1),
  type: Random.pick(['pdf', 'manual', 'link']),
  file_url: Random.url(),
  file_size: `${Random.integer(10, 2048)}KB`,
  created_at: Random.date('yyyy-MM-dd HH:mm:ss'),
  title: Random.ctitle(5, 20),
  content: Random.cparagraph(1, 3),
  refer_num: Random.integer(0, 1000),
  status: Random.pick(['生效中', '已失效']),
}));

Mock.mock(new RegExp('/api/knowledge$'), 'get', (options) => {
  const url = options.url || '';
  // ignoring params for simplicity; return all
  return {
    code: 0,
    data,
  };
});

Mock.mock(new RegExp('/api/knowledge$'), 'post', (options) => {
  const body = JSON.parse(options.body || '{}');
  const item = {
    knowledge_id: Random.guid(),
    scene_id: body.scene_id || 'scene_1',
    backend_added: body.backend_added || 0,
    type: body.type || 'manual',
    file_url: body.file_url || '',
    file_size: body.file_size || '0KB',
    created_at: Random.date('yyyy-MM-dd HH:mm:ss'),
    title: body.title || '未命名文档',
    content: body.content || '',
    refer_num: 0,
    status: body.status || '生效中',
  };
  data.unshift(item);
  return {
    code: 0,
    data: item,
  };
});

Mock.mock(new RegExp('/api/knowledge/'), 'put', (options) => {
  const body = JSON.parse(options.body || '{}');
  const url = options.url || '';
  const id = url.split('/').pop();
  const idx = data.findIndex((d) => d.knowledge_id === id);
  if (idx > -1) {
    data[idx] = { ...data[idx], ...body };
    return { code: 0, data: data[idx] };
  }
  return { code: 1, message: 'not found' };
});

Mock.mock(new RegExp('/api/knowledge/'), 'delete', (options) => {
  const url = options.url || '';
  const id = url.split('/').pop();
  const idx = data.findIndex((d) => d.knowledge_id === id);
  if (idx > -1) {
    data.splice(idx, 1);
    return { code: 0 };
  }
  return { code: 1, message: 'not found' };
});

export {};

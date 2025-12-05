import React from 'react';
import dayjs from 'dayjs';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Grid,
} from '@arco-design/web-react';
import { IconRefresh, IconSearch } from '@arco-design/web-react/icon';
import styles from './style/index.module.less';

const { Row, Col } = Grid;
const { useForm } = Form;

function SearchForm(props: {
  onSearch: (values: Record<string, any>) => void;
}) {
  const [form] = useForm();

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    props.onSearch(values);
  };

  const handleReset = () => {
    form.resetFields();
    props.onSearch({});
  };

  const colSpan = 8;

  return (
    <div className={styles['search-form-wrapper']}>
      <Form
        form={form}
        className={styles['search-form']}
        labelAlign="left"
        labelCol={{ span: 5 }}
        wrapperCol={{ span: 19 }}
      >
        <Row gutter={24}>
          <Col span={colSpan}>
            <Form.Item label="文档标题" field="title">
              <Input placeholder="请输入文档标题" allowClear />
            </Form.Item>
          </Col>
          <Col span={colSpan}>
            <Form.Item label="所属业务" field="business">
                <Select
                placeholder="全部"
                options={[
                  { label: '经营成长', value: '经营成长' },
                  { label: '招商入驻', value: '招商入驻' },
                  { label: '资金结算', value: '资金结算' },
                ]}
                mode="multiple"
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={colSpan}>
            <Form.Item label="所属场景" field="scene">
                <Select
                placeholder="全部"
                options={[
                  { label: '入驻与退出', value: '入驻与退出' },
                  { label: '保证金管理', value: '保证金管理' },
                  { label: '其他', value: '其他' },
                ]}
                mode="multiple"
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={colSpan}>
            <Form.Item label="状态" field="status">
              <Select
                placeholder="全部"
                options={[
                  { label: '生效中', value: '生效中' },
                  { label: '已失效', value: '已失效' },
                ]}
                mode="multiple"
                allowClear
              />
            </Form.Item>
          </Col>
          <Col span={colSpan}>
            <Form.Item label="创建时间" field="createdTime">
              <DatePicker.RangePicker
                allowClear
                style={{ width: '100%' }}
                disabledDate={(date) => dayjs(date).isAfter(dayjs())}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      <div className={styles['right-button']}>
        <Button type="primary" icon={<IconSearch />} onClick={handleSubmit}>
          查询
        </Button>
        <Button icon={<IconRefresh />} onClick={handleReset}>
          重置
        </Button>
      </div>
    </div>
  );
}

export default SearchForm;
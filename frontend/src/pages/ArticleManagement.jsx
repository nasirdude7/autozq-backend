import React, { useState } from 'react'
import { Card, Button, Table, Tag, Space, Modal, Form, Input, Select, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons'

const { TextArea } = Input

function ArticleManagement() {
  const [modalVisible, setModalVisible] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [form] = Form.useForm()

  const [articles, setArticles] = useState([
    {
      id: 1,
      title: '如何从中国进口二手车到俄罗斯',
      category: '进口指南',
      keywords: '二手车, 进口, 俄罗斯',
      status: 'published',
      views: 1234,
      createdAt: '2024-01-15',
    },
    {
      id: 2,
      title: '2024年最值得购买的日系SUV推荐',
      category: '购买技巧',
      keywords: 'SUV, 日系车, 推荐',
      status: 'draft',
      views: 0,
      createdAt: '2024-01-14',
    },
  ])

  const handleGenerateArticle = () => {
    form.validateFields().then((values) => {
      setGenerating(true)
      // 模拟AI生成
      setTimeout(() => {
        message.success('文章生成成功！')
        setGenerating(false)
        setModalVisible(false)
        form.resetFields()
      }, 3000)
    })
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '文章标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      key: 'keywords',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'published' ? 'green' : 'orange'}>
          {status === 'published' ? '已发布' : '草稿'}
        </Tag>
      ),
    },
    {
      title: '浏览量',
      dataIndex: 'views',
      key: 'views',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />}>
            编辑
          </Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>SEO文章管理</h1>
        <Button type="primary" icon={<RobotOutlined />} onClick={() => setModalVisible(true)}>
          AI生成文章
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={articles}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 篇文章`,
          }}
        />
      </Card>

      {/* AI生成文章弹窗 */}
      <Modal
        title="AI生成SEO文章"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleGenerateArticle}
        confirmLoading={generating}
        okText={generating ? '生成中...' : '开始生成'}
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="文章主题"
            name="topic"
            rules={[{ required: true, message: '请输入文章主题' }]}
          >
            <Input placeholder="例如: 如何选择适合俄罗斯气候的汽车" />
          </Form.Item>

          <Form.Item
            label="文章类别"
            name="category"
            rules={[{ required: true, message: '请选择文章类别' }]}
          >
            <Select placeholder="选择类别">
              <Select.Option value="import_guide">进口指南</Select.Option>
              <Select.Option value="buying_tips">购买技巧</Select.Option>
              <Select.Option value="maintenance">维修保养</Select.Option>
              <Select.Option value="market_news">市场资讯</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="目标关键词"
            name="keywords"
            rules={[{ required: true, message: '请输入关键词' }]}
          >
            <Input placeholder="用逗号分隔，例如: 二手车, 俄罗斯, 进口" />
          </Form.Item>

          <Form.Item label="语言" name="language" initialValue="ru">
            <Select>
              <Select.Option value="ru">俄语</Select.Option>
              <Select.Option value="zh">中文</Select.Option>
              <Select.Option value="en">英语</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="额外要求" name="requirements">
            <TextArea
              rows={4}
              placeholder="可选：添加任何特殊要求或指示..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ArticleManagement

import React, { useState } from 'react'
import { Card, Button, Table, Tag, Space, Modal, Select, Checkbox, message, Input } from 'antd'
import { ShareAltOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

const { TextArea } = Input

function SocialMedia() {
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [customContent, setCustomContent] = useState({})
  const [publishing, setPublishing] = useState(false)

  const [posts, setPosts] = useState([
    {
      id: 1,
      vehicle: 'Toyota Camry 2023',
      platforms: ['VK', 'Telegram'],
      status: 'published',
      engagement: { likes: 45, shares: 12, comments: 8 },
      publishedAt: '2024-01-15 10:30',
    },
    {
      id: 2,
      vehicle: 'Honda CR-V 2022',
      platforms: ['VK', 'Instagram', 'Telegram'],
      status: 'failed',
      engagement: { likes: 0, shares: 0, comments: 0 },
      publishedAt: '2024-01-14 15:20',
    },
  ])

  const vehicles = [
    { id: 1, name: 'Toyota Camry 2023' },
    { id: 2, name: 'Honda CR-V 2022' },
    { id: 3, name: 'Lexus NX300h 2021' },
  ]

  const platforms = [
    { value: 'vk', label: 'VK（俄罗斯社交）' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'telegram', label: 'Telegram频道' },
  ]

  const handlePublish = () => {
    if (!selectedVehicle || selectedPlatforms.length === 0) {
      message.warning('请选择车辆和至少一个发布平台')
      return
    }

    setPublishing(true)
    // 模拟发布
    setTimeout(() => {
      message.success('发布成功！')
      setPublishing(false)
      setModalVisible(false)
      setSelectedVehicle(null)
      setSelectedPlatforms([])
      setCustomContent({})
    }, 2000)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '车辆',
      dataIndex: 'vehicle',
      key: 'vehicle',
    },
    {
      title: '发布平台',
      dataIndex: 'platforms',
      key: 'platforms',
      render: (platforms) => (
        <>
          {platforms.map((platform) => (
            <Tag key={platform} color="blue">
              {platform}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag
          icon={status === 'published' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={status === 'published' ? 'success' : 'error'}
        >
          {status === 'published' ? '已发布' : '发布失败'}
        </Tag>
      ),
    },
    {
      title: '互动数据',
      key: 'engagement',
      render: (_, record) => (
        <Space>
          <span>👍 {record.engagement.likes}</span>
          <span>📤 {record.engagement.shares}</span>
          <span>💬 {record.engagement.comments}</span>
        </Space>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>社媒营销</h1>
        <Button type="primary" icon={<ShareAltOutlined />} onClick={() => setModalVisible(true)}>
          一键发布
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={posts}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条发布记录`,
          }}
        />
      </Card>

      {/* 发布弹窗 */}
      <Modal
        title="一键发布到社交媒体"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handlePublish}
        confirmLoading={publishing}
        okText={publishing ? '发布中...' : '立即发布'}
        cancelText="取消"
        width={700}
      >
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              选择车辆
            </label>
            <Select
              style={{ width: '100%' }}
              placeholder="选择要发布的车辆"
              value={selectedVehicle}
              onChange={setSelectedVehicle}
            >
              {vehicles.map((v) => (
                <Select.Option key={v.id} value={v.id}>
                  {v.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              选择发布平台
            </label>
            <Checkbox.Group
              options={platforms}
              value={selectedPlatforms}
              onChange={setSelectedPlatforms}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              自定义文案（可选）
            </label>
            <TextArea
              rows={4}
              placeholder="留空则使用AI自动生成的文案..."
              value={customContent.text || ''}
              onChange={(e) =>
                setCustomContent({ ...customContent, text: e.target.value })
              }
            />
          </div>

          <div
            style={{
              background: '#f0f2f5',
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              color: '#666',
            }}
          >
            💡 提示: AI将根据车辆信息自动生成适合各平台的文案和标签
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SocialMedia

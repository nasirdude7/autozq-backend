import React, { useState } from 'react'
import { Card, Button, Upload, Modal, Form, Input, Table, Tag, Space, message } from 'antd'
import { UploadOutlined, PlusOutlined, EyeOutlined, DeleteOutlined, CloudUploadOutlined } from '@ant-design/icons'
import VehicleUpload from '../components/VehicleUpload'
import VehicleForm from '../components/VehicleForm'

function VehicleManagement() {
  const [modalVisible, setModalVisible] = useState(false)
  const [recognizedData, setRecognizedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [vehicles, setVehicles] = useState([
    {
      id: 1,
      brand: 'Toyota',
      model: 'Camry',
      year: 2023,
      color: '白色',
      price: 180000,
      status: 'published',
      createdAt: '2024-01-15',
    },
    {
      id: 2,
      brand: 'Honda',
      model: 'CR-V',
      year: 2022,
      color: '黑色',
      price: 220000,
      status: 'draft',
      createdAt: '2024-01-14',
    },
  ])

  const handleRecognitionComplete = (data) => {
    setRecognizedData(data)
    setLoading(false)
  }

  const handleRecognitionStart = () => {
    setLoading(true)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
    },
    {
      title: '车型',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: '年款',
      dataIndex: 'year',
      key: 'year',
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price) => `¥${price.toLocaleString()}`,
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
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}>
            查看
          </Button>
          <Button type="link" size="small" icon={<CloudUploadOutlined />}>
            发布
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>车辆管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          添加车辆
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={vehicles}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 辆车`,
          }}
        />
      </Card>

      {/* 添加车辆弹窗 */}
      <Modal
        title="添加新车辆"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setRecognizedData(null)
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <div style={{ marginTop: 16 }}>
          <VehicleUpload
            onRecognitionStart={handleRecognitionStart}
            onRecognitionComplete={handleRecognitionComplete}
            loading={loading}
          />

          {recognizedData && (
            <div style={{ marginTop: 24 }}>
              <VehicleForm data={recognizedData} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default VehicleManagement

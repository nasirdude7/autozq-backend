import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Progress, Table, Tag } from 'antd'
import {
  CarOutlined,
  FileTextOutlined,
  ShareAltOutlined,
  MessageOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function Dashboard() {
  const [stats, setStats] = useState({
    vehicles: { total: 0, thisMonth: 0, growth: 0 },
    articles: { total: 0, thisMonth: 0, growth: 0 },
    socialPosts: { total: 0, thisMonth: 0, growth: 0 },
    conversations: { total: 0, thisMonth: 0, growth: 0 },
  })

  const [recentActivities, setRecentActivities] = useState([])
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    // 模拟数据加载
    setStats({
      vehicles: { total: 156, thisMonth: 23, growth: 15.3 },
      articles: { total: 89, thisMonth: 12, growth: 8.7 },
      socialPosts: { total: 234, thisMonth: 45, growth: 24.5 },
      conversations: { total: 567, thisMonth: 89, growth: 18.2 },
    })

    setRecentActivities([
      { id: 1, type: 'vehicle', title: '新增车辆: Toyota Camry 2023', time: '5分钟前', status: 'success' },
      { id: 2, type: 'article', title: '发布文章: 如何选择二手车', time: '1小时前', status: 'success' },
      { id: 3, type: 'social', title: 'VK发布成功: Lexus NX300h', time: '2小时前', status: 'success' },
      { id: 4, type: 'chatbot', title: 'AI客服接待客户: 张先生', time: '3小时前', status: 'processing' },
    ])

    setChartData([
      { name: '周一', 车辆: 12, 文章: 5, 社媒: 18 },
      { name: '周二', 车辆: 15, 文章: 7, 社媒: 22 },
      { name: '周三', 车辆: 8, 文章: 4, 社媒: 15 },
      { name: '周四', 车辆: 18, 文章: 6, 社媒: 28 },
      { name: '周五', 车辆: 22, 文章: 9, 社媒: 35 },
      { name: '周六', 车辆: 10, 文章: 3, 社媒: 12 },
      { name: '周日', 车辆: 14, 文章: 5, 社媒: 20 },
    ])
  }, [])

  const activityColumns = [
    {
      title: '活动',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'success' ? 'green' : 'blue'}>
          {status === 'success' ? '完成' : '处理中'}
        </Tag>
      ),
    },
  ]

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>工作台概览</h1>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="车辆总数"
              value={stats.vehicles.total}
              prefix={<CarOutlined />}
              suffix={
                <span style={{ fontSize: 14, color: '#52c41a', marginLeft: 8 }}>
                  <ArrowUpOutlined /> {stats.vehicles.growth}%
                </span>
              }
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              本月新增: {stats.vehicles.thisMonth}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SEO文章"
              value={stats.articles.total}
              prefix={<FileTextOutlined />}
              suffix={
                <span style={{ fontSize: 14, color: '#52c41a', marginLeft: 8 }}>
                  <ArrowUpOutlined /> {stats.articles.growth}%
                </span>
              }
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              本月新增: {stats.articles.thisMonth}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="社媒发布"
              value={stats.socialPosts.total}
              prefix={<ShareAltOutlined />}
              suffix={
                <span style={{ fontSize: 14, color: '#52c41a', marginLeft: 8 }}>
                  <ArrowUpOutlined /> {stats.socialPosts.growth}%
                </span>
              }
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              本月新增: {stats.socialPosts.thisMonth}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="客服对话"
              value={stats.conversations.total}
              prefix={<MessageOutlined />}
              suffix={
                <span style={{ fontSize: 14, color: '#52c41a', marginLeft: 8 }}>
                  <ArrowUpOutlined /> {stats.conversations.growth}%
                </span>
              }
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              本月新增: {stats.conversations.thisMonth}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 图表和活动记录 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="本周活动趋势" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="车辆" fill="#1890ff" />
                <Bar dataKey="文章" fill="#52c41a" />
                <Bar dataKey="社媒" fill="#faad14" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="最近活动" style={{ height: 400 }}>
            <Table
              dataSource={recentActivities}
              columns={activityColumns}
              pagination={false}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard

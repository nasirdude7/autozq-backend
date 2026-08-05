import React, { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, Avatar, Tag, Select, Row, Col, Statistic } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'

const { TextArea } = Input

function Chatbot() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '您好！我是AutoZQ智能客服。请问有什么可以帮助您的？',
      timestamp: '10:30',
      agent: '销售顾问',
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (!inputValue.trim()) return

    // 添加用户消息
    const userMessage = {
      id: messages.length + 1,
      role: 'user',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }

    setMessages([...messages, userMessage])
    setInputValue('')
    setLoading(true)

    // 模拟AI回复
    setTimeout(() => {
      const aiMessage = {
        id: messages.length + 2,
        role: 'assistant',
        content: '我理解您的需求。我们有多款符合您要求的车型...',
        timestamp: new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        agent: '销售顾问',
      }
      setMessages((prev) => [...prev, aiMessage])
      setLoading(false)
    }, 1500)
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>AI智能客服</h1>

      <Row gutter={16}>
        {/* 统计卡片 */}
        <Col span={6}>
          <Card>
            <Statistic title="今日对话" value={23} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均响应时间" value={1.2} suffix="秒" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="客户满意度" value={94} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="意向客户" value={8} />
          </Card>
        </Col>
      </Row>

      <Card
        title="客服对话测试"
        style={{ marginTop: 16 }}
        extra={
          <Select defaultValue="sales" style={{ width: 150 }}>
            <Select.Option value="sales">销售顾问</Select.Option>
            <Select.Option value="logistics">物流专家</Select.Option>
            <Select.Option value="technical">技术专家</Select.Option>
            <Select.Option value="support">售后服务</Select.Option>
          </Select>
        }
      >
        {/* 聊天消息区域 */}
        <div
          style={{
            height: 400,
            overflowY: 'auto',
            padding: 16,
            background: '#f5f5f5',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}
            >
              {msg.role === 'assistant' && (
                <Avatar
                  icon={<RobotOutlined />}
                  style={{ background: '#1890ff', marginRight: 8 }}
                />
              )}
              <div style={{ maxWidth: '70%' }}>
                {msg.agent && (
                  <Tag color="blue" style={{ marginBottom: 4 }}>
                    {msg.agent}
                  </Tag>
                )}
                <div
                  style={{
                    background: msg.role === 'user' ? '#1890ff' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#000',
                    padding: '8px 12px',
                    borderRadius: 8,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  {msg.content}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#999',
                    marginTop: 4,
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}
                >
                  {msg.timestamp}
                </div>
              </div>
              {msg.role === 'user' && (
                <Avatar
                  icon={<UserOutlined />}
                  style={{ background: '#52c41a', marginLeft: 8 }}
                />
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Avatar
                icon={<RobotOutlined />}
                style={{ background: '#1890ff', marginRight: 8 }}
              />
              <div
                style={{
                  background: '#fff',
                  padding: '8px 12px',
                  borderRadius: 8,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                <span className="typing-indicator">正在输入...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="输入消息... (Enter发送，Shift+Enter换行)"
            autoSize={{ minRows: 2, maxRows: 4 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default Chatbot

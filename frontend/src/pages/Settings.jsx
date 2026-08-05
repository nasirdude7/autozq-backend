import React from 'react'
import { Card, Form, Input, Select, Button, message, Divider, Switch } from 'antd'
import { SaveOutlined } from '@ant-design/icons'

function Settings() {
  const [form] = Form.useForm()

  const handleSave = (values) => {
    console.log('保存设置:', values)
    message.success('设置已保存')
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>系统设置</h1>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          anthropic_model: 'claude-3-5-sonnet-20241022',
          openai_model: 'gpt-4o',
          language: 'zh',
          auto_publish: true,
          enable_cache: true,
        }}
      >
        <Card title="AI模型配置" style={{ marginBottom: 16 }}>
          <Form.Item
            label="Anthropic API密钥"
            name="anthropic_api_key"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input.Password placeholder="sk-ant-..." />
          </Form.Item>

          <Form.Item label="Anthropic API地址（可选）" name="anthropic_api_base">
            <Input placeholder="留空使用官方API" />
          </Form.Item>

          <Form.Item label="Anthropic模型" name="anthropic_model">
            <Select>
              <Select.Option value="claude-3-5-sonnet-20241022">
                Claude 3.5 Sonnet (推荐)
              </Select.Option>
              <Select.Option value="claude-3-opus-20240229">
                Claude 3 Opus (最强)
              </Select.Option>
              <Select.Option value="claude-3-haiku-20240307">
                Claude 3 Haiku (最快)
              </Select.Option>
            </Select>
          </Form.Item>

          <Divider />

          <Form.Item label="OpenAI API密钥" name="openai_api_key">
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          <Form.Item label="OpenAI API地址（可选）" name="openai_api_base">
            <Input placeholder="留空使用官方API" />
          </Form.Item>

          <Form.Item label="OpenAI模型" name="openai_model">
            <Select>
              <Select.Option value="gpt-4o">GPT-4o (推荐)</Select.Option>
              <Select.Option value="gpt-4-turbo">GPT-4 Turbo</Select.Option>
              <Select.Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Select.Option>
            </Select>
          </Form.Item>
        </Card>

        <Card title="WordPress配置" style={{ marginBottom: 16 }}>
          <Form.Item
            label="WordPress网站URL"
            name="wordpress_url"
            rules={[{ required: true, message: '请输入网站URL' }]}
          >
            <Input placeholder="https://autozq.ru" />
          </Form.Item>

          <Form.Item
            label="用户名"
            name="wordpress_username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="admin" />
          </Form.Item>

          <Form.Item
            label="应用密码"
            name="wordpress_password"
            rules={[{ required: true, message: '请输入应用密码' }]}
          >
            <Input.Password placeholder="xxxx xxxx xxxx xxxx" />
          </Form.Item>
        </Card>

        <Card title="社交媒体配置" style={{ marginBottom: 16 }}>
          <Form.Item label="VK Access Token" name="vk_token">
            <Input.Password placeholder="vk1..." />
          </Form.Item>

          <Form.Item label="Telegram Bot Token" name="telegram_token">
            <Input.Password placeholder="123456:ABC-DEF..." />
          </Form.Item>

          <Form.Item label="Instagram Access Token" name="instagram_token">
            <Input.Password placeholder="IGQ..." />
          </Form.Item>
        </Card>

        <Card title="系统配置" style={{ marginBottom: 16 }}>
          <Form.Item label="默认语言" name="language">
            <Select>
              <Select.Option value="zh">中文</Select.Option>
              <Select.Option value="ru">俄语</Select.Option>
              <Select.Option value="en">英语</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="自动发布到WordPress"
            name="auto_publish"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item label="启用缓存优化" name="enable_cache" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">
            保存所有设置
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default Settings

import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, message, List, Tag, Badge } from 'antd';
import { io } from 'socket.io-client';
import { firebaseService } from '../services/firebaseService';

const { TextArea } = Input;
const { Option } = Select;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function TeamCoordination() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize Firebase notifications
    firebaseService.requestPermission();
    
    const messageUnsubscribe = firebaseService.onMessage((payload) => {
      message.info(`New notification: ${payload.notification?.title}`);
    });

    // Set up Socket.io for real-time team messages
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('team:coordination', (data) => {
      setMessages((prev) => [data, ...prev].slice(0, 50)); // Keep last 50 messages
      message.info(`Team message from ${data.from}`);
    });

    return () => {
      messageUnsubscribe();
      newSocket.close();
    };
  }, []);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${API_BASE_URL}/api/notifications/team-coordination`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (data.success) {
        message.success('Team coordination message sent');
        form.resetFields();
      } else {
        message.error(data.message || 'Failed to send message');
      }
    } catch (error) {
      message.error('Error sending team message');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: 'red',
      high: 'orange',
      normal: 'blue',
      low: 'default',
    };
    return colors[priority] || 'default';
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="Team Coordination" style={{ marginBottom: '24px' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Please enter a message' }]}
          >
            <TextArea
              rows={4}
              placeholder="Coordinate with your team..."
            />
          </Form.Item>

          <Form.Item name="priority" label="Priority" initialValue="normal">
            <Select>
              <Option value="urgent">Urgent</Option>
              <Option value="high">High</Option>
              <Option value="normal">Normal</Option>
              <Option value="low">Low</Option>
            </Select>
          </Form.Item>

          <Form.Item name="targetRole" label="Target" initialValue="all">
            <Select>
              <Option value="all">All Team Members</Option>
              <Option value="admin">Admins Only</Option>
              <Option value="driver">Drivers Only</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Send Message
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Recent Messages">
        <List
          dataSource={messages}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag color={getPriorityColor(item.priority)}>{item.priority.toUpperCase()}</Tag>
                    <span>{item.from}</span>
                    <span style={{ color: '#999', fontSize: '12px' }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                }
                description={item.message}
              />
            </List.Item>
          )}
          locale={{ emptyText: 'No messages yet' }}
        />
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { firebaseService } from '../services/firebaseService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function PromoAlert({ visible, onCancel }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${API_BASE_URL}/api/notifications/send-promo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          title: values.title,
          message: values.message,
          promoId: values.promoId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        message.success(`Promo alert sent to ${data.sentTo} users`);
        form.resetFields();
        onCancel();
      } else {
        message.error(data.message || 'Failed to send promo alert');
      }
    } catch (error) {
      message.error('Error sending promo alert');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Send Promotional Alert"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: 'Please enter a title' }]}
        >
          <Input placeholder="Special Offer!" />
        </Form.Item>

        <Form.Item
          name="message"
          label="Message"
          rules={[{ required: true, message: 'Please enter a message' }]}
        >
          <Input.TextArea
            rows={4}
            placeholder="Get 20% off on all burgers today!"
          />
        </Form.Item>

        <Form.Item name="promoId" label="Promo ID (optional)">
          <Input placeholder="PROMO2024" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Send Promo Alert
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}

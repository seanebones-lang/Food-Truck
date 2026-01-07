import { useState, useEffect } from 'react';
import { Table, Card, Statistic, Button, Space, Tag, DatePicker, Select, message, Row, Col } from 'antd';
import { DownloadOutlined, DollarOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { io } from 'socket.io-client';
import Papa from 'papaparse';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function Payments() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: undefined,
    paymentStatus: undefined,
    dateRange: null,
  });

  useEffect(() => {
    fetchOrders();

    // Set up Socket.io for real-time updates
    const socket = io(SOCKET_URL);
    socket.on('order:payment:succeeded', () => {
      fetchOrders();
      message.success('New payment received!');
    });
    socket.on('orders:updated', () => {
      fetchOrders();
    });

    return () => socket.close();
  }, [filters]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();

      if (filters.status) params.append('status', filters.status);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
      if (filters.dateRange && filters.dateRange[0]) {
        params.append('startDate', filters.dateRange[0].toISOString());
      }
      if (filters.dateRange && filters.dateRange[1]) {
        params.append('endDate', filters.dateRange[1].toISOString());
      }

      const response = await fetch(`${API_BASE_URL}/api/analytics/orders?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      message.error('Failed to fetch orders');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const token = localStorage.getItem('auth_token');
    const params = new URLSearchParams({ format: 'csv' });

    if (filters.dateRange && filters.dateRange[0]) {
      params.append('startDate', filters.dateRange[0].toISOString());
    }
    if (filters.dateRange && filters.dateRange[1]) {
      params.append('endDate', filters.dateRange[1].toISOString());
    }

    window.open(
      `${API_BASE_URL}/api/analytics/export?${params.toString()}&token=${token}`,
      '_blank'
    );
  };

  const exportToCSVClient = () => {
    const csvData = orders.map((order) => ({
      'Order ID': order.id,
      'User ID': order.userId || '',
      'Status': order.status,
      'Payment Status': order.paymentStatus,
      'Subtotal': order.subtotal,
      'Tax': order.tax,
      'Total': order.total,
      'Items Count': order.items.reduce((sum, item) => sum + item.quantity, 0),
      'Created At': order.createdAt,
      'Updated At': order.updatedAt,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payments_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      processing: 'blue',
      succeeded: 'green',
      failed: 'red',
      refunded: 'default',
    };
    return colors[status] || 'default';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      confirmed: 'blue',
      preparing: 'cyan',
      ready: 'purple',
      completed: 'green',
      cancelled: 'red',
    };
    return colors[status] || 'default';
  };

  // Calculate statistics
  const totalRevenue = orders
    .filter((o) => o.paymentStatus === 'succeeded')
    .reduce((sum, o) => sum + o.total, 0);

  const successfulPayments = orders.filter((o) => o.paymentStatus === 'succeeded').length;
  const failedPayments = orders.filter((o) => o.paymentStatus === 'failed').length;

  const columns = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      fixed: 'left',
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Payment Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status) => (
        <Tag color={getPaymentStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      render: (value) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Tax',
      dataIndex: 'tax',
      key: 'tax',
      render: (value) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (value) => (
        <strong style={{ color: '#52c41a' }}>${value.toFixed(2)}</strong>
      ),
    },
    {
      title: 'Items',
      key: 'items',
      render: (_, record) => record.items.reduce((sum, item) => sum + item.quantity, 0),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Statistics Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Revenue"
                value={totalRevenue}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Successful Payments"
                value={successfulPayments}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Failed Payments"
                value={failedPayments}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Orders"
                value={orders.length}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters and Actions */}
        <Card>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space wrap>
              <Select
                placeholder="Filter by Status"
                style={{ width: 150 }}
                allowClear
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
              >
                <Option value="pending">Pending</Option>
                <Option value="confirmed">Confirmed</Option>
                <Option value="preparing">Preparing</Option>
                <Option value="ready">Ready</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
              </Select>

              <Select
                placeholder="Filter by Payment Status"
                style={{ width: 180 }}
                allowClear
                value={filters.paymentStatus}
                onChange={(value) => setFilters({ ...filters, paymentStatus: value })}
              >
                <Option value="pending">Pending</Option>
                <Option value="processing">Processing</Option>
                <Option value="succeeded">Succeeded</Option>
                <Option value="failed">Failed</Option>
                <Option value="refunded">Refunded</Option>
              </Select>

              <RangePicker
                value={filters.dateRange}
                onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              />
            </Space>

            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={exportToCSVClient}
              >
                Export CSV
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Orders Table */}
        <Card title="Payment Transactions">
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1000 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} orders`,
            }}
          />
        </Card>
      </Space>
  );
}

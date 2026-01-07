import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  DatePicker,
  Select,
  message,
  Spin,
  Table,
  Tag,
} from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  DownloadOutlined,
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { io } from 'socket.io-client';
import Papa from 'papaparse';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface AnalyticsData {
  overview: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    todayOrders: number;
    todayRevenue: number;
  };
  ordersByStatus: Record<string, number>;
  revenueByDay: Record<string, number>;
  topSellingItems: Array<{ name: string; count: number }>;
  paymentStatusBreakdown: Record<string, number>;
  inventory: {
    totalMenuItems: number;
    availableItems: number;
    lowStockItems: number;
  };
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();

    // Set up Socket.io for real-time updates
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server (Analytics)');
    });

    newSocket.on('order:created', () => {
      fetchAnalytics();
    });

    newSocket.on('order:status:updated', () => {
      fetchAnalytics();
    });

    newSocket.on('menu:updated', () => {
      fetchAnalytics();
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.append('startDate', dateRange[0].toISOString());
        params.append('endDate', dateRange[1].toISOString());
      }

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/analytics/dashboard?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      } else {
        message.error('Failed to fetch analytics: ' + data.message);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      message.error('Error fetching analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.append('startDate', dateRange[0].toISOString());
        params.append('endDate', dateRange[1].toISOString());
      }

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/api/analytics/export?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `analytics_export_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        message.success('Analytics data exported successfully');
      } else {
        message.error('Failed to export analytics data');
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      message.error('Error exporting analytics data');
    }
  };

  const handleExportCustomCSV = () => {
    if (!analytics) return;

    const csvData = [
      ['Metric', 'Value'],
      ['Total Orders', analytics.overview.totalOrders.toString()],
      ['Total Revenue', `$${analytics.overview.totalRevenue.toFixed(2)}`],
      ['Average Order Value', `$${analytics.overview.averageOrderValue.toFixed(2)}`],
      ['Today Orders', analytics.overview.todayOrders.toString()],
      ['Today Revenue', `$${analytics.overview.todayRevenue.toFixed(2)}`],
      [''],
      ['Orders by Status', ''],
      ...Object.entries(analytics.ordersByStatus).map(([status, count]) => [status, count.toString()]),
      [''],
      ['Top Selling Items', ''],
      ...analytics.topSellingItems.map((item) => [item.name, item.count.toString()]),
    ];

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `analytics_custom_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Custom analytics data exported');
  };

  if (loading && !analytics) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading analytics..." />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <p>No analytics data available</p>
      </Card>
    );
  }

  // Prepare chart data
  const revenueByDayData = Object.entries(analytics.revenueByDay)
    .map(([date, revenue]) => ({
      date: dayjs(date).format('MMM DD'),
      revenue: parseFloat(revenue.toFixed(2)),
    }))
    .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());

  const ordersByStatusData = Object.entries(analytics.ordersByStatus).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  }));

  const paymentStatusData = Object.entries(analytics.paymentStatusBreakdown).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  }));

  const topSellingItemsData = analytics.topSellingItems.map((item) => ({
    name: item.name,
    quantity: item.count,
  }));

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Analytics Dashboard</h1>
          <Space>
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              value={dateRange}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchAnalytics} loading={loading}>
              Refresh
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportCSV}>
              Export CSV
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportCustomCSV}>
              Export Custom
            </Button>
          </Space>
        </div>

        {/* Overview Statistics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Revenue"
                value={analytics.overview.totalRevenue}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Orders"
                value={analytics.overview.totalOrders}
                prefix={<ShoppingCartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Average Order Value"
                value={analytics.overview.averageOrderValue}
                precision={2}
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Today's Revenue"
                value={analytics.overview.todayRevenue}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts Row 1 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Revenue Trend (Last 7 Days)">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueByDayData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Orders by Status">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={ordersByStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {ordersByStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Charts Row 2 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Payment Status Breakdown">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={paymentStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Top Selling Items">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSellingItemsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantity" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Inventory Status */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Menu Items"
                value={analytics.inventory.totalMenuItems}
                prefix={<ShoppingCartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Available Items"
                value={analytics.inventory.availableItems}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Low Stock Items"
                value={analytics.inventory.lowStockItems}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Detailed Tables */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Orders by Status Details">
              <Table
                dataSource={Object.entries(analytics.ordersByStatus).map(([status, count]) => ({
                  key: status,
                  status,
                  count,
                }))}
                columns={[
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => (
                      <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
                    ),
                  },
                  {
                    title: 'Count',
                    dataIndex: 'count',
                    key: 'count',
                  },
                ]}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Top Selling Items">
              <Table
                dataSource={analytics.topSellingItems.map((item, index) => ({
                  key: index,
                  ...item,
                }))}
                columns={[
                  {
                    title: 'Item Name',
                    dataIndex: 'name',
                    key: 'name',
                  },
                  {
                    title: 'Quantity Sold',
                    dataIndex: 'count',
                    key: 'count',
                  },
                ]}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'orange',
    confirmed: 'blue',
    preparing: 'geekblue',
    ready: 'cyan',
    completed: 'green',
    cancelled: 'red',
  };
  return colors[status] || 'default';
}

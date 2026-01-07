import { useState, useEffect, Suspense, lazy } from 'react';
import { Layout, Menu, Button, message, Space, Spin } from 'antd';
import {
  MenuOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  TruckOutlined,
  DashboardOutlined,
  LogoutOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { io } from 'socket.io-client';
import { MenuForm } from './components/MenuForm';
import { LocationUpdate } from './components/LocationUpdate';
import { PromoAlert } from './components/PromoAlert';
// Lazy load pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const Payments = lazy(() => import('./pages/Payments'));
const TeamCoordination = lazy(() => import('./components/TeamCoordination'));
// Ant Design styles are imported via Vite plugin
import './App.css';

const { Header, Sider, Content } = Layout;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function App() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [socket, setSocket] = useState(null);
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('menu:created', () => {
      message.success('New menu item created');
      fetchMenus();
    });

    newSocket.on('menu:updated', () => {
      fetchMenus();
    });

    newSocket.on('order:created', () => {
      message.info('New order received');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (selectedKey === 'menus') {
      fetchMenus();
    }
  }, [selectedKey]);

  const fetchMenus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/menus`);
      const data = await response.json();
      if (data.success) {
        setMenus(data.data);
      }
    } catch (error) {
      message.error('Failed to fetch menus');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (menu) => {
    setSelectedMenu(menu);
    setShowForm(true);
  };

  const handleCreate = () => {
    setSelectedMenu(null);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedMenu(null);
    fetchMenus();
    message.success('Menu item saved successfully');
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedMenu(null);
  };

  const renderContent = () => {
    const LoadingFallback = () => (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );

    if (selectedKey === 'dashboard') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <Dashboard />
        </Suspense>
      );
    }

    if (selectedKey === 'analytics') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <AnalyticsDashboard />
        </Suspense>
      );
    }

    if (selectedKey === 'payments') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <Payments />
        </Suspense>
      );
    }

    if (selectedKey === 'locations') {
      return <LocationUpdate />;
    }

    if (selectedKey === 'team') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <TeamCoordination />
        </Suspense>
      );
    }

    if (selectedKey === 'menus') {
      if (showForm) {
        return (
          <MenuForm
            menuItem={selectedMenu}
            onSuccess={handleFormSuccess}
            onCancel={handleCancel}
          />
        );
      }

      return (
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2>Menu Items ({menus.length})</h2>
            <Button type="primary" onClick={handleCreate}>
              + Create Menu Item
            </Button>
          </div>
          {menus.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>No menu items found. Create one to get started!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {menus.map((menu) => (
                <div
                  key={menu.id}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  {menu.imageUrl && (
                    <img
                      src={menu.imageUrl}
                      alt={menu.name}
                      style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ padding: '16px' }}>
                    <h3 style={{ margin: '0 0 8px 0' }}>{menu.name}</h3>
                    <p style={{ color: '#666', margin: '0 0 12px 0' }}>{menu.description}</p>
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ fontSize: '20px', color: '#f4511e' }}>
                        ${menu.price.toFixed(2)}
                      </strong>
                      <div style={{ marginTop: '8px' }}>
                        <span style={{ color: menu.isAvailable ? '#4caf50' : '#f44336' }}>
                          {menu.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                        {' • '}
                        <span>Stock: {menu.stock}</span>
                      </div>
                    </div>
                    <Button onClick={() => handleEdit(menu)} block>
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'analytics',
      icon: <BarChartOutlined />,
      label: 'Analytics',
    },
    {
      key: 'menus',
      icon: <MenuOutlined />,
      label: 'Menus',
    },
    {
      key: 'payments',
      icon: <DollarOutlined />,
      label: 'Payments',
    },
    {
      key: 'locations',
      icon: <TruckOutlined />,
      label: 'Truck Locations',
    },
    {
      key: 'team',
      icon: <ShoppingCartOutlined />,
      label: 'Team Coordination',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={200}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <h2 style={{ margin: 0, color: '#f4511e' }}>Food Truck Admin</h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => {
            setSelectedKey(key);
            setShowForm(false);
          }}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '20px' }}>Admin Portal</h1>
          <Space>
            {selectedKey === 'dashboard' && (
              <Button type="primary" onClick={() => setShowPromoModal(true)}>
                Send Promo
              </Button>
            )}
            <Button icon={<LogoutOutlined />}>Logout</Button>
          </Space>
        </Header>
        <Content
          style={{
            margin: '24px',
            padding: '24px',
            background: '#fff',
            minHeight: 280,
            borderRadius: '8px',
          }}
        >
          {renderContent()}
        </Content>
      </Layout>
      <PromoAlert visible={showPromoModal} onCancel={() => setShowPromoModal(false)} />
    </Layout>
  );
}

export default App;

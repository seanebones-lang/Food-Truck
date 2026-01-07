import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { menuItemSchema, MENU_CATEGORIES } from '@food-truck/shared';
import { io } from 'socket.io-client';
import './MenuForm.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function MenuForm({ menuItem = null, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const isEditMode = !!menuItem;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(menuItemSchema),
    defaultValues: menuItem || {
      name: '',
      description: '',
      price: 0,
      category: 'Burgers',
      imageUrl: '',
      stock: 0,
      isAvailable: true,
      tags: [],
    },
  });

  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('menu:updated', (data) => {
      console.log('Menu updated via socket:', data);
      if (onSuccess) {
        onSuccess();
      }
    });

    newSocket.on('stock:update', (data) => {
      console.log('Stock updated via socket:', data);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (menuItem) {
      reset(menuItem);
    }
  }, [menuItem, reset]);

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token'); // Get from your auth system
      const url = isEditMode
        ? `${API_BASE_URL}/api/menus/${menuItem.id}`
        : `${API_BASE_URL}/api/menus`;

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save menu item');
      }

      if (onSuccess) {
        onSuccess(result.data);
      }

      // Reset form if creating new item
      if (!isEditMode) {
        reset({
          name: '',
          description: '',
          price: 0,
          category: 'Burgers',
          imageUrl: '',
          stock: 0,
          isAvailable: true,
          tags: [],
        });
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !confirm('Are you sure you want to delete this menu item?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/menus/${menuItem.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete menu item');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="menu-form">
      <h2>{isEditMode ? 'Edit Menu Item' : 'Create Menu Item'}</h2>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              id="name"
              type="text"
              placeholder="Menu item name"
              className={errors.name ? 'error' : ''}
            />
          )}
        />
        {errors.name && (
          <span className="field-error">{errors.name.message}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="description">Description *</label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              id="description"
              placeholder="Menu item description"
              rows={4}
              className={errors.description ? 'error' : ''}
            />
          )}
        />
        {errors.description && (
          <span className="field-error">{errors.description.message}</span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="price">Price *</label>
          <Controller
            name="price"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                id="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                className={errors.price ? 'error' : ''}
              />
            )}
          />
          {errors.price && (
            <span className="field-error">{errors.price.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="category">Category *</label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                id="category"
                className={errors.category ? 'error' : ''}
              >
                {MENU_CATEGORIES.filter((cat) => cat !== 'All').map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.category && (
            <span className="field-error">{errors.category.message}</span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="imageUrl">Image URL</label>
        <Controller
          name="imageUrl"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              id="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              className={errors.imageUrl ? 'error' : ''}
            />
          )}
        />
        {errors.imageUrl && (
          <span className="field-error">{errors.imageUrl.message}</span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="stock">Stock</label>
          <Controller
            name="stock"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                id="stock"
                type="number"
                min="0"
                placeholder="0"
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                className={errors.stock ? 'error' : ''}
              />
            )}
          />
          {errors.stock && (
            <span className="field-error">{errors.stock.message}</span>
          )}
        </div>

        <div className="form-group">
          <label>
            <Controller
              name="isAvailable"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            Available
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
        </button>
        {isEditMode && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="btn btn-danger"
          >
            Delete
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

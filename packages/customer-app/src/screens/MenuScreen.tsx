import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { SearchBar, Chip } from 'react-native-elements';
import type { MenuItem, MenuCategory, MenuFilters } from '@food-truck/shared';
import { MENU_CATEGORIES, formatCurrency } from '@food-truck/shared';
import { useCartStore } from '../store/cartStore';
import { useDebounce } from '../hooks/useDebounce';
import { io } from 'socket.io-client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface MenuScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ navigation }) => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [filteredMenus, setFilteredMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>('All');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const { addItem, getItemQuantity } = useCartStore();
  const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001';

  // Socket.io for real-time updates
  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('menu:updated', () => {
      fetchMenus();
    });

    socket.on('stock:update', (data) => {
      setMenus((prevMenus) =>
        prevMenus.map((item) =>
          item.id === data.menuId
            ? { ...item, stock: data.stock, isAvailable: data.isAvailable }
            : item
        )
      );
      setFilteredMenus((prevMenus) =>
        prevMenus.map((item) =>
          item.id === data.menuId
            ? { ...item, stock: data.stock, isAvailable: data.isAvailable }
            : item
        )
      );
    });

    return () => {
      socket.close();
    };
  }, []);

  const fetchMenus = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'All') {
        params.append('category', selectedCategory);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      if (showAvailableOnly) {
        params.append('availableOnly', 'true');
      }

      const response = await fetch(`${API_BASE_URL}/api/menus?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setMenus(data.data);
        setFilteredMenus(data.data);
      }
    } catch (error) {
      console.error('Error fetching menus:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, debouncedSearch, showAvailableOnly]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMenus();
  }, [fetchMenus]);

  const handleAddToCart = (menuItem: MenuItem) => {
    if (menuItem.isAvailable && menuItem.stock > 0) {
      addItem(menuItem, 1);
    }
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => {
    const quantityInCart = getItemQuantity(item.id);
    const isOutOfStock = !item.isAvailable || item.stock === 0;

    return (
      <View style={styles.menuItem}>
        {item.imageUrl ? (
          <FastImage
            source={{ uri: item.imageUrl, priority: FastImage.priority.normal }}
            style={styles.menuImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={styles.menuImagePlaceholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}

        <View style={styles.menuItemContent}>
          <View style={styles.menuItemHeader}>
            <Text style={styles.menuItemName}>{item.name}</Text>
            <Text style={styles.menuItemPrice}>{formatCurrency(item.price)}</Text>
          </View>

          <Text style={styles.menuItemDescription} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.menuItemFooter}>
            <View style={styles.stockInfo}>
              {isOutOfStock ? (
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              ) : (
                <Text style={styles.stockText}>In Stock ({item.stock})</Text>
              )}
            </View>

            {quantityInCart > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{quantityInCart}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.addButton, isOutOfStock && styles.addButtonDisabled]}
              onPress={() => handleAddToCart(item)}
              disabled={isOutOfStock}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderCategoryChip = (category: MenuCategory) => (
    <Chip
      key={category}
      title={category}
      onPress={() => setSelectedCategory(category)}
      buttonStyle={
        selectedCategory === category ? styles.chipSelected : styles.chip
      }
      titleStyle={
        selectedCategory === category
          ? styles.chipTitleSelected
          : styles.chipTitle
      }
      containerStyle={styles.chipContainer}
    />
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f4511e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          placeholder="Search menu items..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          platform="default"
          containerStyle={styles.searchBarContainer}
          inputContainerStyle={styles.searchBarInput}
          lightTheme
          round
        />
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.categoryContainer}>
          {MENU_CATEGORIES.map(renderCategoryChip)}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            showAvailableOnly && styles.filterButtonActive,
          ]}
          onPress={() => setShowAvailableOnly(!showAvailableOnly)}
        >
          <Text
            style={[
              styles.filterButtonText,
              showAvailableOnly && styles.filterButtonTextActive,
            ]}
          >
            Available Only
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredMenus}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No menu items found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchBarContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    padding: 0,
  },
  searchBarInput: {
    backgroundColor: '#f0f0f0',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  chipContainer: {
    marginRight: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#f0f0f0',
  },
  chipSelected: {
    backgroundColor: '#f4511e',
  },
  chipTitle: {
    color: '#333',
  },
  chipTitleSelected: {
    color: '#fff',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    alignSelf: 'flex-start',
  },
  filterButtonActive: {
    backgroundColor: '#f4511e',
    borderColor: '#f4511e',
  },
  filterButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 15,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  menuImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 16,
  },
  menuItemContent: {
    padding: 15,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  menuItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  menuItemPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4511e',
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  menuItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockInfo: {
    flex: 1,
  },
  stockText: {
    fontSize: 12,
    color: '#4caf50',
  },
  outOfStockText: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '600',
  },
  cartBadge: {
    backgroundColor: '#f4511e',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#f4511e',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

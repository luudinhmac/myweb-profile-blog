'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notificationService } from '@/features/notifications/services/notificationService';
import { Notification } from '@/types';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (silent?: boolean) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteAll: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  pausePolling: () => void;
  resumePolling: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pauseCount, setPauseCount] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Fetch function
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const [data, countData] = await Promise.all([
        notificationService.getAll(),
        notificationService.getUnreadCount()
      ]);
      setNotifications(data);
      setUnreadCount(countData.count);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  // Expose pause/resume actions for dropdowns
  const pausePolling = useCallback(() => {
    setPauseCount(prev => prev + 1);
  }, []);

  const resumePolling = useCallback(() => {
    setPauseCount(prev => Math.max(0, prev - 1));
  }, []);

  // Broadcast channel for cross-tab sync
  const broadcastSync = () => {
    try {
      const channel = new BroadcastChannel('notifications_sync');
      channel.postMessage('sync');
      channel.close();
    } catch (e) {
      // BroadcastChannel might fail in some older environments
    }
  };

  // Initial fetch and visibility listener
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Fetch immediately on mount/login
    fetchNotifications();

    const handleVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      if (visible) {
        fetchNotifications(true); // Silent refresh immediately when tab gets focus
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, fetchNotifications]);

  // Polling interval - stops if backgrounded, logged out, or if polling is paused (dropdown open)
  useEffect(() => {
    if (!user || pauseCount > 0 || !isTabVisible) return;

    const interval = setInterval(() => {
      fetchNotifications(true); // Silent polling update
    }, 60000);

    return () => clearInterval(interval);
  }, [user, pauseCount, isTabVisible, fetchNotifications]);

  // Sync state between tabs
  useEffect(() => {
    if (!user) return;
    
    const channel = new BroadcastChannel('notifications_sync');
    channel.onmessage = (event) => {
      if (event.data === 'sync') {
        fetchNotifications(true); // Silent update on broadcast sync
      }
    };
    return () => channel.close();
  }, [user, fetchNotifications]);

  // MUTATIONS with Optimistic Updates & Rollbacks
  const markAsRead = async (id: number) => {
    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;

    // Optimistic Update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    const target = notifications.find(n => n.id === id);
    if (target && !target.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      await notificationService.markAsRead(id);
      broadcastSync();
    } catch (err) {
      // Rollback on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      console.error('Error marking notification as read:', err);
      throw err;
    }
  };

  const markAllAsRead = async () => {
    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;

    // Optimistic Update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllAsRead();
      broadcastSync();
    } catch (err) {
      // Rollback on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  };

  const deleteAll = async () => {
    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;

    // Optimistic Update
    setNotifications([]);
    setUnreadCount(0);

    try {
      await notificationService.deleteAll();
      broadcastSync();
    } catch (err) {
      // Rollback on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      console.error('Error deleting all notifications:', err);
      throw err;
    }
  };

  const deleteNotification = async (id: number) => {
    const previousNotifications = [...notifications];
    const previousUnreadCount = unreadCount;

    // Optimistic Update
    setNotifications(prev => prev.filter(n => n.id !== id));
    const deleted = notifications.find(n => n.id === id);
    if (deleted && !deleted.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      await notificationService.delete(id);
      broadcastSync();
    } catch (err) {
      // Rollback on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      console.error('Error deleting notification:', err);
      throw err;
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      deleteAll,
      deleteNotification,
      pausePolling,
      resumePolling
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

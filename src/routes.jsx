import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export const routes = [
  {
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      {
        path: 'login',
        element: <Login />
      },
      {
        path: '/',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <Dashboard />
          }
          // 未來可以加上 /admin/teams 等路徑
        ]
      },
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ]
  }
];

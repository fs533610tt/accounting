import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminLayout = () => {
  const { user, isSuperAdmin, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* 頂部導覽列 */}
      <header className="glass-panel app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>作帳系統</h1>
          {isSuperAdmin && <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--primary-color)', padding: '2px 8px', borderRadius: '12px', marginTop: '4px', display: 'inline-block' }}>Super Admin</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="hide-on-mobile">{user.email}</span>
          <button className="btn-primary" onClick={logout} style={{ padding: '6px 16px', width: 'auto', fontSize: '0.9rem' }}>登出</button>
        </div>
      </header>

      {/* 主內容區塊 */}
      <main className="app-main" style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* 頁尾 - 顯示版本時間 */}
      <footer style={{ textAlign: 'center', padding: '16px', color: '#666', fontSize: '0.8rem' }}>
        部署版本時間：{__APP_VERSION__}
      </footer>
    </div>
  );
};

export default AdminLayout;

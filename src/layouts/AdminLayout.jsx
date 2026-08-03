import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminLayout = () => {
  const { user, isSuperAdmin, userRoles, logout } = useAuth();
  
  const adminRoles = userRoles ? userRoles.filter(r => r.role !== 'superadmin') : [];
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'superadmin' : (adminRoles.length > 0 ? adminRoles[0].team_id : 'none'));

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* 頂部導覽列 */}
      <header className="glass-panel app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="hide-on-mobile">
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>作帳系統</h1>
          {isSuperAdmin && <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--primary-color)', padding: '2px 8px', borderRadius: '12px', marginTop: '4px', display: 'inline-block' }}>Super Admin</span>}
        </div>
        <div className="header-right-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'space-between' }}>
          
          {/* 球隊切換選單與加入按鈕 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {userRoles && userRoles.length > 0 && (
              <select 
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '150px'
                }}
              >
                {isSuperAdmin && <option value="superadmin" style={{ background: '#1a1a2e', color: 'white' }}>👑 系統管理中心</option>}
                {adminRoles.map(role => (
                  <option key={role.team_id} value={role.team_id} style={{ background: '#1a1a2e', color: 'white' }}>🏓 {role.teams?.name}</option>
                ))}
              </select>
            )}
            
            <button 
              onClick={async () => {
                const code = window.prompt('請輸入邀請碼：');
                if (!code) return;
                const { supabase } = await import('../config/supabaseClient');
                const { error } = await supabase.rpc('join_team_by_code', { invite_code: code });
                if (error) {
                  alert('加入失敗：' + error.message);
                } else {
                  alert('成功加入球隊！請重新整理頁面。');
                  window.location.reload();
                }
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.5)',
                color: 'white',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="輸入邀請碼加入其他球隊"
            >
              ➕ <span className="hide-on-mobile">加入球隊</span>
            </button>
          </div>

          <span className="hide-on-mobile">{user.email}</span>
          <button className="btn-primary" onClick={logout} style={{ padding: '6px 16px', width: 'auto', fontSize: '0.9rem' }}>登出</button>
        </div>
      </header>

      {/* 主內容區塊 */}
      <main className="app-main" style={{ flex: 1 }}>
        <Outlet context={{ activeTab }} />
      </main>

      {/* 頁尾 - 顯示版本時間 */}
      <footer style={{ textAlign: 'center', padding: '16px', color: '#666', fontSize: '0.8rem' }}>
        部署版本時間：{__APP_VERSION__}
      </footer>
    </div>
  );
};

export default AdminLayout;

import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user, isSuperAdmin, userRoles } = useAuth();

  return (
    <div className="glass-panel" style={{ padding: '32px', margin: '0 auto', maxWidth: '800px' }}>
      <h2>歡迎回來，{user.email}</h2>
      
      {isSuperAdmin ? (
        <div style={{ marginTop: '24px' }}>
          <h3>👑 系統管理中心 (Super Admin)</h3>
          <p style={{ color: 'var(--text-secondary)' }}>您是本系統的最高管理員。未來我們將在這裡實作「審核球隊」、「管理所有租戶」等功能。</p>
          {/* 未來在此處實作審核列表元件 */}
        </div>
      ) : userRoles.length > 0 ? (
        <div style={{ marginTop: '24px' }}>
          <h3>您的球隊</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {userRoles.map((role) => (
              <li key={role.team_id} style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)' }}>
                <strong>{role.teams?.name}</strong> - 角色: {role.role} - 狀態: {role.teams?.status}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={{ marginTop: '24px', textAlign: 'center', padding: '40px 0' }}>
          <h3>您尚未加入任何球隊</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>如果您要建立新球隊，請點擊下方按鈕申請；或是輸入邀請碼加入現有球隊。</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button className="btn-primary" style={{ maxWidth: '200px' }}>申請建立球隊</button>
            <button className="btn-primary" style={{ maxWidth: '200px', backgroundColor: 'transparent', border: '1px solid white' }}>輸入邀請碼</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

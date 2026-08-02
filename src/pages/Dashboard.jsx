import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TeamManagement from '../components/TeamManagement';
import StudentList from '../components/StudentList';
import BillingDashboard from '../components/BillingDashboard';
import TeamSettings from '../components/TeamSettings';

const Dashboard = () => {
  const { user, isSuperAdmin, userRoles } = useAuth();
  
  // 找出所有管理的球隊
  const adminRoles = userRoles.filter(r => r.role !== 'superadmin');
  
  // 預設 active 頁籤：如果是超級管理員就停在系統中心，否則停在第一支球隊
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'superadmin' : (adminRoles.length > 0 ? adminRoles[0].team_id : 'none'));
  
  // 針對個別球隊的子頁籤狀態 (roster: 名冊, billing: 帳務)
  // 用物件儲存每支球隊目前的子頁籤，例如 { 'team_id_1': 'roster', 'team_id_2': 'billing' }
  const [teamSubTabs, setTeamSubTabs] = useState({});

  const handleSubTabChange = (teamId, tab) => {
    setTeamSubTabs(prev => ({ ...prev, [teamId]: tab }));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* 頂部導覽列 (Tabs) */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', overflowX: 'auto' }}>
        {isSuperAdmin && (
          <button 
            onClick={() => setActiveTab('superadmin')}
            style={{ 
              padding: '10px 20px', 
              background: activeTab === 'superadmin' ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'superadmin' ? '2px solid var(--primary-color)' : '2px solid transparent',
              color: activeTab === 'superadmin' ? '#fff' : '#888',
              cursor: 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            👑 系統管理中心
          </button>
        )}

        {adminRoles.map((role) => (
          <button 
            key={role.team_id}
            onClick={() => setActiveTab(role.team_id)}
            style={{ 
              padding: '10px 20px', 
              background: activeTab === role.team_id ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === role.team_id ? '2px solid var(--primary-color)' : '2px solid transparent',
              color: activeTab === role.team_id ? '#fff' : '#888',
              cursor: 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}
          >
            🏓 {role.teams?.name}
          </button>
        ))}
      </div>

      {/* 內容區域 */}
      <div className="glass-panel" style={{ padding: '32px', marginTop: '20px' }}>
        
        {/* 超級管理員頁面 */}
        {activeTab === 'superadmin' && isSuperAdmin && (
          <div>
            <h3 style={{ marginBottom: '10px' }}>系統最高權限控制台</h3>
            <p style={{ color: 'var(--text-secondary)' }}>您可以在這裡建立新的租戶(球隊)並指派管理員。</p>
            <TeamManagement />
          </div>
        )}

        {/* 個別球隊管理頁面 */}
        {adminRoles.map((role) => {
          if (activeTab !== role.team_id) return null;
          
          const currentSubTab = teamSubTabs[role.team_id] || 'roster';

          return (
            <div key={role.team_id}>
              {/* 球隊內部子選單 */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '8px', display: 'inline-flex' }}>
                <button 
                  onClick={() => handleSubTabChange(role.team_id, 'roster')}
                  style={{
                    padding: '8px 16px',
                    background: currentSubTab === 'roster' ? 'var(--primary-color)' : 'transparent',
                    color: currentSubTab === 'roster' ? '#fff' : '#aaa',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  📝 球員名冊
                </button>
                <button 
                  onClick={() => handleSubTabChange(role.team_id, 'billing')}
                  style={{
                    padding: '8px 16px',
                    background: currentSubTab === 'billing' ? 'var(--primary-color)' : 'transparent',
                    color: currentSubTab === 'billing' ? '#fff' : '#aaa',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  💰 帳務收費
                </button>
                <button 
                  onClick={() => handleSubTabChange(role.team_id, 'settings')}
                  style={{
                    padding: '8px 16px',
                    background: currentSubTab === 'settings' ? 'var(--primary-color)' : 'transparent',
                    color: currentSubTab === 'settings' ? '#fff' : '#aaa',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ⚙️ 球隊權限
                </button>
              </div>

              {/* 子頁面內容切換 */}
              {currentSubTab === 'roster' && (
                <StudentList teamId={role.team_id} />
              )}

              {currentSubTab === 'billing' && (
                <BillingDashboard teamId={role.team_id} />
              )}

              {currentSubTab === 'settings' && (
                <TeamSettings teamId={role.team_id} />
              )}
            </div>
          );
        })}

        {/* 如果甚麼權限都沒有 */}
        {activeTab === 'none' && !isSuperAdmin && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <h3>您尚未加入任何球隊</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>如果您要建立新球隊，請點擊下方按鈕申請；或是輸入邀請碼加入現有球隊。</p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => alert('申請功能即將推出！')} style={{ maxWidth: '200px', cursor: 'pointer' }}>申請建立球隊</button>
              <button className="btn-primary" onClick={() => alert('邀請碼功能即將推出！')} style={{ maxWidth: '200px', backgroundColor: 'transparent', border: '1px solid white', color: 'white', cursor: 'pointer' }}>輸入邀請碼</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import TeamManagement from '../components/TeamManagement';
import StudentList from '../components/StudentList';
import BillingDashboard from '../components/BillingDashboard';
import TeamSettings from '../components/TeamSettings';
import { useOutletContext } from 'react-router-dom';

const Dashboard = () => {
  const { user, isSuperAdmin, userRoles } = useAuth();
  const { activeTab } = useOutletContext();
  
  // 找出所有管理的球隊
  const adminRoles = userRoles ? userRoles.filter(r => r.role !== 'superadmin') : [];
  
  // 針對個別球隊的子頁籤狀態 (roster: 名冊, billing: 帳務)
  // 用物件儲存每支球隊目前的子頁籤，例如 { 'team_id_1': 'roster', 'team_id_2': 'billing' }
  const [teamSubTabs, setTeamSubTabs] = useState({});

  const handleSubTabChange = (teamId, tab) => {
    setTeamSubTabs(prev => ({ ...prev, [teamId]: tab }));
  };

  const handleCreateTeam = async () => {
    const teamName = window.prompt('請輸入新球隊名稱：');
    if (!teamName) return;
    
    const { error } = await supabase.rpc('create_new_team', { new_team_name: teamName });
    if (error) {
      alert('建立失敗：' + error.message);
    } else {
      alert('球隊建立成功！請重新整理頁面。');
      window.location.reload();
    }
  };

  const handleJoinTeam = async () => {
    const code = window.prompt('請輸入邀請碼：');
    if (!code) return;
    
    const { error } = await supabase.rpc('join_team_by_code', { invite_code: code });
    if (error) {
      alert('加入失敗：' + error.message);
    } else {
      alert('成功加入球隊！請重新整理頁面。');
      window.location.reload();
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* 內容區域 */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        
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
              <button className="btn-primary" onClick={handleCreateTeam} style={{ maxWidth: '200px', cursor: 'pointer' }}>申請建立球隊</button>
              <button className="btn-primary" onClick={handleJoinTeam} style={{ maxWidth: '200px', backgroundColor: 'transparent', border: '1px solid white', color: 'white', cursor: 'pointer' }}>輸入邀請碼</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;

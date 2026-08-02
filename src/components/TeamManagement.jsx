import React, { useEffect, useState } from 'react';
import { supabase } from '../config/supabaseClient';

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentAdmins, setCurrentAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setTeams(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const { data, error } = await supabase
      .from('teams')
      .insert([{ name: newTeamName, status: 'active' }])
      .select();

    if (error) {
      alert('建立失敗：' + error.message);
    } else {
      setNewTeamName('');
      fetchTeams();
      alert('球隊建立成功！');
    }
  };

  const openAdminModal = async (team) => {
    setSelectedTeam(team);
    setIsModalOpen(true);
    setLoadingUsers(true);
    setLoadingAdmins(true);
    setSearchQuery('');
    setSelectedEmail('');
    
    // 呼叫我們即將在 Supabase 建立的 get_all_users 函數
    const { data: usersData, error: usersError } = await supabase.rpc('get_all_users');
    if (!usersError && usersData) {
      setUsers(usersData);
    }
    setLoadingUsers(false);

    // 取得目前這支球隊的管理員
    const { data: adminsData, error: adminsError } = await supabase.rpc('get_team_admins', {
      target_team_id: team.id
    });
    if (!adminsError && adminsData) {
      setCurrentAdmins(adminsData);
    }
    setLoadingAdmins(false);
  };

  const handleAssignAdmin = async () => {
    if (!selectedEmail) return;
    
    const { error } = await supabase.rpc('assign_team_admin', {
      target_email: selectedEmail,
      target_team_id: selectedTeam.id
    });

    if (error) {
      alert('指派失敗：' + error.message);
    } else {
      alert('指派成功！');
      
      // 重新整理目前管理員名單
      setLoadingAdmins(true);
      const { data: adminsData } = await supabase.rpc('get_team_admins', { target_team_id: selectedTeam.id });
      setCurrentAdmins(adminsData || []);
      setLoadingAdmins(false);
      
      setSelectedEmail('');
      setSearchQuery('');
    }
  };

  const handleRemoveAdmin = async (emailToRemove) => {
    if (!window.confirm(`確定要移除 ${emailToRemove} 的管理員權限嗎？`)) return;
    
    const { error } = await supabase.rpc('remove_team_admin', {
      target_email: emailToRemove,
      target_team_id: selectedTeam.id
    });

    if (error) {
      alert('移除失敗：' + error.message);
    } else {
      alert('移除成功！');
      setCurrentAdmins(currentAdmins.filter(a => a.email !== emailToRemove));
    }
  };

  return (
    <div style={{ marginTop: '24px', textAlign: 'left' }}>
      <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>球隊管理</h3>
      
      <form onSubmit={handleCreateTeam} style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
        <input 
          type="text" 
          placeholder="輸入新球隊名稱..." 
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
        />
        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 24px', cursor: 'pointer' }}>建立球隊</button>
      </form>

      {loading ? (
        <p>載入中...</p>
      ) : teams.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>目前還沒有任何球隊</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>球隊名稱</th>
              <th style={{ padding: '12px' }}>狀態</th>
              <th style={{ padding: '12px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(team => (
              <tr key={team.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px' }}>{team.name}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem',
                    backgroundColor: team.status === 'active' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(241, 196, 15, 0.2)',
                    color: team.status === 'active' ? '#2ecc71' : '#f1c40f'
                  }}>
                    {team.status}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={() => openAdminModal(team)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    指派管理員
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 指派管理員的彈出視窗 */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ padding: '24px', width: '450px', borderRadius: '12px' }}>
            <h3 style={{ marginTop: 0 }}>管理【{selectedTeam?.name}】的權限</h3>
            
            {/* 目前管理員區塊 */}
            <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary-color)' }}>目前管理員名單</h4>
              {loadingAdmins ? (
                <p style={{ fontSize: '0.9rem', color: '#888' }}>載入中...</p>
              ) : currentAdmins.length === 0 ? (
                <p style={{ fontSize: '0.9rem', color: '#888' }}>尚未指派任何管理員</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentAdmins.map(admin => (
                    <div key={admin.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.9rem' }}>{admin.email}</span>
                      <button 
                        onClick={() => handleRemoveAdmin(admin.email)}
                        style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.5)', color: '#ff8888', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 新增管理員區塊 */}
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary-color)' }}>新增管理員</h4>
            <p style={{ fontSize: '0.9rem', color: '#ccc', margin: '0 0 10px 0' }}>搜尋並選擇一位已登入過的系統使用者：</p>
            
            {loadingUsers ? (
              <p>載入使用者名單中...</p>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <input 
                  type="text" 
                  placeholder="輸入信箱關鍵字搜尋 (例如: ma)..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white', marginBottom: '8px' }}
                />
                
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(0,0,0,0.3)' }}>
                  {users
                    .filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => setSelectedEmail(u.email)}
                      style={{ 
                        padding: '10px', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: selectedEmail === u.email ? 'var(--primary-color)' : 'transparent'
                      }}
                    >
                      {u.email}
                    </div>
                  ))}
                  {users.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div style={{ padding: '10px', color: '#888' }}>找不到符合的信箱</div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>關閉視窗</button>
              <button className="btn-primary" onClick={handleAssignAdmin} style={{ padding: '8px 16px', cursor: 'pointer' }} disabled={!selectedEmail}>加入為管理員</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;

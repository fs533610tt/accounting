import React, { useEffect, useState } from 'react';
import { supabase } from '../config/supabaseClient';

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState('');
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
    setLoadingAdmins(true);
    setSelectedEmail('');

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
      
      <form className="flex-mobile-column" onSubmit={handleCreateTeam} style={{ display: 'flex', gap: '8px', margin: '16px 0', flexWrap: 'wrap' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '16px' }}>
          {teams.map(team => (
            <div 
              key={team.id} 
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '12px', 
                border: '1px solid rgba(255,255,255,0.08)', 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '15px',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>{team.name}</h4>
                <span style={{ 
                  padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold',
                  backgroundColor: team.status === 'active' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(241, 196, 15, 0.1)',
                  border: `1px solid ${team.status === 'active' ? 'rgba(46, 204, 113, 0.3)' : 'rgba(241, 196, 15, 0.3)'}`,
                  color: team.status === 'active' ? '#4ade80' : '#f1c40f'
                }}>
                  {team.status === 'active' ? '使用中' : team.status}
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => openAdminModal(team)}
                  style={{ padding: '8px 16px', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '6px', width: '100%', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  ⚙️ 指派管理員
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 指派管理員的彈出視窗 */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', 
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-panel" style={{ padding: '24px', width: '100%', maxWidth: '450px', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }}>
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
            <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary-color)' }}>直接加入管理員</h4>
            <p style={{ fontSize: '0.9rem', color: '#ccc', margin: '0 0 10px 0' }}>如果您知道對方「已登入過本系統」的 Google 信箱，可以直接輸入：</p>
            
            <div style={{ marginBottom: '20px' }}>
              <input 
                type="email" 
                placeholder="例如: coach@gmail.com" 
                value={selectedEmail}
                onChange={(e) => setSelectedEmail(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white', marginBottom: '8px' }}
              />
            </div>

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

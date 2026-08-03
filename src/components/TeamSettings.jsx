import React, { useEffect, useState } from 'react';
import { supabase } from '../config/supabaseClient';

const TeamSettings = ({ teamId }) => {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentAdmins, setCurrentAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [invites, setInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    const { data: adminsData, error: adminsError } = await supabase.rpc('get_team_admins', {
      target_team_id: teamId
    });
    if (!adminsError && adminsData) {
      setCurrentAdmins(adminsData);
    } else if (adminsError) {
      console.error('Failed to fetch admins:', adminsError);
    }
    setLoadingAdmins(false);
  };

  const handleEmailChange = async (e) => {
    const val = e.target.value;
    setSelectedEmail(val);
    
    if (val.length >= 3) {
      const { data, error } = await supabase.rpc('search_users_by_email', { keyword: val });
      if (!error && data) {
        setSuggestions(data.map(d => d.email));
        setShowSuggestions(true);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };



  const fetchInvites = async () => {
    setLoadingInvites(true);
    const { data, error } = await supabase.rpc('get_team_invites', { target_team_id: teamId });
    if (!error && data) {
      setInvites(data);
    }
    setLoadingInvites(false);
  };

  useEffect(() => {
    if (teamId) {
      fetchAdmins();
      fetchInvites();
    }
  }, [teamId]);

  const handleAssignAdmin = async (e) => {
    e.preventDefault();
    if (!selectedEmail) return;
    
    const { error } = await supabase.rpc('assign_team_admin', {
      target_email: selectedEmail,
      target_team_id: teamId
    });

    if (error) {
      alert('指派失敗：' + error.message);
    } else {
      alert('指派成功！');
      fetchAdmins();
      setSelectedEmail('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleRemoveAdmin = async (emailToRemove) => {
    if (!window.confirm(`確定要移除 ${emailToRemove} 的管理員權限嗎？`)) return;
    
    const { error } = await supabase.rpc('remove_team_admin', {
      target_email: emailToRemove,
      target_team_id: teamId
    });

    if (error) {
      alert('移除失敗：' + error.message);
    } else {
      alert('移除成功！');
      fetchAdmins();
    }
  };

  const handleGenerateInvite = async () => {
    const { data, error } = await supabase.rpc('generate_invite_code', { target_team_id: teamId });
    if (error) {
      alert('產生失敗：' + error.message);
    } else {
      fetchInvites();
      alert(`產生成功！邀請碼為：${data}`);
    }
  };

  const handleDeleteInvite = async (code) => {
    if (!window.confirm('確定要刪除這組邀請碼嗎？這將使該邀請碼立即失效。')) return;
    const { error } = await supabase.rpc('delete_invite_code', { target_code: code, target_team_id: teamId });
    if (error) {
      alert('刪除失敗：' + error.message);
    } else {
      fetchInvites();
    }
  };

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* 目前管理員區塊 */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--primary-color)' }}>👥 目前管理員名單</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            這些帳號擁有此球隊的最高管理權限，可編輯球員名冊與發布帳單。
          </p>
          
          {loadingAdmins ? (
            <p style={{ color: '#888' }}>載入中...</p>
          ) : currentAdmins.length === 0 ? (
            <p style={{ color: '#888' }}>尚未指派任何管理員</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentAdmins.map(admin => (
                <div key={admin.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>{admin.email}</span>
                  <button 
                    onClick={() => handleRemoveAdmin(admin.email)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.5)', color: '#ff8888', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    卸任
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 新增管理員區塊 */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--primary-color)' }}>➕ 直接加入管理員</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            如果您知道對方「已登入過本系統」的 Google 信箱，可以直接輸入信箱將其設為共同管理員。
          </p>
          
          <form onSubmit={handleAssignAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
            <input 
              type="email" 
              required
              placeholder="例如: coach@gmail.com" 
              value={selectedEmail}
              onChange={handleEmailChange}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
            />
            
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '55px', left: 0, right: 0, background: 'rgba(30,30,40,0.95)', border: '1px solid var(--glass-border)', borderRadius: '8px', zIndex: 10, maxHeight: '150px', overflowY: 'auto' }}>
                {suggestions.map((email, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setSelectedEmail(email);
                      setShowSuggestions(false);
                    }}
                    style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: idx < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {email}
                  </div>
                ))}
              </div>
            )}
            
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={!selectedEmail}
              style={{ marginTop: '12px', padding: '12px', opacity: selectedEmail ? 1 : 0.5, cursor: selectedEmail ? 'pointer' : 'not-allowed' }}
            >
              確認指派
            </button>
          </form>
        </div>

        {/* 邀請碼區塊 */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>🎟️ 專屬邀請碼</h3>
            <button onClick={handleGenerateInvite} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', width: 'auto' }}>
              + 產生邀請碼
            </button>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            不想手動搜尋信箱？您可以產生一組邀請碼丟到群組中。其他教練登入後輸入此碼，就能直接加入共同管理。
          </p>
          
          {loadingInvites ? (
            <p style={{ color: '#888' }}>載入中...</p>
          ) : invites.length === 0 ? (
            <p style={{ color: '#888' }}>目前沒有有效的邀請碼</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {invites.map(invite => (
                <div key={invite.code} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--primary-color)', padding: '16px', borderRadius: '8px', minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '2px', color: 'white', marginBottom: '8px' }}>{invite.code}</span>
                  <span style={{ fontSize: '0.8rem', color: '#888', marginBottom: '12px' }}>
                    建立於：{new Date(invite.created_at).toLocaleDateString()}
                  </span>
                  <button 
                    onClick={() => handleDeleteInvite(invite.code)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.5)', color: '#ff8888', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}
                  >
                    作廢此邀請碼
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TeamSettings;

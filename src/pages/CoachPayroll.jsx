import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const CoachPayroll = ({ teamId, forcedTab, hideSubTabs }) => {
  const { userRoles, session } = useAuth();
  const currentUserId = session?.user?.id;
  
  const currentRole = useMemo(() => {
    if (!userRoles) return null;
    const roleObj = userRoles.find(r => r.team_id === teamId);
    if (!roleObj) return 'superadmin';
    return roleObj.role;
  }, [userRoles, teamId]);

  const isRegularCoach = currentRole === 'coach';

  const [activeTab, setActiveTab] = useState(forcedTab || (isRegularCoach ? 'attendance' : 'roster'));
  const [coaches, setCoaches] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Roster state
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoach, setNewCoach] = useState({ name: '', default_hourly_rate: 0 });
  const [teamMembers, setTeamMembers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Attendance state
  const [newAttendance, setNewAttendance] = useState({
    work_date: new Date().toISOString().split('T')[0],
    work_time: new Date().toTimeString().substring(0, 5),
    coach_id: '',
  });

  // Admin Search State
  const [searchMonth, setSearchMonth] = useState(new Date().toISOString().substring(0, 7));
  const [searchCoachId, setSearchCoachId] = useState('all');

  useEffect(() => {
    if (teamId) {
      fetchCoaches();
      fetchTeamMembers();
    }
  }, [teamId]);

  useEffect(() => {
    if (teamId && activeTab === 'attendance') {
      fetchMyAttendance();
    } else if (teamId && activeTab === 'attendance_search') {
      fetchAllAttendance(searchMonth, searchCoachId);
    }
  }, [teamId, activeTab, searchMonth, searchCoachId, currentUserId]);

  const summaryByCoach = useMemo(() => {
    const summary = {};
    attendance.forEach(record => {
      const cid = record.coach_id;
      if (!summary[cid]) {
        summary[cid] = {
          name: record.coaches?.name || '未知教練',
          total_hours: 0,
          total_pay: 0
        };
      }
      summary[cid].total_hours += Number(record.hours_worked);
      summary[cid].total_pay += Number(record.total_pay);
    });
    return Object.values(summary);
  }, [attendance]);

  const fetchCoaches = async () => {
    const { data, error } = await supabase
      .from('coaches')
      .select('*')
      .eq('team_id', teamId)
      .order('is_active', { ascending: false })
      .order('name');
    
    if (!error && data) {
      setCoaches(data);
      // 自動選擇自己
      const myCoachRecord = data.find(c => c.user_id === currentUserId);
      if (myCoachRecord && !newAttendance.coach_id) {
        setNewAttendance(prev => ({ 
          ...prev, 
          coach_id: myCoachRecord.id 
        }));
      }
    }
  };

  const fetchTeamMembers = async () => {
    const { data } = await supabase.rpc('get_team_members', { target_team_id: teamId });
    if (data) setTeamMembers(data);
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setSelectedEmail(val);
    setSelectedUserId(null);

    if (val.length >= 2) {
      const filtered = teamMembers.filter(m => m.email.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const fetchMyAttendance = async () => {
    setLoading(true);
    if (!currentUserId) return;
    
    const { data, error } = await supabase
      .from('coach_attendance')
      .select('*, coaches!inner(name, user_id)')
      .eq('team_id', teamId)
      .eq('coaches.user_id', currentUserId)
      .order('work_date', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      setAttendance(data);
    }
    setLoading(false);
  };

  const fetchAllAttendance = async (month, cId) => {
    setLoading(true);
    const startDate = `${month}-01`;
    const [year, m] = month.split('-');
    const nextMonth = m === '12' ? '01' : String(Number(m) + 1).padStart(2, '0');
    const nextYear = m === '12' ? String(Number(year) + 1) : year;
    const endDate = `${nextYear}-${nextMonth}-01`;

    let query = supabase
      .from('coach_attendance')
      .select('*, coaches(name)')
      .eq('team_id', teamId)
      .gte('work_date', startDate)
      .lt('work_date', endDate)
      .order('work_date', { ascending: false });
    
    if (cId !== 'all') {
      query = query.eq('coach_id', cId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setAttendance(data);
    }
    setLoading(false);
  };

  // --- Handlers ---
  const handleAddCoach = async (e) => {
    e.preventDefault();
    if (!newCoach.name.trim()) {
      Swal.fire({ title: '錯誤', text: '請填寫教練顯示名稱', icon: 'error', background: '#1a1a2e', color: '#fff' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('coaches').insert({
      team_id: teamId,
      user_id: selectedUserId || null,
      name: newCoach.name,
      default_hourly_rate: newCoach.default_hourly_rate
    });

    if (error) {
      Swal.fire({ title: '錯誤', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      setNewCoach({ name: '', default_hourly_rate: 0 });
      setSelectedEmail('');
      setSelectedUserId(null);
      setShowAddCoach(false);
      fetchCoaches();
      Swal.fire({ title: '新增成功', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, background: '#1a1a2e', color: '#fff' });
    }
    setLoading(false);
  };

  const toggleCoachActive = async (id, currentStatus) => {
    await supabase.from('coaches').update({ is_active: !currentStatus }).eq('id', id);
    fetchCoaches();
  };

  const deleteCoach = async (id) => {
    const result = await Swal.fire({
      title: '確定要刪除此教練？',
      text: "⚠️ 警告：刪除教練將會「永久清除」該教練過去所有的簽到與薪資紀錄！如果該教練曾經有打卡紀錄，強烈建議您使用右上角的「已離職」按鈕即可。確定要永久刪除嗎？",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff6b6b',
      cancelButtonColor: '#555',
      confirmButtonText: '是的，永久刪除',
      cancelButtonText: '取消',
      background: '#1a1a2e',
      color: '#fff'
    });

    if (result.isConfirmed) {
      const { error } = await supabase.from('coaches').delete().eq('id', id);
      if (error) {
        Swal.fire({ title: '刪除失敗', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
      } else {
        Swal.fire({ title: '已刪除', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, background: '#1a1a2e', color: '#fff' });
        fetchCoaches();
      }
    }
  };

  const updateCoachRate = async (id, newRate) => {
    await supabase.from('coaches').update({ default_hourly_rate: newRate }).eq('id', id);
    fetchCoaches();
    Swal.fire({ title: '已更新時薪', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, background: '#1a1a2e', color: '#fff' });
  };

  const updateCoachName = async (id, newName) => {
    if (!newName.trim()) return;
    await supabase.from('coaches').update({ name: newName.trim() }).eq('id', id);
    fetchCoaches();
    Swal.fire({ title: '已更新教練名稱', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, background: '#1a1a2e', color: '#fff' });
  };

  const handleAddAttendance = async (e) => {
    e.preventDefault();
    if (!newAttendance.coach_id) return;

    setLoading(true);

    const { error } = await supabase.from('coach_attendance').insert([{
      team_id: teamId,
      coach_id: newAttendance.coach_id,
      work_date: newAttendance.work_date,
      work_time: newAttendance.work_time,
      hours_worked: 1, // 預設給1，實際時數後續由系統依照兩次打卡計算
      hourly_rate: 0,
      total_pay: 0
    }]);

    if (error) {
      Swal.fire({ title: '錯誤', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      if (activeTab === 'attendance') fetchMyAttendance();
      Swal.fire({ title: '打卡成功', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, background: '#1a1a2e', color: '#fff' });
    }
    setLoading(false);
  };

  const deleteAttendance = async (id) => {
    const result = await Swal.fire({
      title: '確定刪除？',
      text: "刪除後無法恢復此打卡紀錄",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff6b6b',
      cancelButtonColor: '#555',
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      background: '#1a1a2e',
      color: '#fff'
    });

    if (result.isConfirmed) {
      await supabase.from('coach_attendance').delete().eq('id', id);
      if (activeTab === 'attendance') fetchMyAttendance();
      else fetchAllAttendance(searchMonth, searchCoachId);
    }
  };

  return (
    <div className="coach-payroll-container">
      {!hideSubTabs && (
        <div className="scrollable-tabs">
        {!isRegularCoach && (
          <>
            <button 
              onClick={() => setActiveTab('roster')} 
              style={{ 
                padding: '8px 16px', 
                background: activeTab === 'roster' ? 'var(--primary-color)' : 'transparent', 
                border: 'none', 
                borderRadius: '6px',
                color: activeTab === 'roster' ? '#fff' : '#aaa',
                cursor: 'pointer',
                fontWeight: 'bold',
                flexShrink: 0
              }}
            >
              👨‍🏫 教練名冊
            </button>
            <button 
              onClick={() => setActiveTab('attendance_search')} 
              style={{ 
                padding: '8px 16px', 
                background: activeTab === 'attendance_search' ? 'var(--primary-color)' : 'transparent', 
                border: 'none', 
                borderRadius: '6px',
                color: activeTab === 'attendance_search' ? '#fff' : '#aaa',
                cursor: 'pointer',
                fontWeight: 'bold',
                flexShrink: 0
              }}
            >
              📅 簽到紀錄查詢
            </button>
          </>
        )}
      </div>
      )}

      {activeTab === 'attendance' && (
        <div>
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: 'var(--primary-color)' }}>新增簽到紀錄</h3>
            {coaches.filter(c => c.is_active && c.user_id === currentUserId).length === 0 ? (
              <p style={{ color: '#ff6b6b' }}>您目前不是此球隊的有效教練，無法打卡。</p>
            ) : (
              <form className="flex-mobile-column" onSubmit={handleAddAttendance} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>日期</label>
                  <input type="date" required value={newAttendance.work_date} onChange={e => setNewAttendance({...newAttendance, work_date: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>打卡時間</label>
                  <input type="time" required value={newAttendance.work_time} onChange={e => setNewAttendance({...newAttendance, work_time: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>教練</label>
                  <select 
                    required 
                    value={newAttendance.coach_id} 
                    onChange={e => {
                      setNewAttendance({...newAttendance, coach_id: e.target.value});
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                  >
                    {coaches.filter(c => c.is_active && c.user_id === currentUserId).map(c => (
                      <option key={c.id} value={c.id} style={{ color: 'black' }}>{c.name} (您)</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ flexBasis: '100%', marginTop: '10px' }}>
                  <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 20px', height: '48px', fontSize: '1.1rem', fontWeight: 'bold' }} disabled={loading}>
                    儲存簽到
                  </button>
                </div>
              </form>
            )}
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>您的歷史簽到</h3>
            {loading ? <div style={{ color: '#aaa', textAlign: 'center' }}>載入中...</div> : (
              <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {attendance.length === 0 && <div style={{ color: '#888', gridColumn: '1/-1' }}>尚無打卡紀錄</div>}
                {attendance.map(record => (
                  <div key={record.id} className="glass-panel" style={{ padding: '20px', position: 'relative' }}>
                    <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px' }}>
                      {record.work_date} {record.work_time && <span style={{ color: 'var(--primary-color)' }}>({record.work_time})</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>🕒 打卡紀錄</div>
                    </div>
                    <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <button onClick={() => deleteAttendance(record.id)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}>🗑️</button>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'attendance_search' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>簽到紀錄查詢 (管理員專用)</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input 
                type="month" 
                value={searchMonth} 
                onChange={e => setSearchMonth(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              />
              <select 
                value={searchCoachId} 
                onChange={e => setSearchCoachId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              >
                <option value="all" style={{ color: 'black' }}>所有教練</option>
                {coaches.map(c => (
                  <option key={c.id} value={c.id} style={{ color: 'black' }}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? <div style={{ color: '#aaa', textAlign: 'center' }}>載入中...</div> : (
            <>
              {summaryByCoach.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid var(--primary-color)' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary-color)' }}>📊 {searchMonth} 教練統計</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                    {summaryByCoach.map(s => (
                      <div key={s.name} style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 15px', borderRadius: '8px', minWidth: '150px' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{s.name}</div>
                        <div style={{ fontSize: '0.9rem', color: '#aaa' }}>打卡次數: <span style={{ color: '#fff' }}>{s.records} 次</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {attendance.length === 0 && <div style={{ color: '#888', gridColumn: '1/-1' }}>此區間無打卡紀錄</div>}
              {attendance.map(record => (
                <div key={record.id} className="glass-panel" style={{ padding: '15px', borderLeft: record.is_paid ? '4px solid #aaa' : '4px solid #fbbc05' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{record.coaches?.name}</div>
                    <div style={{ color: '#aaa', fontSize: '0.9rem' }}>
                      {record.work_date} {record.work_time && <span style={{ color: 'var(--primary-color)' }}>({record.work_time})</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>🕒 打卡紀錄</div>
                    </div>
                  </div>
                  <button onClick={() => deleteAttendance(record.id)} style={{ width: '100%', marginTop: '15px', padding: '8px', background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '6px' }}>
                    刪除紀錄
                  </button>
                </div>
              ))}
            </div>
          </>
          )}
        </div>
      )}

      {activeTab === 'roster' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>教練名冊管理</h3>
            <button className="btn-primary" onClick={() => setShowAddCoach(!showAddCoach)} style={{ width: 'auto' }}>
              {showAddCoach ? '取消' : '+ 新增教練'}
            </button>
          </div>

          {showAddCoach && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ marginTop: 0 }}>輸入系統成員信箱來綁定教練</h4>
              <form onSubmit={handleAddCoach} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>成員信箱搜尋 (選填，綁定帳號用)</label>
                  <input 
                    type="email" 
                    value={selectedEmail} 
                    onChange={handleEmailChange} 
                    placeholder="輸入信箱自動搜尋同球隊成員..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} 
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '70px', left: 0, right: 0, background: 'rgba(30,30,40,0.95)', border: '1px solid var(--glass-border)', borderRadius: '8px', zIndex: 10, maxHeight: '150px', overflowY: 'auto' }}>
                      {suggestions.map((m, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setSelectedEmail(m.email);
                            setSelectedUserId(m.user_id);
                            setShowSuggestions(false);
                            if (!newCoach.name) setNewCoach({ ...newCoach, name: m.email.split('@')[0] });
                          }}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: idx < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {m.email} {m.role === 'admin' && <span style={{fontSize: '0.8rem', color: 'var(--primary-color)'}}>(管理員)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>教練顯示名稱</label>
                  <input type="text" required value={newCoach.name} onChange={e => setNewCoach({...newCoach, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', height: '42px' }} disabled={loading}>
                  儲存教練
                </button>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {coaches.map(coach => (
              <div key={coach.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                <button 
                  onClick={() => toggleCoachActive(coach.id, coach.is_active)}
                  style={{ position: 'absolute', top: '15px', right: '15px', background: coach.is_active ? 'rgba(74,222,128,0.2)' : 'rgba(255,107,107,0.2)', color: coach.is_active ? '#4ade80' : '#ff6b6b', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  {coach.is_active ? '在職中' : '已離職'}
                </button>
                <input 
                  type="text"
                  defaultValue={coach.name}
                  onBlur={(e) => {
                    if (e.target.value !== coach.name) {
                      updateCoachName(coach.id, e.target.value);
                    }
                  }}
                  style={{ 
                    margin: '0 0 10px 0', 
                    color: coach.is_active ? '#fff' : '#666',
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    padding: '4px',
                    width: 'calc(100% - 70px)'
                  }} 
                />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: coach.is_active ? 1 : 0.5 }}>
                  
                  <button 
                    onClick={() => deleteCoach(coach.id)}
                    style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(255,107,107,0.5)', color: '#ff6b6b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    title="永久刪除教練"
                  >
                    🗑️ 刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachPayroll;

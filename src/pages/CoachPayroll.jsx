import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const CoachPayroll = ({ teamId }) => {
  const { userRoles } = useAuth();
  
  const currentRole = useMemo(() => {
    if (!userRoles) return null;
    const roleObj = userRoles.find(r => r.team_id === teamId);
    if (!roleObj) return 'superadmin'; // superadmin has no specific team_id row, or it might be admin
    return roleObj.role;
  }, [userRoles, teamId]);

  const isRegularCoach = currentRole === 'coach';

  const [activeTab, setActiveTab] = useState('attendance');
  const [coaches, setCoaches] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Roster state
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoach, setNewCoach] = useState({ name: '', default_hourly_rate: 500 });

  // Attendance state
  const [newAttendance, setNewAttendance] = useState({
    work_date: new Date().toISOString().split('T')[0],
    coach_id: '',
    hours_worked: 1,
    hourly_rate: 0
  });

  // Payroll state
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    if (teamId) {
      fetchCoaches();
    }
  }, [teamId]);

  useEffect(() => {
    if (teamId && activeTab === 'attendance') {
      fetchAttendance();
    } else if (teamId && activeTab === 'payroll') {
      fetchAttendanceForMonth(selectedMonth);
    }
  }, [teamId, activeTab, selectedMonth]);

  const fetchCoaches = async () => {
    const { data, error } = await supabase
      .from('coaches')
      .select('*')
      .eq('team_id', teamId)
      .order('is_active', { ascending: false })
      .order('name');
    
    if (!error && data) {
      setCoaches(data);
      if (data.length > 0 && !newAttendance.coach_id) {
        setNewAttendance(prev => ({ 
          ...prev, 
          coach_id: data[0].id, 
          hourly_rate: data[0].default_hourly_rate 
        }));
      }
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('coach_attendance')
      .select('*, coaches(name)')
      .eq('team_id', teamId)
      .order('work_date', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      setAttendance(data);
    }
    setLoading(false);
  };

  const fetchAttendanceForMonth = async (month) => {
    setLoading(true);
    const startDate = `${month}-01`;
    const [year, m] = month.split('-');
    const nextMonth = m === '12' ? '01' : String(Number(m) + 1).padStart(2, '0');
    const nextYear = m === '12' ? String(Number(year) + 1) : year;
    const endDate = `${nextYear}-${nextMonth}-01`;

    const { data, error } = await supabase
      .from('coach_attendance')
      .select('*, coaches(name)')
      .eq('team_id', teamId)
      .gte('work_date', startDate)
      .lt('work_date', endDate)
      .order('work_date', { ascending: false });
    
    if (!error && data) {
      setAttendance(data);
    }
    setLoading(false);
  };

  // --- Handlers for Coaches ---
  const handleAddCoach = async (e) => {
    e.preventDefault();
    if (!newCoach.name.trim()) return;

    setLoading(true);
    const { error } = await supabase.from('coaches').insert([{
      team_id: teamId,
      name: newCoach.name,
      default_hourly_rate: newCoach.default_hourly_rate
    }]);

    if (error) {
      Swal.fire({ title: '錯誤', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      setNewCoach({ name: '', default_hourly_rate: 500 });
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

  const updateCoachRate = async (id, newRate) => {
    await supabase.from('coaches').update({ default_hourly_rate: newRate }).eq('id', id);
    fetchCoaches();
    Swal.fire({ title: '已更新時薪', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, background: '#1a1a2e', color: '#fff' });
  };

  // --- Handlers for Attendance ---
  const handleAddAttendance = async (e) => {
    e.preventDefault();
    if (!newAttendance.coach_id || newAttendance.hours_worked <= 0) return;

    setLoading(true);
    const total_pay = newAttendance.hours_worked * newAttendance.hourly_rate;
    const { error } = await supabase.from('coach_attendance').insert([{
      team_id: teamId,
      coach_id: newAttendance.coach_id,
      work_date: newAttendance.work_date,
      hours_worked: newAttendance.hours_worked,
      hourly_rate: newAttendance.hourly_rate,
      total_pay: total_pay
    }]);

    if (error) {
      Swal.fire({ title: '錯誤', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      fetchAttendance();
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
      if (activeTab === 'attendance') fetchAttendance();
      else fetchAttendanceForMonth(selectedMonth);
    }
  };

  // --- Handlers for Payroll ---
  const handlePayCoach = async (coachId, coachName, amount, recordIds) => {
    const result = await Swal.fire({
      title: '發放薪資確認',
      html: `確定要結算 <b>${coachName}</b> 的薪資共 <b>$${amount}</b> 嗎？<br/><br/>這將標記為已發放，並自動記錄到「球隊記帳本」支出中。`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4ade80',
      cancelButtonColor: '#555',
      confirmButtonText: '確定發放',
      cancelButtonText: '取消',
      background: '#1a1a2e',
      color: '#fff'
    });

    if (result.isConfirmed) {
      setLoading(true);
      // 1. 標記為已發放
      const { error: updateError } = await supabase
        .from('coach_attendance')
        .update({ is_paid: true })
        .in('id', recordIds);
      
      if (updateError) {
        Swal.fire({ title: '錯誤', text: updateError.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
        setLoading(false);
        return;
      }

      // 2. 新增一筆支出到 team_transactions
      const description = `${selectedMonth} 月份 ${coachName} 教練薪資結算`;
      await supabase.from('team_transactions').insert([{
        team_id: teamId,
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'expense',
        category: '教練薪資',
        amount: amount,
        description: description,
        is_settled: true // 薪資通常直接發放結清
      }]);

      fetchAttendanceForMonth(selectedMonth);
      Swal.fire({ title: '發放成功！', icon: 'success', background: '#1a1a2e', color: '#fff' });
      setLoading(false);
    }
  };

  // 分組計算薪水 (Payroll Tab)
  const payrollSummary = attendance.reduce((acc, curr) => {
    if (!acc[curr.coach_id]) {
      acc[curr.coach_id] = {
        name: curr.coaches?.name || '未知教練',
        totalHours: 0,
        totalPay: 0,
        pendingPay: 0,
        pendingRecords: []
      };
    }
    acc[curr.coach_id].totalHours += Number(curr.hours_worked);
    acc[curr.coach_id].totalPay += Number(curr.total_pay);
    
    if (!curr.is_paid) {
      acc[curr.coach_id].pendingPay += Number(curr.total_pay);
      acc[curr.coach_id].pendingRecords.push(curr.id);
    }
    return acc;
  }, {});

  return (
    <div className="coach-payroll-container">
      <div className="tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button className={activeTab === 'attendance' ? 'btn-primary' : ''} onClick={() => setActiveTab('attendance')} style={{ padding: '8px 16px', background: activeTab === 'attendance' ? '' : 'transparent', border: activeTab === 'attendance' ? 'none' : '1px solid #555', color: activeTab === 'attendance' ? '#fff' : '#aaa' }}>📝 簽到登記</button>
        {!isRegularCoach && (
          <>
            <button className={activeTab === 'payroll' ? 'btn-primary' : ''} onClick={() => setActiveTab('payroll')} style={{ padding: '8px 16px', background: activeTab === 'payroll' ? '' : 'transparent', border: activeTab === 'payroll' ? 'none' : '1px solid #555', color: activeTab === 'payroll' ? '#fff' : '#aaa' }}>💰 月結發薪</button>
            <button className={activeTab === 'roster' ? 'btn-primary' : ''} onClick={() => setActiveTab('roster')} style={{ padding: '8px 16px', background: activeTab === 'roster' ? '' : 'transparent', border: activeTab === 'roster' ? 'none' : '1px solid #555', color: activeTab === 'roster' ? '#fff' : '#aaa' }}>👨‍🏫 教練名冊</button>
          </>
        )}
      </div>

      {activeTab === 'attendance' && (
        <div>
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: 'var(--primary-color)' }}>新增簽到紀錄</h3>
            {coaches.filter(c => c.is_active).length === 0 ? (
              <p style={{ color: '#ff6b6b' }}>請先至「教練名冊」新增並啟用教練。</p>
            ) : (
              <form className="flex-mobile-column" onSubmit={handleAddAttendance} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>日期</label>
                  <input type="date" required value={newAttendance.work_date} onChange={e => setNewAttendance({...newAttendance, work_date: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>教練</label>
                  <select 
                    required 
                    value={newAttendance.coach_id} 
                    onChange={e => {
                      const coach = coaches.find(c => c.id === e.target.value);
                      setNewAttendance({...newAttendance, coach_id: e.target.value, hourly_rate: coach?.default_hourly_rate || 0});
                    }}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
                  >
                    {coaches.filter(c => c.is_active).map(c => (
                      <option key={c.id} value={c.id} style={{ color: 'black' }}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '100px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>時數</label>
                  <input type="number" required min="0.5" step="0.5" value={newAttendance.hours_worked} onChange={e => setNewAttendance({...newAttendance, hours_worked: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flex: 1, minWidth: '100px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>當次時薪 ($)</label>
                  <input type="number" required min="0" value={newAttendance.hourly_rate} onChange={e => setNewAttendance({...newAttendance, hourly_rate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flexBasis: '100%', marginTop: '10px' }}>
                  <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 20px', height: '48px', fontSize: '1.1rem', fontWeight: 'bold' }} disabled={loading}>
                    儲存簽到 ($ {newAttendance.hours_worked * newAttendance.hourly_rate || 0})
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginTop: 0 }}>近期簽到紀錄 (最近50筆)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>日期</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>教練</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>時數</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>時薪</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>總薪資</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>狀態</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(record => (
                    <tr key={record.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>{record.work_date}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{record.coaches?.name}</td>
                      <td style={{ padding: '12px' }}>{record.hours_worked} hr</td>
                      <td style={{ padding: '12px', color: '#ccc' }}>${record.hourly_rate}</td>
                      <td style={{ padding: '12px', color: '#4ade80' }}>${record.total_pay}</td>
                      <td style={{ padding: '12px' }}>
                        {record.is_paid ? <span style={{ color: '#aaa', fontSize: '0.8rem', border: '1px solid #555', padding: '2px 6px', borderRadius: '4px' }}>已結清</span> : <span style={{ color: '#fbbc05', fontSize: '0.8rem', border: '1px solid rgba(251,188,5,0.3)', background: 'rgba(251,188,5,0.1)', padding: '2px 6px', borderRadius: '4px' }}>未發放</span>}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {!record.is_paid && (
                          <button onClick={() => deleteAttendance(record.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1.2rem' }} title="刪除">🗑️</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (
                    <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>尚無簽到紀錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>月結發薪總覽</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#aaa' }}>選擇月份：</span>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {Object.keys(payrollSummary).length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#aaa' }}>
                本月份尚無任何簽到紀錄。
              </div>
            ) : (
              Object.values(payrollSummary).map((summary, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between' }}>
                    {summary.name}
                    {summary.pendingPay > 0 && <span style={{ fontSize: '0.8rem', background: '#fbbc05', color: '#000', padding: '2px 8px', borderRadius: '12px' }}>待發放</span>}
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#ccc' }}>
                    <span>本月總時數</span>
                    <span>{summary.totalHours} hr</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', color: '#ccc' }}>
                    <span>本月總薪水</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>${summary.totalPay}</span>
                  </div>
                  
                  {summary.pendingPay > 0 ? (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <span style={{ color: '#fbbc05' }}>未發放金額</span>
                        <span style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>${summary.pendingPay}</span>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ width: '100%', padding: '10px' }}
                        onClick={() => handlePayCoach(Object.keys(payrollSummary)[idx], summary.name, summary.pendingPay, summary.pendingRecords)}
                      >
                        ✅ 結算發放並記帳
                      </button>
                    </div>
                  ) : (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', textAlign: 'center', color: '#4ade80' }}>
                      本月薪資已全部結清
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'roster' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>教練名冊</h3>
            <button className="btn-primary" onClick={() => setShowAddCoach(!showAddCoach)} style={{ background: showAddCoach ? 'transparent' : 'var(--primary-color)', border: showAddCoach ? '1px solid #ccc' : 'none' }}>
              {showAddCoach ? '取消' : '+ 新增教練'}
            </button>
          </div>

          {showAddCoach && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <form onSubmit={handleAddCoach} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>教練姓名</label>
                  <input type="text" required value={newCoach.name} onChange={e => setNewCoach({...newCoach, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>預設時薪 ($)</label>
                  <input type="number" required min="0" value={newCoach.default_hourly_rate} onChange={e => setNewCoach({...newCoach, default_hourly_rate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
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
                <h3 style={{ margin: '0 0 10px 0', color: coach.is_active ? '#fff' : '#666' }}>{coach.name}</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: coach.is_active ? 1 : 0.5 }}>
                  <span style={{ fontSize: '0.9rem', color: '#aaa' }}>預設時薪: $</span>
                  <input 
                    type="number" 
                    defaultValue={coach.default_hourly_rate}
                    onBlur={(e) => {
                      if (e.target.value !== String(coach.default_hourly_rate)) {
                        updateCoachRate(coach.id, e.target.value);
                      }
                    }}
                    style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: 'white' }}
                  />
                </div>
              </div>
            ))}
            {coaches.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#aaa' }}>
                目前沒有任何教練資料。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachPayroll;

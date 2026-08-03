import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const CoachPayroll = ({ teamId, forcedTab, hideSubTabs }) => {
  const { userRoles } = useAuth();
  
  const currentRole = useMemo(() => {
    if (!userRoles) return null;
    const roleObj = userRoles.find(r => r.team_id === teamId);
    if (!roleObj) return 'superadmin'; // superadmin has no specific team_id row, or it might be admin
    return roleObj.role;
  }, [userRoles, teamId]);

  const isRegularCoach = currentRole === 'coach';

  const [activeTab, setActiveTab] = useState(forcedTab || 'attendance');
  const [coaches, setCoaches] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  // Roster state
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoach, setNewCoach] = useState({ name: '', default_hourly_rate: 500 });
  const [teamMembers, setTeamMembers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

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
      fetchTeamMembers();
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

  const fetchTeamMembers = async () => {
    const { data } = await supabase.rpc('get_team_members', { target_team_id: teamId });
    if (data) {
      setTeamMembers(data);
    }
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
    if (!newCoach.name.trim() || !selectedUserId) {
      Swal.fire({ title: '?航炊', text: '隢?敺?桅??雿????∩蒂憛怠神憿舐內?迂', icon: 'error', background: '#1a1a2e', color: '#fff' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.rpc('assign_coach_by_team_member', {
      target_team_id: teamId,
      target_user_id: selectedUserId,
      coach_name: newCoach.name,
      hourly_rate: newCoach.default_hourly_rate
    });

    if (error) {
      Swal.fire({ title: '?航炊', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      setNewCoach({ name: '', default_hourly_rate: 500 });
      setSelectedEmail('');
      setSelectedUserId(null);
      setShowAddCoach(false);
      fetchCoaches();
      Swal.fire({ title: '?啣???', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, background: '#1a1a2e', color: '#fff' });
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
    Swal.fire({ title: '撌脫?唳???, icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, background: '#1a1a2e', color: '#fff' });
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
      Swal.fire({ title: '?航炊', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      fetchAttendance();
      Swal.fire({ title: '???', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, background: '#1a1a2e', color: '#fff' });
    }
    setLoading(false);
  };

  const deleteAttendance = async (id) => {
    const result = await Swal.fire({
      title: '蝣箏??芷嚗?,
      text: "?芷敺瘜敺拇迨?蝝??,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff6b6b',
      cancelButtonColor: '#555',
      confirmButtonText: '蝣箏??芷',
      cancelButtonText: '??',
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
      title: '?潭?芾?蝣箄?',
      html: `蝣箏?閬?蝞?<b>${coachName}</b> ?鞈 <b>$${amount}</b> ??<br/><br/>??璅??箏歇?潭嚗蒂?芸?閮??啜???撣單??箔葉?,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4ade80',
      cancelButtonColor: '#555',
      confirmButtonText: '蝣箏??潭',
      cancelButtonText: '??',
      background: '#1a1a2e',
      color: '#fff'
    });

    if (result.isConfirmed) {
      setLoading(true);
      // 1. 璅??箏歇?潭
      const { error: updateError } = await supabase
        .from('coach_attendance')
        .update({ is_paid: true })
        .in('id', recordIds);
      
      if (updateError) {
        Swal.fire({ title: '?航炊', text: updateError.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
        setLoading(false);
        return;
      }

      // 2. ?啣?銝蝑?箏 team_transactions
      const description = `${selectedMonth} ?遢 ${coachName} ?毀?芾?蝯?`;
      await supabase.from('team_transactions').insert([{
        team_id: teamId,
        transaction_date: new Date().toISOString().split('T')[0],
        type: 'expense',
        category: '?毀?芾?',
        amount: amount,
        description: description,
        is_settled: true // ?芾??虜?湔?潭蝯?
      }]);

      fetchAttendanceForMonth(selectedMonth);
      Swal.fire({ title: '?潭??嚗?, icon: 'success', background: '#1a1a2e', color: '#fff' });
      setLoading(false);
    }
  };

  // ??閮??芣偌 (Payroll Tab)
  const payrollSummary = attendance.reduce((acc, curr) => {
    if (!acc[curr.coach_id]) {
      acc[curr.coach_id] = {
        name: curr.coaches?.name || '?芰?毀',
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
      {!hideSubTabs && (
        <div className="scrollable-tabs">
        {!isRegularCoach && (
          <>
            <button 
              onClick={() => setActiveTab('payroll')} 
              style={{ 
                padding: '8px 16px', 
                background: activeTab === 'payroll' ? 'var(--primary-color)' : 'transparent', 
                border: 'none', 
                borderRadius: '6px',
                color: activeTab === 'payroll' ? '#fff' : '#aaa',
                cursor: 'pointer',
                fontWeight: 'bold',
                flexShrink: 0
              }}
            >
              ? ???潸
            </button>
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
              ?????毀??
            </button>
          </>
        )}
      </div>
      )}

      {activeTab === 'attendance' && (
        <div>
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: 'var(--primary-color)' }}>?啣?蝪賢蝝??/h3>
            {coaches.filter(c => c.is_active).length === 0 ? (
              <p style={{ color: '#ff6b6b' }}>隢??喋?蝺游??憓蒂??毀??/p>
            ) : (
              <form className="flex-mobile-column" onSubmit={handleAddAttendance} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>?交?</label>
                  <input type="date" required value={newAttendance.work_date} onChange={e => setNewAttendance({...newAttendance, work_date: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>?毀</label>
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
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>?</label>
                  <input type="number" required min="0.5" step="0.5" value={newAttendance.hours_worked} onChange={e => setNewAttendance({...newAttendance, hours_worked: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flex: 1, minWidth: '100px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>?嗆活? ($)</label>
                  <input type="number" required min="0" value={newAttendance.hourly_rate} onChange={e => setNewAttendance({...newAttendance, hourly_rate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <div style={{ flexBasis: '100%', marginTop: '10px' }}>
                  <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 20px', height: '48px', fontSize: '1.1rem', fontWeight: 'bold' }} disabled={loading}>
                    ?脣?蝪賢 ($ {newAttendance.hours_worked * newAttendance.hourly_rate || 0})
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginTop: 0 }}>餈?蝪賢蝝??(?餈?0蝑?</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>?交?</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>?毀</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>?</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>?</th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>蝮質鞈?/th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>???/th>
                    <th style={{ padding: '12px', color: '#aaa', fontWeight: 'normal' }}>??</th>
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
                        {record.is_paid ? <span style={{ color: '#aaa', fontSize: '0.8rem', border: '1px solid #555', padding: '2px 6px', borderRadius: '4px' }}>撌脩?皜?/span> : <span style={{ color: '#fbbc05', fontSize: '0.8rem', border: '1px solid rgba(251,188,5,0.3)', background: 'rgba(251,188,5,0.1)', padding: '2px 6px', borderRadius: '4px' }}>?芰??/span>}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {!record.is_paid && (
                          <button onClick={() => deleteAttendance(record.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1.2rem' }} title="?芷">??儭?/button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (
                    <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>撠蝪賢蝝??/td></tr>
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
            <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>???潸蝮質汗</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#aaa' }}>?豢??遢嚗?/span>
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
                ?祆?隞賢??∩遙雿偷?啁???              </div>
            ) : (
              Object.values(payrollSummary).map((summary, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between' }}>
                    {summary.name}
                    {summary.pendingPay > 0 && <span style={{ fontSize: '0.8rem', background: '#fbbc05', color: '#000', padding: '2px 8px', borderRadius: '12px' }}>敺??/span>}
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#ccc' }}>
                    <span>?祆?蝮賣???/span>
                    <span>{summary.totalHours} hr</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', color: '#ccc' }}>
                    <span>?祆?蝮質瘞?/span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>${summary.totalPay}</span>
                  </div>
                  
                  {summary.pendingPay > 0 ? (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <span style={{ color: '#fbbc05' }}>?芰?暸?憿?/span>
                        <span style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>${summary.pendingPay}</span>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ width: '100%', padding: '10px' }}
                        onClick={() => handlePayCoach(Object.keys(payrollSummary)[idx], summary.name, summary.pendingPay, summary.pendingRecords)}
                      >
                        ??蝯??潭銝西?撣?                      </button>
                    </div>
                  ) : (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', textAlign: 'center', color: '#4ade80' }}>
                      ?祆??芾?撌脣?函?皜?                    </div>
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
            <h3 style={{ margin: 0 }}>?毀??</h3>
            <button className="btn-primary" onClick={() => setShowAddCoach(!showAddCoach)} style={{ background: showAddCoach ? 'transparent' : 'var(--primary-color)', border: showAddCoach ? '1px solid #ccc' : 'none' }}>
              {showAddCoach ? '??' : '+ ?啣??毀'}
            </button>
          </div>

          {showAddCoach && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--primary-color)' }}>敺????⊥??桐葉??毀</h4>
              <form onSubmit={handleAddCoach} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', flexWrap: 'wrap', flexDirection: 'column' }}>
                <div style={{ width: '100%', position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>????? (靽∠拳)</label>
                  <input 
                    type="email" 
                    required 
                    value={selectedEmail} 
                    onChange={handleEmailChange} 
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="頛詨?靽∠拳..."
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
                          {m.email} {m.role === 'admin' && <span style={{fontSize: '0.8rem', color: 'var(--primary-color)'}}>(蝞∠???</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '15px', width: '100%', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>?毀憿舐內?迂</label>
                    <input type="text" required value={newCoach.name} onChange={e => setNewCoach({...newCoach, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                  </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>?身? ($)</label>
                  <input type="number" required min="0" value={newCoach.default_hourly_rate} onChange={e => setNewCoach({...newCoach, default_hourly_rate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', height: '42px' }} disabled={loading}>
                  ?脣??毀
                </button>
                </div>
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
                  {coach.is_active ? '?刻銝? : '撌脤??}
                </button>
                <h3 style={{ margin: '0 0 10px 0', color: coach.is_active ? '#fff' : '#666' }}>{coach.name}</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: coach.is_active ? 1 : 0.5 }}>
                  <span style={{ fontSize: '0.9rem', color: '#aaa' }}>?身?: $</span>
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
                ?桀?瘝?隞颱??毀鞈???              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachPayroll;

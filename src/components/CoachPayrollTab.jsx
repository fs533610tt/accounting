import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import Swal from 'sweetalert2';

const CoachPayrollTab = ({ teamId }) => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    if (teamId) {
      fetchAttendanceForMonth(selectedMonth);
    }
  }, [teamId, selectedMonth]);

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

  // 分組計算薪水
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
    <div>
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>月結發薪總覽</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#aaa', fontSize: '0.9rem' }}>選擇月份：</span>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>載入中...</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {Object.keys(payrollSummary).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#888' }}>
              本月份尚無任何簽到紀錄。
            </div>
          ) : (
            Object.values(payrollSummary).map((summary, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ marginTop: 0, marginBottom: '15px', color: '#fff', fontSize: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                  {summary.name}
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#ccc' }}>
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
      )}
    </div>
  );
};

export default CoachPayrollTab;

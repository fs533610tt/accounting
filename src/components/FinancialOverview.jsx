import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabaseClient';

const FinancialOverview = ({ teamId }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      fetchTransactions();
    }
  }, [teamId, selectedMonth]);

  const fetchTransactions = async () => {
    setLoading(true);
    const startDate = `${selectedMonth}-01`;
    const [year, m] = selectedMonth.split('-');
    const nextMonth = m === '12' ? '01' : String(Number(m) + 1).padStart(2, '0');
    const nextYear = m === '12' ? String(Number(year) + 1) : year;
    const endDate = `${nextYear}-${nextMonth}-01`;

    const { data, error } = await supabase
      .from('team_transactions')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_settled', true)
      .gte('transaction_date', startDate)
      .lt('transaction_date', endDate)
      .order('transaction_date', { ascending: false });

    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let tuitionIncome = 0;
    let coachExpense = 0;
    let otherIncome = 0;
    let otherExpense = 0;

    transactions.forEach(tx => {
      const amount = Number(tx.amount);
      if (tx.type === 'income') {
        totalIncome += amount;
        if (tx.category === '學費' || tx.category === 'tuition') tuitionIncome += amount;
        else otherIncome += amount;
      } else {
        totalExpense += amount;
        if (tx.category === '教練薪資' || tx.category === 'payroll') coachExpense += amount;
        else otherExpense += amount;
      }
    });

    return {
      totalIncome, totalExpense, netProfit: totalIncome - totalExpense,
      tuitionIncome, coachExpense, otherIncome, otherExpense
    };
  }, [transactions]);

  return (
    <div>
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>📊 月結總損益</h3>
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
        <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          
          {/* 總結卡片 */}
          <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', borderTop: summary.netProfit >= 0 ? '4px solid #4ade80' : '4px solid #ff6b6b' }}>
            <h4 style={{ color: '#aaa', margin: '0 0 10px 0', fontSize: '1.2rem' }}>本月淨利 (Net Profit)</h4>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: summary.netProfit >= 0 ? '#4ade80' : '#ff6b6b' }}>
              ${summary.netProfit.toLocaleString()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '20px' }}>
              <div>
                <div style={{ color: '#aaa', fontSize: '0.9rem' }}>總收入</div>
                <div style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>+${summary.totalIncome.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: '#aaa', fontSize: '0.9rem' }}>總支出</div>
                <div style={{ color: '#ff6b6b', fontSize: '1.2rem', fontWeight: 'bold' }}>-${summary.totalExpense.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* 收入明細 */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ color: '#4ade80', margin: '0 0 20px 0', borderBottom: '1px solid rgba(74,222,128,0.2)', paddingBottom: '10px' }}>💰 收入結構</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ color: '#ccc' }}>學費收入</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>${summary.tuitionIncome.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ color: '#ccc' }}>雜支收入</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>${summary.otherIncome.toLocaleString()}</span>
            </div>
          </div>

          {/* 支出明細 */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ color: '#ff6b6b', margin: '0 0 20px 0', borderBottom: '1px solid rgba(255,107,107,0.2)', paddingBottom: '10px' }}>💸 支出結構</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ color: '#ccc' }}>教練薪資</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>${summary.coachExpense.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ color: '#ccc' }}>雜支支出</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>${summary.otherExpense.toLocaleString()}</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default FinancialOverview;

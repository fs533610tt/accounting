import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import Swal from 'sweetalert2';

const TeamLedger = ({ teamId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTx, setNewTx] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: '器材',
    amount: '',
    description: ''
  });

  useEffect(() => {
    fetchTransactions();
  }, [teamId]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('team_transactions')
      .select('*')
      .eq('team_id', teamId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newTx.amount || newTx.amount <= 0) {
      Swal.fire({ title: '錯誤', text: '請輸入有效的金額', icon: 'error', background: '#1a1a2e', color: '#fff' });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('team_transactions')
      .insert([{
        team_id: teamId,
        transaction_date: newTx.transaction_date,
        type: newTx.type,
        category: newTx.category,
        amount: Number(newTx.amount),
        description: newTx.description
      }]);

    if (error) {
      Swal.fire({ title: '新增失敗', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      Swal.fire({ title: '成功', text: '已新增一筆紀錄！', icon: 'success', background: '#1a1a2e', color: '#fff', timer: 1500 });
      setShowAddForm(false);
      setNewTx({ ...newTx, amount: '', description: '' });
      fetchTransactions();
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: '確定要刪除這筆紀錄嗎？',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      background: '#1a1a2e',
      color: '#fff'
    });

    if (result.isConfirmed) {
      const { error } = await supabase
        .from('team_transactions')
        .delete()
        .eq('id', id);
        
      if (error) {
        Swal.fire({ title: '刪除失敗', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
      } else {
        fetchTransactions();
      }
    }
  };

  // 計算總結餘
  const totalBalance = transactions.reduce((acc, curr) => {
    return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
  }, 0);
  
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '150px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>目前總結餘</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: totalBalance >= 0 ? '#4ade80' : '#ff6b6b' }}>
            {totalBalance >= 0 ? '+' : ''}{totalBalance}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: '150px', background: 'rgba(74, 222, 128, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
          <div style={{ fontSize: '0.9rem', color: '#4ade80', marginBottom: '5px' }}>總收入</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>+{totalIncome}</div>
        </div>
        <div style={{ flex: 1, minWidth: '150px', background: 'rgba(255, 107, 107, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255, 107, 107, 0.2)' }}>
          <div style={{ fontSize: '0.9rem', color: '#ff6b6b', marginBottom: '5px' }}>總支出</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff6b6b' }}>-{totalExpense}</div>
        </div>
      </div>

      <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>交易明細</h3>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)} style={{ background: showAddForm ? 'transparent' : 'var(--primary-color)', border: showAddForm ? '1px solid #ccc' : 'none' }}>
          {showAddForm ? '取消新增' : '+ 記一筆'}
        </button>
      </div>

      {showAddForm && (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--glass-border)' }}>
          <form className="flex-mobile-column" onSubmit={handleAddSubmit} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>日期</label>
              <input type="date" required value={newTx.transaction_date} onChange={e => setNewTx({...newTx, transaction_date: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>類型</label>
              <select required value={newTx.type} onChange={e => setNewTx({...newTx, type: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                <option value="expense" style={{ color: 'black' }}>支出</option>
                <option value="income" style={{ color: 'black' }}>收入</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>分類</label>
              <input type="text" required placeholder="例如: 器材、比賽" value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>金額</label>
              <input type="number" required min="1" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ flex: 2, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>備註</label>
              <input type="text" placeholder="選填" value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', height: '42px', minWidth: '100px' }} disabled={loading}>
              儲存
            </button>
          </form>
        </div>
      )}

      {loading && !showAddForm ? (
        <p style={{ textAlign: 'center', color: '#888' }}>載入中...</p>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '12px' }}>
          <p style={{ color: '#aaa', marginBottom: '10px' }}>目前還沒有任何雜支紀錄。</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="mobile-card-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px' }}>日期</th>
                <th style={{ padding: '12px' }}>類型</th>
                <th style={{ padding: '12px' }}>分類</th>
                <th style={{ padding: '12px' }}>金額</th>
                <th style={{ padding: '12px' }}>備註</th>
                <th style={{ padding: '12px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td data-label="日期" style={{ padding: '12px', color: '#ccc' }}>{tx.transaction_date}</td>
                  <td data-label="類型" style={{ padding: '12px' }}>
                    {tx.type === 'income' ? (
                      <span style={{ background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>收入</span>
                    ) : (
                      <span style={{ background: 'rgba(255, 107, 107, 0.2)', color: '#ff6b6b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>支出</span>
                    )}
                  </td>
                  <td data-label="分類" style={{ padding: '12px' }}>{tx.category}</td>
                  <td data-label="金額" style={{ padding: '12px', fontWeight: 'bold', color: tx.type === 'income' ? '#4ade80' : '#ff6b6b' }}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount}
                  </td>
                  <td data-label="備註" style={{ padding: '12px', color: '#aaa', fontSize: '0.9rem' }}>{tx.description || '-'}</td>
                  <td data-label="操作" style={{ padding: '12px' }}>
                    <button onClick={() => handleDelete(tx.id)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TeamLedger;

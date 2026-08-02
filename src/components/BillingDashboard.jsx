import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import BillingDetail from './BillingDetail';

const BillingDashboard = ({ teamId }) => {
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCycle, setNewCycle] = useState({ name: '', default_amount: 1000 });
  const [selectedCycleId, setSelectedCycleId] = useState(null);

  useEffect(() => {
    fetchCycles();
  }, [teamId]);

  const fetchCycles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('billing_cycles')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching billing cycles:', error);
    } else {
      setCycles(data || []);
    }
    setLoading(false);
  };

  const handleCreateCycle = async (e) => {
    e.preventDefault();
    if (!newCycle.name.trim()) {
      alert('請輸入帳單名稱');
      return;
    }

    setLoading(true);

    // 1. 建立新的帳單週期
    const { data: cycleData, error: cycleError } = await supabase
      .from('billing_cycles')
      .insert([{ 
        team_id: teamId, 
        name: newCycle.name, 
        default_amount: newCycle.default_amount 
      }])
      .select();

    if (cycleError) {
      alert('建立帳單失敗：' + cycleError.message);
      setLoading(false);
      return;
    }

    const newCycleId = cycleData[0].id;

    // 2. 抓取目前所有「在隊」的球員
    const { data: activeStudents, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_active', true);

    if (studentError) {
      alert('抓取在隊球員失敗，請手動新增明細。');
    } else if (activeStudents && activeStudents.length > 0) {
      // 3. 幫每一個在隊球員產生一張空白繳費紀錄
      const recordsToInsert = activeStudents.map(student => ({
        cycle_id: newCycleId,
        student_id: student.id,
        amount_due: newCycle.default_amount,
        amount_paid: 0,
        status: 'pending'
      }));

      const { error: recordError } = await supabase
        .from('billing_records')
        .insert(recordsToInsert);

      if (recordError) {
        alert('自動產生明細失敗：' + recordError.message);
      }
    }

    alert('✅ 帳單建立成功！已自動發布給所有在隊球員。');
    setShowCreateForm(false);
    setNewCycle({ name: '', default_amount: 1000 });
    fetchCycles();
  };

  // 如果選擇了某個帳單週期，就切換到明細畫面
  if (selectedCycleId) {
    return (
      <BillingDetail 
        cycleId={selectedCycleId} 
        onBack={() => {
          setSelectedCycleId(null);
          fetchCycles(); // 返回時重新整理狀態
        }} 
      />
    );
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
        <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>歷史帳單總覽</h2>
        <button 
          className="btn-primary" 
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{ background: showCreateForm ? 'transparent' : 'var(--primary-color)', border: showCreateForm ? '1px solid #ccc' : 'none' }}
        >
          {showCreateForm ? '取消' : '💰 產生本月新帳單'}
        </button>
      </div>

      {showCreateForm && (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginTop: 0 }}>新增收費項目</h3>
          <form className="flex-mobile-column" onSubmit={handleCreateCycle} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>帳單名稱 (例如: 2026年8月月費)</label>
              <input 
                type="text" 
                required
                value={newCycle.name} 
                onChange={e => setNewCycle({...newCycle, name: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>公定預設金額 ($)</label>
              <input 
                type="number" 
                required
                min="0"
                value={newCycle.default_amount} 
                onChange={e => setNewCycle({...newCycle, default_amount: Number(e.target.value)})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', height: '42px' }} disabled={loading}>
              {loading ? '處理中...' : '確認產生帳單'}
            </button>
          </form>
          <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '10px' }}>
            提示：送出後，系統會自動幫目前名冊上「所有在隊」的球員產生對應的明細。如果有幹部折扣或請假退費，可以稍後進入明細個別修改。
          </p>
        </div>
      )}

      {loading && !showCreateForm ? (
        <p style={{ textAlign: 'center', color: '#888' }}>載入中...</p>
      ) : cycles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '12px' }}>
          <p style={{ color: '#aaa', marginBottom: '10px' }}>目前還沒有任何帳單紀錄。</p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>點擊上方的「產生本月新帳單」開始第一次收費吧！</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {cycles.map(cycle => (
            <div 
              key={cycle.id} 
              onClick={() => setSelectedCycleId(cycle.id)}
              style={{ 
                background: 'rgba(255,255,255,0.05)', 
                padding: '20px', 
                borderRadius: '12px', 
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s, background 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{cycle.name}</h3>
                {cycle.status === 'active' ? (
                  <span style={{ background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>收費中</span>
                ) : (
                  <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#aaa', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>已結算</span>
                )}
              </div>
              <div style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '5px' }}>
                公定金額：<strong style={{ color: 'white' }}>${cycle.default_amount}</strong>
              </div>
              <div style={{ color: '#888', fontSize: '0.8rem' }}>
                建立時間：{new Date(cycle.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BillingDashboard;

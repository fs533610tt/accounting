import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../config/supabaseClient';
import BillingDetail from './BillingDetail';
import TeamLedger from './TeamLedger';
import CoachPayrollTab from './CoachPayrollTab';
import FinancialOverview from './FinancialOverview';
import FeePresetsSettings from './FeePresetsSettings';

const getDefaultCycleName = (billingMonth) => {
  const [year, month] = billingMonth.split('-');
  return year && month ? `${year}年${Number(month)}月學費` : '';
};

const createInitialCycle = () => {
  const billingMonth = new Date().toISOString().slice(0, 7);
  return { name: getDefaultCycleName(billingMonth), default_amount: 0, billing_month: billingMonth };
};

const BillingDashboard = ({ teamId }) => {
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCycle, setNewCycle] = useState(createInitialCycle);
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [activeTab, setActiveTab] = useState('tuition');

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
    const cycleName = newCycle.name.trim() || getDefaultCycleName(newCycle.billing_month);
    if (!cycleName || !newCycle.billing_month) {
      Swal.fire({ title: '資料尚未完成', text: '請確認帳單月份與名稱。', icon: 'error' });
      return;
    }

    setLoading(true);

    // 1. 建立新的帳單週期
    const { data: cycleData, error: cycleError } = await supabase
      .from('billing_cycles')
      .insert([{ 
        team_id: teamId, 
        name: cycleName, 
        default_amount: 0,
        billing_month: newCycle.billing_month
      }])
      .select();

    if (cycleError) {
      Swal.fire({ title: '建立帳單失敗', text: cycleError.message, icon: 'error' });
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
      Swal.fire({ title: '注意', text: '抓取在隊球員失敗，請手動新增明細。', icon: 'warning' });
    } else if (activeStudents && activeStudents.length > 0) {
      // 3. 幫每一個在隊球員產生一張空白繳費紀錄
      const recordsToInsert = activeStudents.map(student => ({
        cycle_id: newCycleId,
        student_id: student.id,
        amount_due: 0,
        amount_paid: 0,
        status: 'pending'
      }));

      const { error: recordError } = await supabase
        .from('billing_records')
        .insert(recordsToInsert);

      if (recordError) {
        Swal.fire({ title: '自動產生明細失敗', text: recordError.message, icon: 'error' });
      }
    }

    await Swal.fire({ title: '建立成功', text: '✅ 帳單建立成功！所有在隊球員已列入未指定費用名單。', icon: 'success' });
    setShowCreateForm(false);
    setNewCycle(createInitialCycle());
    fetchCycles();
  };

  const handleDeleteCycle = async (e, id, name) => {
    e.stopPropagation(); // Prevent triggering the card click
    
    const result = await Swal.fire({
      title: '確定要刪除嗎？',
      text: `警告：確定要刪除「${name}」嗎？這會同時刪除該月份所有的收費紀錄，且無法復原！`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消'
    });
    
    if (!result.isConfirmed) {
      return;
    }
    
    setLoading(true);
    const { error } = await supabase
      .from('billing_cycles')
      .delete()
      .eq('id', id);

    if (error) {
      Swal.fire({ title: '刪除失敗', text: error.message, icon: 'error' });
    } else {
      await Swal.fire({ title: '刪除成功', icon: 'success' });
      fetchCycles();
    }
    setLoading(false);
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
      
      {/* 切換頁籤 */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
        <button 
          onClick={() => setActiveTab('tuition')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'tuition' ? 'var(--primary-color)' : '#aaa', 
            padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'tuition' ? '3px solid var(--primary-color)' : '3px solid transparent',
            flexShrink: 0
          }}
        >
          💰 學費帳單
        </button>
        <button 
          onClick={() => setActiveTab('ledger')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'ledger' ? '#fbbc05' : '#aaa', 
            padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'ledger' ? '3px solid #fbbc05' : '3px solid transparent',
            flexShrink: 0
          }}
        >
          📓 雜支收支簿
        </button>
        <button 
          onClick={() => setActiveTab('payroll')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'payroll' ? '#4ade80' : '#aaa', 
            padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'payroll' ? '3px solid #4ade80' : '3px solid transparent',
            flexShrink: 0
          }}
        >
          💸 教練發薪
        </button>
        <button 
          onClick={() => setActiveTab('overview')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'overview' ? '#a78bfa' : '#aaa', 
            padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'overview' ? '3px solid #a78bfa' : '3px solid transparent',
            flexShrink: 0
          }}
        >
          📊 月結總損益
        </button>
        <button 
          onClick={() => setActiveTab('presets')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'presets' ? '#f472b6' : '#aaa', 
            padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'presets' ? '3px solid #f472b6' : '3px solid transparent',
            flexShrink: 0
          }}
        >
          🏷️ 快速收費標籤
        </button>
      </div>

      {activeTab === 'ledger' ? (
        <TeamLedger teamId={teamId} />
      ) : activeTab === 'payroll' ? (
        <CoachPayrollTab teamId={teamId} />
      ) : activeTab === 'overview' ? (
        <FinancialOverview teamId={teamId} />
      ) : activeTab === 'presets' ? (
        <FeePresetsSettings teamId={teamId} />
      ) : (
        <>
          <div className="scrollable-container" style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px', overflowX: 'auto', paddingBottom: '10px', whiteSpace: 'nowrap' }}>
            <h2 style={{ margin: 0, color: 'var(--primary-color)', flex: '0 0 auto', marginRight: 'auto' }}>歷史帳單總覽</h2>
            <button 
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{ 
                background: showCreateForm ? 'rgba(255,255,255,0.05)' : 'rgba(96, 165, 250, 0.15)', 
                color: showCreateForm ? '#ccc' : '#60a5fa', 
                border: showCreateForm ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(96, 165, 250, 0.3)', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 'bold',
                flex: '0 0 auto'
              }}
            >
              {showCreateForm ? '取消' : '+ 建立本期帳單'}
            </button>
          </div>

          {showCreateForm && (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '6px' }}>建立本期學費帳單</h3>
          <p style={{ fontSize: '0.9rem', color: '#aaa', margin: '0 0 18px 0' }}>建立後會自動加入目前在隊球員，接著到明細頁勾選學生並加入費用。</p>
          <form className="flex-mobile-column" onSubmit={handleCreateCycle} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>收費月份</label>
              <input 
                type="month" 
                required
                value={newCycle.billing_month} 
                onChange={e => {
                  const billingMonth = e.target.value;
                  setNewCycle(prev => ({
                    ...prev,
                    billing_month: billingMonth,
                    name: prev.name === getDefaultCycleName(prev.billing_month) ? getDefaultCycleName(billingMonth) : prev.name
                  }));
                }}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>帳單名稱（可自訂）</label>
              <input 
                type="text" 
                value={newCycle.name} 
                onChange={e => setNewCycle({...newCycle, name: e.target.value})}
                placeholder="例如：2026年8月學費"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', height: '42px' }} disabled={loading}>
              {loading ? '建立中...' : '建立帳單並加入球員'}
            </button>
          </form>
          <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '10px' }}>
            建立後初始費用為 0 元，球員會出現在「待加入費用」名單；可用快速標籤或一次輸入多筆費用批次套用。
          </p>
        </div>
      )}

      {loading && !showCreateForm ? (
        <p style={{ textAlign: 'center', color: '#888' }}>載入中...</p>
      ) : cycles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '12px' }}>
          <p style={{ color: '#aaa', marginBottom: '10px' }}>目前還沒有任何帳單紀錄。</p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>點擊上方的「建立本期帳單」開始第一次收費。</p>
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
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', marginBottom: '4px' }}>{cycle.name}</h3>
                  {cycle.billing_month && <div style={{ fontSize: '0.85rem', color: '#fbbc05' }}>月份: {cycle.billing_month}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {cycle.status === 'active' ? (
                    <span style={{ background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>收費中</span>
                  ) : (
                    <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#aaa', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>已結算</span>
                  )}
                  <button 
                    onClick={(e) => handleDeleteCycle(e, cycle.id, cycle.name)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,107,107,0.5)', color: '#ff6b6b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    刪除
                  </button>
                </div>
              </div>
              <div style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '5px' }}>
                建立後到明細頁加入各項費用
              </div>
              <div style={{ color: '#888', fontSize: '0.8rem' }}>
                建立時間：{new Date(cycle.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default BillingDashboard;

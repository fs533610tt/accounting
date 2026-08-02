import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import PrintEnvelope from './PrintEnvelope';

const BillingDetail = ({ cycleId, onBack }) => {
  const [cycle, setCycle] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);

  useEffect(() => {
    fetchBillingDetails();
  }, [cycleId]);

  const fetchBillingDetails = async () => {
    setLoading(true);
    
    // 1. 取得帳單週期資訊
    const { data: cycleData, error: cycleError } = await supabase
      .from('billing_cycles')
      .select('*')
      .eq('id', cycleId)
      .single();

    if (cycleError) {
      console.error('Error fetching cycle:', cycleError);
      setLoading(false);
      return;
    }
    setCycle(cycleData);

    // 2. 取得此週期的所有繳款明細 (包含學生名稱與班級)
    const { data: recordsData, error: recordsError } = await supabase
      .from('billing_records')
      .select(`
        *,
        students (
          name,
          grade,
          class_name,
          is_officer
        )
      `)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true });

    if (recordsError) {
      console.error('Error fetching records:', recordsError);
    } else {
      setRecords(recordsData || []);
    }
    
    setLoading(false);
  };

  // 更新單筆明細的應繳/已繳金額
  const handleUpdateRecord = async (recordId, updates) => {
    const { error } = await supabase
      .from('billing_records')
      .update(updates)
      .eq('id', recordId);

    if (error) {
      alert('更新失敗：' + error.message);
    } else {
      setRecords(records.map(r => r.id === recordId ? { ...r, ...updates } : r));
    }
  };

  // 一鍵標記為已繳清
  const handleMarkAsPaid = async (record) => {
    await handleUpdateRecord(record.id, { 
      amount_paid: record.amount_due,
      status: 'paid' 
    });
  };

  // 標記為未繳
  const handleMarkAsPending = async (record) => {
    await handleUpdateRecord(record.id, { 
      amount_paid: 0,
      status: 'pending' 
    });
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>載入中...</div>;
  if (!cycle) return <div style={{ padding: '40px', textAlign: 'center' }}>找不到帳單資料</div>;

  // 統計數據
  const totalDue = records.reduce((sum, r) => sum + Number(r.amount_due), 0);
  const totalPaid = records.reduce((sum, r) => sum + Number(r.amount_paid), 0);
  const paidCount = records.filter(r => r.status === 'paid').length;

  if (showPrint) {
    return <PrintEnvelope cycle={cycle} records={records} onClose={() => setShowPrint(false)} />;
  }

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={onBack}
          style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
        >
          ← 返回帳單總覽
        </button>
        <button 
          onClick={() => setShowPrint(true)}
          style={{ background: '#fbbc05', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          🖨️ 列印全隊學費袋
        </button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 15px 0', color: 'var(--primary-color)' }}>{cycle.name} - 繳費明細</h2>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', minWidth: '150px' }}>
            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>應收總額</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${totalDue}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', minWidth: '150px' }}>
            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>已收總額</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>${totalPaid}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', minWidth: '150px' }}>
            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>繳款進度</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
              {paidCount} / {records.length} 人
            </div>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '12px' }}>學生姓名</th>
              <th style={{ padding: '12px' }}>身分</th>
              <th style={{ padding: '12px' }}>應繳金額</th>
              <th style={{ padding: '12px' }}>已繳金額</th>
              <th style={{ padding: '12px' }}>狀態</th>
              <th style={{ padding: '12px', width: '200px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px' }}>
                  <strong>{record.students?.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>
                    {record.students?.grade ? `${record.students.grade}年` : ''}{record.students?.class_name ? `${record.students.class_name}班` : ''}
                  </div>
                </td>
                <td style={{ padding: '12px' }}>
                  {record.students?.is_officer ? (
                    <span style={{ background: 'rgba(251, 188, 5, 0.2)', color: '#fbbc05', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>幹部</span>
                  ) : (
                    <span style={{ color: '#888' }}>一般</span>
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  {/* 可編輯應繳金額 (為了處理幹部折扣或請假退費) */}
                  <input 
                    type="number" 
                    value={record.amount_due}
                    onChange={(e) => handleUpdateRecord(record.id, { amount_due: Number(e.target.value) })}
                    style={{ width: '70px', padding: '4px', background: 'transparent', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                  />
                </td>
                <td style={{ padding: '12px' }}>
                  <input 
                    type="number" 
                    value={record.amount_paid}
                    onChange={(e) => handleUpdateRecord(record.id, { 
                      amount_paid: Number(e.target.value),
                      status: Number(e.target.value) >= record.amount_due ? 'paid' : (Number(e.target.value) > 0 ? 'partially_paid' : 'pending')
                    })}
                    style={{ width: '70px', padding: '4px', background: 'transparent', border: '1px solid #555', color: 'white', borderRadius: '4px' }}
                  />
                </td>
                <td style={{ padding: '12px' }}>
                  {record.status === 'paid' && <span style={{ color: '#4ade80', fontWeight: 'bold' }}>✓ 已繳清</span>}
                  {record.status === 'pending' && <span style={{ color: '#ff6b6b' }}>未繳</span>}
                  {record.status === 'partially_paid' && <span style={{ color: '#fbbc05' }}>部分繳納</span>}
                </td>
                <td style={{ padding: '12px' }}>
                  {record.status !== 'paid' ? (
                    <button 
                      onClick={() => handleMarkAsPaid(record)}
                      style={{ background: '#4ade80', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      一鍵繳清
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleMarkAsPending(record)}
                      style={{ background: 'transparent', color: '#ff6b6b', border: '1px solid #ff6b6b', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      取消繳清
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BillingDetail;

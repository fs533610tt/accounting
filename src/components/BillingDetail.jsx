import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import PrintEnvelope from './PrintEnvelope';
import * as XLSX from 'xlsx';

const BillingDetail = ({ cycleId, onBack }) => {
  const [cycle, setCycle] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState(new Set());
  const [batchPrice, setBatchPrice] = useState('');
  const [presets, setPresets] = useState([]);
  const [activeTab, setActiveTab] = useState('unassigned');

  useEffect(() => {
    fetchBillingDetails();
    fetchPresets();
  }, [cycleId]);

  const fetchPresets = async (team_id) => {
    const { data } = await supabase
      .from('fee_presets')
      .select('*')
      .eq('team_id', team_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setPresets(data || []);
  };

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
    
    // Fetch presets for this team
    if (cycleData?.team_id) {
      fetchPresets(cycleData.team_id);
    }

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
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...updates } : r));
    }
  };

  // 移除收費設定
  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('確定要移除此設定嗎？該學生將回到「未設定費用」名單。')) return;
    
    const { error } = await supabase
      .from('billing_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      alert('移除失敗：' + error.message);
    } else {
      setRecords(records.filter(r => r.id !== recordId));
      if (selectedRecordIds.has(recordId)) {
        const newSet = new Set(selectedRecordIds);
        newSet.delete(recordId);
        setSelectedRecordIds(newSet);
      }
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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRecordIds(new Set(records.map(r => r.id)));
    } else {
      setSelectedRecordIds(new Set());
    }
  };

  const handleSelectRecord = (id) => {
    const newSet = new Set(selectedRecordIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecordIds(newSet);
  };

  const applyPresetToSelected = async (presetAmount, isAdditive = true) => {
    if (selectedRecordIds.size === 0) {
      alert('請先勾選要設定金額的學生！');
      return;
    }

    const targetIds = Array.from(selectedRecordIds);
    
    // Build an array of updates
    const updates = targetIds.map(id => {
      const record = records.find(r => r.id === id);
      const newAmount = isAdditive ? Math.max(0, Number(record.amount_due) + presetAmount) : Math.max(0, presetAmount);
      return { id, amount_due: newAmount };
    });

    // Supabase doesn't support bulk update with different values easily in REST API, 
    // but since we only update amount_due, we can do it one by one or 
    // if all selected get the exact same new amount, we can bulk update.
    // Wait, if it's additive, they might have different original amounts.
    // To be safe and simple for < 100 records, loop and update.
    setLoading(true);
    let successCount = 0;
    
    for (const update of updates) {
      const { error } = await supabase
        .from('billing_records')
        .update({ amount_due: update.amount_due })
        .eq('id', update.id);
      
      if (!error) successCount++;
    }

    if (successCount === updates.length) {
      alert('批次設定成功！');
    } else {
      alert(`設定完成，但有 ${updates.length - successCount} 筆失敗，請重新整理後再試。`);
    }

    // Refresh data
    fetchBillingDetails();
    setSelectedRecordIds(new Set());
    setBatchPrice('');
  };

  const handleBatchUpdatePrice = () => {
    if (batchPrice === '') {
      alert('請輸入要套用的金額！');
      return;
    }
    const price = Number(batchPrice);
    if (isNaN(price) || price < 0) {
      alert('請輸入有效的金額！');
      return;
    }
    // Custom input is always overwrite (not additive)
    applyPresetToSelected(price, false);
  };

  if (loading && !cycle) return <div style={{ padding: '40px', textAlign: 'center' }}>載入中...</div>;
  if (!cycle) return <div style={{ padding: '40px', textAlign: 'center' }}>找不到帳單資料</div>;

  // 統計數據
  const totalDue = records.reduce((sum, r) => sum + Number(r.amount_due), 0);
  const totalPaid = records.reduce((sum, r) => sum + Number(r.amount_paid), 0);
  const paidCount = records.filter(r => r.status === 'paid').length;

  if (showPrint) {
    return <PrintEnvelope cycle={cycle} records={records} onClose={() => setShowPrint(false)} />;
  }

  const handleExportExcel = () => {
    const exportData = records.map(record => {
      let statusText = '未繳';
      if (record.status === 'paid') statusText = '已繳清';
      else if (record.status === 'partially_paid') statusText = '部分繳納';

      return {
        '學生姓名': record.students?.name || '未知',
        '年級': record.students?.grade || '',
        '班級': record.students?.class_name || '',
        '身分': record.students?.is_officer ? '幹部' : '一般',
        '應繳金額': record.amount_due,
        '已繳金額': record.amount_paid,
        '繳費狀態': statusText
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '繳費明細');

    XLSX.writeFile(workbook, `${cycle.name}_繳費明細.xlsx`);
  };

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={onBack}
          style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
        >
          ← 返回帳單總覽
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleExportExcel}
            style={{ background: '#217346', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            📊 匯出 Excel
          </button>
          <button 
            onClick={() => setShowPrint(true)}
            style={{ background: '#fbbc05', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🖨️ 列印全隊學費袋
          </button>
        </div>
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

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('unassigned')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'unassigned' ? 'var(--primary-color)' : '#aaa', 
            padding: '10px 20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'unassigned' ? '3px solid var(--primary-color)' : '3px solid transparent'
          }}
        >
          未設定費用 ({records.filter(r => r.amount_due === 0).length})
        </button>
        <button 
          onClick={() => setActiveTab('assigned')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'assigned' ? '#4ade80' : '#aaa', 
            padding: '10px 20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'assigned' ? '3px solid #4ade80' : '3px solid transparent'
          }}
        >
          已設定明細 ({records.filter(r => r.amount_due > 0).length})
        </button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px 24px', borderRadius: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>
          <div style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>批次分發收費</div>
          <div style={{ color: '#aaa', fontSize: '0.9rem' }}>已勾選 {selectedRecordIds.size} 人</div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap' }}>
          <select 
            id="presetSelect"
            style={{ 
              flex: '1 1 200px', 
              padding: '10px', 
              borderRadius: '8px', 
              border: '1px solid rgba(255,255,255,0.2)', 
              background: 'rgba(0,0,0,0.2)', 
              color: 'white',
              fontSize: '1rem',
              outline: 'none'
            }}
          >
            <option value="" style={{ background: '#1a1a2e', color: '#fff' }}>-- 選擇收費項目 --</option>
            {presets.map(p => (
              <option key={p.id} value={p.amount} style={{ background: '#1a1a2e', color: '#fff' }}>
                {p.name} ({p.amount >= 0 ? '+' : ''}{p.amount})
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const val = document.getElementById('presetSelect').value;
              if (val) {
                applyPresetToSelected(Number(val), true);
              } else {
                alert('請先選擇收費項目');
              }
            }}
            disabled={selectedRecordIds.size === 0}
            className="btn-primary"
            style={{ 
              padding: '10px 20px', 
              opacity: selectedRecordIds.size > 0 ? 1 : 0.5,
              cursor: selectedRecordIds.size > 0 ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              margin: 0
            }}
          >
            套用至已選
          </button>
        </div>
          
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input 
              type="number" 
              placeholder="自訂覆蓋金額..."
              value={batchPrice}
              onChange={e => setBatchPrice(e.target.value)}
              style={{ width: '130px', padding: '8px', borderRadius: '4px', border: '1px solid #555', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
            <button 
              onClick={handleBatchUpdatePrice}
              disabled={selectedRecordIds.size === 0}
              style={{ background: selectedRecordIds.size > 0 ? 'var(--primary-color)' : '#555', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: selectedRecordIds.size > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
            >
              直接覆蓋
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ddd' }}>
          <input 
            type="checkbox" 
            checked={
              records.filter(r => activeTab === 'unassigned' ? r.amount_due === 0 : r.amount_due > 0).length > 0 && 
              records.filter(r => activeTab === 'unassigned' ? r.amount_due === 0 : r.amount_due > 0).every(r => selectedRecordIds.has(r.id))
            }
            onChange={(e) => {
              const visibleRecords = records.filter(r => activeTab === 'unassigned' ? r.amount_due === 0 : r.amount_due > 0);
              if (e.target.checked) {
                const newSet = new Set(selectedRecordIds);
                visibleRecords.forEach(r => newSet.add(r.id));
                setSelectedRecordIds(newSet);
              } else {
                const newSet = new Set(selectedRecordIds);
                visibleRecords.forEach(r => newSet.delete(r.id));
                setSelectedRecordIds(newSet);
              }
            }}
            style={{ transform: 'scale(1.2)' }}
          />
          全選本頁名單
        </label>
      </div>

      <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {records
          .filter(r => activeTab === 'unassigned' ? r.amount_due === 0 : r.amount_due > 0)
          .sort((a, b) => {
            if (activeTab === 'assigned') {
              const diff = Number(b.amount_due) - Number(a.amount_due);
              if (diff !== 0) return diff;
            }
            // 姓名筆畫排序 (繁體中文預設)
            const nameA = a.students?.name || '';
            const nameB = b.students?.name || '';
            return nameA.localeCompare(nameB, 'zh-TW');
          })
          .map(record => (
          <div 
            key={record.id} 
            style={{ 
              background: selectedRecordIds.has(record.id) ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255,255,255,0.05)', 
              border: selectedRecordIds.has(record.id) ? '2px solid #4ade80' : '2px solid transparent',
              borderRadius: '12px',
              padding: '15px',
              transition: 'all 0.2s',
              cursor: 'pointer',
              position: 'relative'
            }}
            onClick={(e) => {
              if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
                handleSelectRecord(record.id);
              }
            }}
          >
            {/* Custom big checkmark when selected */}
            {selectedRecordIds.has(record.id) && (
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#4ade80', color: '#000', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                ✓
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '20px', height: '20px', borderRadius: '4px', 
                  border: selectedRecordIds.has(record.id) ? '2px solid #4ade80' : '2px solid #555',
                  background: selectedRecordIds.has(record.id) ? '#4ade80' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}>
                  {selectedRecordIds.has(record.id) && <span style={{ color: '#000', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '1.2rem' }}>{record.students?.name}</strong>
                    {record.students?.is_officer && (
                      <span style={{ background: 'rgba(251, 188, 5, 0.2)', color: '#fbbc05', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>幹部</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#888' }}>
                    {record.students?.grade ? `${record.students.grade}年` : ''}{record.students?.class_name ? `${record.students.class_name}班` : ''}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {record.status === 'paid' && <span style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>✓ 已繳清</span>}
                  {record.status === 'pending' && <span style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>未繳</span>}
                  {record.status === 'partially_paid' && <span style={{ background: 'rgba(251,188,5,0.1)', color: '#fbbc05', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>部分繳納</span>}
                  
                  {activeTab === 'assigned' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // 避免觸發卡片選取
                        handleDeleteRecord(record.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ff6b6b',
                        cursor: 'pointer',
                        padding: '4px',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="移除此設定"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>

            {activeTab === 'assigned' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa', fontSize: '0.9rem' }}>應繳金額</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#888', marginRight: '5px' }}>$</span>
                      <input 
                        type="number" 
                        value={record.amount_due}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, amount_due: val } : r));
                        }}
                        onBlur={(e) => handleUpdateRecord(record.id, { amount_due: Number(e.target.value) })}
                        style={{ width: '80px', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: 'white', borderRadius: '6px', textAlign: 'right' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa', fontSize: '0.9rem' }}>已繳金額</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#888', marginRight: '5px' }}>$</span>
                      <input 
                        type="number" 
                        value={record.amount_paid}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const newStatus = val >= record.amount_due && record.amount_due > 0 ? 'paid' : (val > 0 ? 'partially_paid' : 'pending');
                          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, amount_paid: val, status: newStatus } : r));
                        }}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          const newStatus = val >= record.amount_due && record.amount_due > 0 ? 'paid' : (val > 0 ? 'partially_paid' : 'pending');
                          handleUpdateRecord(record.id, { amount_paid: val, status: newStatus });
                        }}
                        style={{ width: '80px', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: 'white', borderRadius: '6px', textAlign: 'right' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', textAlign: 'right' }}>
                  {record.status !== 'paid' ? (
                    <button 
                      onClick={() => handleMarkAsPaid(record)}
                      style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80', border: '1px solid #4ade80', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                    >
                      一鍵繳清
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleMarkAsPending(record)}
                      style={{ background: 'transparent', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.5)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', width: '100%' }}
                    >
                      取消繳清
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BillingDetail;

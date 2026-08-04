import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../config/supabaseClient';
import PrintEnvelope from './PrintEnvelope';
import * as XLSX from 'xlsx';
import { Plus, Trash2 } from 'lucide-react';

const BillingDetail = ({ cycleId, onBack }) => {
  const [cycle, setCycle] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState(new Set());
  const [batchItems, setBatchItems] = useState([{ name: '', amount: '' }]);
  const [presets, setPresets] = useState([]);
  const [activeTab, setActiveTab] = useState('unassigned');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [batchPaidAt, setBatchPaidAt] = useState(() => {
    // Get local date string YYYY-MM-DD
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });
  const [batchPaymentMethod, setBatchPaymentMethod] = useState('cash'); // 'cash', 'transfer'
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [processingRecordId, setProcessingRecordId] = useState(null);

  useEffect(() => {
    fetchBillingDetails();
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

  const getBillingItems = (record) => record.billing_record_items || [];
  const hasBillingItems = (record) => getBillingItems(record).length > 0;
  const isAssignedRecord = (record) => hasBillingItems(record) || Number(record.amount_due) !== 0;

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
        ),
        billing_record_items (
          id,
          billing_record_id,
          name,
          amount,
          sort_order,
          created_at
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

  const handleSyncNewStudents = async () => {
    if (!cycle?.team_id) return;
    
    setIsProcessingBatch(true);
    // 1. Get all active students for this team
    const { data: activeStudents, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('team_id', cycle.team_id)
      .eq('is_active', true);
      
    if (studentError) {
      Swal.fire({ title: '同步失敗', text: '無法取得球員名單', icon: 'error' });
      setIsProcessingBatch(false);
      return;
    }
    
    // 2. Find missing students
    const existingStudentIds = new Set(records.map(r => r.student_id));
    const missingStudents = activeStudents.filter(s => !existingStudentIds.has(s.id));
    
    if (missingStudents.length === 0) {
      Swal.fire({ title: '已是最新', text: '目前沒有新增的球員需要同步！', icon: 'info' });
      setIsProcessingBatch(false);
      return;
    }
    
    // 3. Insert new records for missing students
    const recordsToInsert = missingStudents.map(student => ({
      cycle_id: cycleId,
      student_id: student.id,
      amount_due: 0,
      amount_paid: 0,
      status: 'pending'
    }));
    
    const { error: insertError } = await supabase
      .from('billing_records')
      .insert(recordsToInsert);
      
    if (insertError) {
      Swal.fire({ title: '同步失敗', text: insertError.message, icon: 'error' });
    } else {
      Swal.fire({ title: '同步成功', text: `成功加入 ${missingStudents.length} 位新球員！`, icon: 'success' });
      fetchBillingDetails();
    }
    setIsProcessingBatch(false);
  };

  // 更新單筆明細的應繳/已繳金額
  const handleUpdateRecord = async (recordId, updates) => {
    const { error } = await supabase
      .from('billing_records')
      .update(updates)
      .eq('id', recordId);

    if (error) {
      Swal.fire({ title: '更新失敗', text: error.message, icon: 'error' });
    } else {
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...updates } : r));
    }
  };

  const resetBillingRecord = async (recordId) => {
    const { error: itemsError } = await supabase
      .from('billing_record_items')
      .delete()
      .eq('billing_record_id', recordId);

    if (itemsError) return itemsError;

    const { error: recordError } = await supabase
      .from('billing_records')
      .update({
        amount_due: 0,
        amount_paid: 0,
        status: 'pending',
        note: null,
        paid_at: null,
        payment_method: null
      })
      .eq('id', recordId);

    return recordError;
  };

  // 移除收費設定
  const handleDeleteRecord = async (recordId) => {
    const result = await Swal.fire({
      title: '確定要移除嗎？',
      text: '確定要移除此設定嗎？該學生將回到「未設定費用」名單。',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: '確定移除',
      cancelButtonText: '取消'
    });
    if (!result.isConfirmed) return;
    
    const error = await resetBillingRecord(recordId);

    if (error) {
      Swal.fire({ title: '移除失敗', text: error.message, icon: 'error' });
    } else {
      if (selectedRecordIds.has(recordId)) {
        const newSet = new Set(selectedRecordIds);
        newSet.delete(recordId);
        setSelectedRecordIds(newSet);
      }
      fetchBillingDetails();
    }
  };

  // 批次移除收費設定
  const handleBatchDeleteRecords = async () => {
    if (selectedRecordIds.size === 0) return;
    
    const result = await Swal.fire({
      title: '確定要移除嗎？',
      text: `確定要移除這 ${selectedRecordIds.size} 位學生的設定嗎？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: '確定批次移除',
      cancelButtonText: '取消'
    });
    
    if (!result.isConfirmed) return;
    
    setIsProcessingBatch(true);
    let successCount = 0;
    const targetIds = Array.from(selectedRecordIds);

    for (const recordId of targetIds) {
      const error = await resetBillingRecord(recordId);
      
      if (!error) successCount++;
    }

    if (successCount === targetIds.length) {
      Swal.fire({ title: '移除成功', text: '批次移除成功！', icon: 'success', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire({ title: '部分失敗', text: `完成操作，但有 ${targetIds.length - successCount} 筆失敗。`, icon: 'warning' });
    }

    fetchBillingDetails();
    setSelectedRecordIds(new Set());
    setIsProcessingBatch(false);
  };

  // 一鍵標記為已繳清
  const handleMarkAsPaid = async (record) => {
    setProcessingRecordId(record.id);
    await handleUpdateRecord(record.id, { 
      amount_paid: record.amount_due,
      status: 'paid',
      paid_at: batchPaidAt,
      payment_method: batchPaymentMethod
    });
    setProcessingRecordId(null);
  };

  const handleBatchMarkAsPaid = async () => {
    if (selectedRecordIds.size === 0) return;
    setIsProcessingBatch(true);
    
    let successCount = 0;
    const updates = Array.from(selectedRecordIds).map(recordId => {
      const record = records.find(r => r.id === recordId);
      return {
        id: recordId,
        amount_paid: record?.amount_due || 0,
        status: 'paid',
        paid_at: batchPaidAt,
        payment_method: batchPaymentMethod
      };
    });

    for (const update of updates) {
      const { error } = await supabase
        .from('billing_records')
        .update({ 
          amount_paid: update.amount_paid,
          status: update.status,
          paid_at: update.paid_at,
          payment_method: update.payment_method
        })
        .eq('id', update.id);
      
      if (!error) successCount++;
    }

    if (successCount === updates.length) {
      Swal.fire({ title: '設定成功', text: '批次繳清成功！', icon: 'success' });
    } else {
      Swal.fire({ title: '部分失敗', text: `設定完成，但有 ${updates.length - successCount} 筆失敗，請重新整理後再試。`, icon: 'warning' });
    }

    fetchBillingDetails();
    setSelectedRecordIds(new Set());
    setIsProcessingBatch(false);
  };

  // 標記為未繳
  const handleMarkAsPending = async (record) => {
    setProcessingRecordId(record.id);
    await handleUpdateRecord(record.id, { 
      amount_paid: 0,
      status: 'pending',
      paid_at: null,
      payment_method: null
    });
    setProcessingRecordId(null);
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

  const applyItemsToSelected = async (items) => {
    if (selectedRecordIds.size === 0) {
      Swal.fire({ title: '注意', text: '請先勾選要新增明細的學生！', icon: 'warning' });
      return;
    }

    const targetIds = Array.from(selectedRecordIds);
    const targetRecords = records.filter(record => targetIds.includes(record.id));
    const itemsToInsert = targetRecords.flatMap(record => (
      items.map((item, index) => ({
        billing_record_id: record.id,
        name: item.name,
        amount: item.amount,
        sort_order: getBillingItems(record).length + index
      }))
    ));

    setIsProcessingBatch(true);
    const { error } = await supabase
      .from('billing_record_items')
      .insert(itemsToInsert);

    if (!error) {
      Swal.fire({ title: '新增成功', text: `已為 ${targetIds.length} 位學生新增 ${items.length} 筆明細！`, icon: 'success' });
    } else {
      Swal.fire({ title: '新增失敗', text: error.message, icon: 'error' });
    }

    await fetchBillingDetails();
    setBatchItems([{ name: '', amount: '' }]);
    setIsProcessingBatch(false);
  };

  const focusFeeComposerForRecord = (recordId) => {
    setSelectedRecordIds(new Set([recordId]));
    requestAnimationFrame(() => {
      document.getElementById('billing-fee-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleApplyBatchItems = () => {
    if (selectedRecordIds.size === 0) {
      Swal.fire({ title: '注意', text: '請先勾選要新增明細的學生！', icon: 'warning' });
      return;
    }

    const normalizedItems = batchItems.map(item => ({
      name: item.name.trim(),
      amount: Number(item.amount)
    }));
    const invalidItemIndex = batchItems.findIndex((item, index) => (
      !item.name.trim() || !String(item.amount).trim() || !Number.isFinite(normalizedItems[index].amount)
    ));

    if (invalidItemIndex !== -1) {
      Swal.fire({ title: '資料尚未完成', text: `請補齊第 ${invalidItemIndex + 1} 筆費用的名目與金額。`, icon: 'warning' });
      return;
    }

    applyItemsToSelected(normalizedItems);
  };

  const handleUpdateBatchItem = (index, field, value) => {
    setBatchItems(prev => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const handleAddBatchItem = () => {
    setBatchItems(prev => [...prev, { name: '', amount: '' }]);
  };

  const handleRemoveBatchItem = (index) => {
    setBatchItems(prev => prev.length === 1 ? [{ name: '', amount: '' }] : prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAddPresetToBatch = (preset) => {
    setBatchItems(prev => {
      const emptyIndex = prev.findIndex(item => !item.name.trim() && !String(item.amount).trim());
      const presetItem = { name: preset.name, amount: String(preset.amount) };
      if (emptyIndex === -1) return [...prev, presetItem];
      return prev.map((item, index) => index === emptyIndex ? presetItem : item);
    });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedRecordIds(new Set());
    setBatchItems([{ name: '', amount: '' }]);
  };

  const handleUpdateBillingItem = async (recordId, itemId, updates) => {
    if (updates.name !== undefined && !updates.name.trim()) {
      Swal.fire({ title: '更新失敗', text: '收費名目不可空白。', icon: 'error' });
      fetchBillingDetails();
      return;
    }
    if (updates.amount !== undefined && (!String(updates.amount).trim() || !Number.isFinite(Number(updates.amount)))) {
      Swal.fire({ title: '更新失敗', text: '請輸入有效金額。', icon: 'error' });
      fetchBillingDetails();
      return;
    }

    const normalizedUpdates = {
      ...updates,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.amount !== undefined ? { amount: Number(updates.amount) } : {})
    };

    const { error } = await supabase
      .from('billing_record_items')
      .update(normalizedUpdates)
      .eq('id', itemId)
      .eq('billing_record_id', recordId);

    if (error) {
      Swal.fire({ title: '更新失敗', text: error.message, icon: 'error' });
    } else {
      fetchBillingDetails();
    }
  };

  const handleDeleteBillingItem = async (recordId, itemId) => {
    const result = await Swal.fire({
      title: '刪除這筆收費明細？',
      text: '刪除後應繳總額會自動重新計算。',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      confirmButtonColor: '#d33'
    });
    if (!result.isConfirmed) return;

    const { error } = await supabase
      .from('billing_record_items')
      .delete()
      .eq('id', itemId)
      .eq('billing_record_id', recordId);

    if (error) {
      Swal.fire({ title: '刪除失敗', text: error.message, icon: 'error' });
    } else {
      fetchBillingDetails();
    }
  };



  if (loading && !cycle) return <div style={{ padding: '40px', textAlign: 'center' }}>載入中...</div>;
  if (!cycle) return <div style={{ padding: '40px', textAlign: 'center' }}>找不到帳單資料</div>;

  // 統計數據
  const totalDue = records.reduce((sum, r) => sum + Number(r.amount_due), 0);
  const totalPaid = records.reduce((sum, r) => sum + Number(r.amount_paid), 0);
  const paidCount = records.filter(r => r.status === 'paid').length;

  const displayRecords = records.filter(r => {
    // 1. Tab filter
    const assigned = isAssignedRecord(r);
    if (activeTab === 'unassigned' && assigned) return false;
    if (activeTab === 'assigned' && !assigned) return false;

    // 2. Search filter
    if (searchTerm && !r.students?.name.includes(searchTerm)) return false;

    // 3. Status filter (only matters if tab is 'assigned')
    if (activeTab === 'assigned' && filterStatus !== 'all') {
      if (filterStatus === 'paid' && r.status !== 'paid') return false;
      if (filterStatus === 'unpaid' && r.status === 'paid') return false;
    }

    return true;
  });

  const sortBillingRecords = (recordList) => [...recordList].sort((a, b) => {
    if (activeTab === 'assigned') {
      const diff = Number(b.amount_due) - Number(a.amount_due);
      if (diff !== 0) return diff;
    }
    // 姓名筆畫排序 (繁體中文預設)
    const nameA = a.students?.name || '';
    const nameB = b.students?.name || '';
    return nameA.localeCompare(nameB, 'zh-TW');
  });

  const sortedDisplayRecords = sortBillingRecords(displayRecords);

  if (showPrint) {
    const recordsToPrint = selectedRecordIds.size > 0 
      ? sortBillingRecords(records.filter(r => selectedRecordIds.has(r.id)))
      : sortedDisplayRecords;
    return <PrintEnvelope cycle={cycle} records={recordsToPrint} onClose={() => setShowPrint(false)} />;
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
        '費用明細': getBillingItems(record)
          .map(item => `${item.name}: ${item.amount >= 0 ? '+' : ''}${item.amount}`)
          .join(' / '),
        '應繳金額': record.amount_due,
        '已繳金額': record.amount_paid,
        '繳費狀態': statusText,
        '繳清日期': record.paid_at || '',
        '繳款方式': record.payment_method === 'cash' ? '現金' : (record.payment_method === 'transfer' ? '匯款' : '')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '繳費明細');

    XLSX.writeFile(workbook, `${cycle.name}_繳費明細.xlsx`);
  };

  return (
    <div style={{ marginTop: '10px' }}>
      <div className="scrollable-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '10px', overflowX: 'auto', paddingBottom: '10px', whiteSpace: 'nowrap' }}>
        <button 
          onClick={onBack}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', flex: '0 0 auto', fontWeight: 'bold' }}
        >
          ← 返回帳單總覽
        </button>
        <div style={{ display: 'flex', gap: '10px', flex: '0 0 auto' }}>
          <button 
            onClick={handleSyncNewStudents}
            disabled={isProcessingBatch}
            style={{ 
              background: 'rgba(96, 165, 250, 0.15)', 
              color: '#60a5fa', 
              border: '1px solid rgba(96, 165, 250, 0.3)', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              cursor: isProcessingBatch ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold',
              opacity: isProcessingBatch ? 0.5 : 1
            }}
          >
            🔄 同步新球員
          </button>
          <button 
            onClick={handleExportExcel}
            style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            📊 匯出 Excel
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 15px 0', color: 'var(--primary-color)' }}>{cycle.name} - 繳費明細</h2>
        
        <div className="scrollable-container" style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
          <div style={{ flex: '0 0 auto', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', minWidth: '130px' }}>
            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>應收總額</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${totalDue}</div>
          </div>
          <div style={{ flex: '0 0 auto', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', minWidth: '130px' }}>
            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>已收總額</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>${totalPaid}</div>
          </div>
          <div style={{ flex: '0 0 auto', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', minWidth: '130px' }}>
            <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>繳款進度</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
              {paidCount} / {records.length} 人
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={() => handleTabChange('unassigned')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'unassigned' ? 'var(--primary-color)' : '#aaa', 
            padding: '10px 20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'unassigned' ? '3px solid var(--primary-color)' : '3px solid transparent'
          }}
        >
          待加入費用 ({records.filter(r => !isAssignedRecord(r)).length})
        </button>
        <button 
          onClick={() => handleTabChange('assigned')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'assigned' ? '#4ade80' : '#aaa', 
            padding: '10px 20px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
            borderBottom: activeTab === 'assigned' ? '3px solid #4ade80' : '3px solid transparent'
          }}
        >
          已設定明細 ({records.filter(r => isAssignedRecord(r)).length})
        </button>
      </div>

      <div id="billing-fee-composer" style={{ background: 'rgba(96,165,250,0.08)', padding: '20px 24px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(96,165,250,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '18px' }}>
          <div>
            <div style={{ fontWeight: 'bold', color: '#60a5fa', fontSize: '1.05rem' }}>新增費用明細</div>
            <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '5px' }}>先勾選學生，再一次加入一筆或多筆費用</div>
          </div>
          <div style={{ color: selectedRecordIds.size > 0 ? '#4ade80' : '#aaa', fontWeight: 'bold', fontSize: '0.95rem' }}>
            {selectedRecordIds.size > 0 ? `目前已選 ${selectedRecordIds.size} 人` : '尚未選擇學生'}
          </div>
        </div>

        {presets.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '8px' }}>快速加入常用項目</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {presets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleAddPresetToBatch(preset)}
                  disabled={isProcessingBatch}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#ddd',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '999px',
                    padding: '6px 11px',
                    cursor: isProcessingBatch ? 'not-allowed' : 'pointer',
                    opacity: isProcessingBatch ? 0.5 : 1,
                    fontSize: '0.85rem'
                  }}
                >
                  {preset.name} ({preset.amount >= 0 ? '+' : ''}{preset.amount})
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
          {batchItems.map((item, index) => (
            <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#888', width: '20px', textAlign: 'center', fontSize: '0.85rem' }}>{index + 1}</span>
              <input
                type="text"
                aria-label={`第 ${index + 1} 筆費用名稱`}
                placeholder="費用名稱，例如：月費"
                value={item.name}
                onChange={e => handleUpdateBatchItem(index, 'name', e.target.value)}
                style={{ flex: '1 1 180px', minWidth: '150px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
              />
              <input
                type="number"
                step="0.01"
                aria-label={`第 ${index + 1} 筆費用金額`}
                placeholder="金額，可填負數"
                value={item.amount}
                onChange={e => handleUpdateBatchItem(index, 'amount', e.target.value)}
                style={{ flex: '0 1 150px', minWidth: '120px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: Number(item.amount) < 0 ? '#ff6b6b' : 'white', outline: 'none', textAlign: 'right' }}
              />
              <button
                type="button"
                onClick={() => handleRemoveBatchItem(index)}
                disabled={batchItems.length === 1 || isProcessingBatch}
                title="移除這筆費用"
                style={{ background: 'transparent', border: 'none', color: batchItems.length === 1 ? '#555' : '#ff6b6b', padding: '7px', cursor: batchItems.length === 1 || isProcessingBatch ? 'not-allowed' : 'pointer', opacity: isProcessingBatch ? 0.5 : 1 }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAddBatchItem}
            disabled={isProcessingBatch}
            style={{ background: 'transparent', color: '#60a5fa', border: '1px dashed rgba(96,165,250,0.6)', borderRadius: '8px', padding: '9px 13px', cursor: isProcessingBatch ? 'not-allowed' : 'pointer', opacity: isProcessingBatch ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            再加一筆費用
          </button>
          <button
            type="button"
            onClick={handleApplyBatchItems}
            disabled={selectedRecordIds.size === 0 || isProcessingBatch}
            className="btn-primary"
            style={{ flex: '1 1 240px', padding: '10px 15px', opacity: selectedRecordIds.size > 0 && !isProcessingBatch ? 1 : 0.5, cursor: selectedRecordIds.size > 0 && !isProcessingBatch ? 'pointer' : 'not-allowed', margin: 0 }}
          >
            {isProcessingBatch ? '處理中...' : `套用 ${batchItems.length} 筆費用至 ${selectedRecordIds.size} 人`}
          </button>
        </div>
        <div style={{ color: '#888', fontSize: '0.82rem', marginTop: '10px' }}>
          {selectedRecordIds.size === 0 ? '請往下點選學生卡片，或使用「全選目前列表」。' : '每一位已選學生都會收到上方的全部明細，總額會自動加總。'}
        </div>
      </div>

      {activeTab === 'assigned' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px 24px', borderRadius: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', color: '#4ade80' }}>付款處理</div>
            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>選取學生後可一次標記為已繳清</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              aria-label="批次繳清日期"
              value={batchPaidAt}
              onChange={e => setBatchPaidAt(e.target.value)}
              style={{ flex: '1 1 150px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
            <select
              aria-label="批次付款方式"
              value={batchPaymentMethod}
              onChange={e => setBatchPaymentMethod(e.target.value)}
              style={{ flex: '1 1 120px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            >
              <option value="cash" style={{ background: '#1a1a2e' }}>現金</option>
              <option value="transfer" style={{ background: '#1a1a2e' }}>匯款</option>
            </select>
            <button
              onClick={handleBatchMarkAsPaid}
              disabled={selectedRecordIds.size === 0 || isProcessingBatch}
              className="btn-primary"
              style={{ flex: '0 0 auto', padding: '10px 15px', opacity: selectedRecordIds.size > 0 && !isProcessingBatch ? 1 : 0.5, cursor: selectedRecordIds.size > 0 && !isProcessingBatch ? 'pointer' : 'not-allowed', margin: 0 }}
            >
              {isProcessingBatch ? '處理中...' : `批次繳清 ${selectedRecordIds.size > 0 ? `(${selectedRecordIds.size} 人)` : ''}`}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {activeTab === 'assigned' && (
            <button
              type="button"
              onClick={() => {
                if (selectedRecordIds.size === 0) {
                  Swal.fire({
                    title: '未勾選學生',
                    text: '目前沒有勾選任何人，預設將會列印畫面上「所有」學生的學費袋。若想測試列印，請先勾選幾位學生喔！',
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: '繼續列印全部',
                    cancelButtonText: '我先去勾選',
                    confirmButtonColor: '#4ade80',
                    cancelButtonColor: '#6c757d',
                  }).then((result) => {
                    if (result.isConfirmed) setShowPrint(true);
                  });
                } else {
                  setShowPrint(true);
                }
              }}
              style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🖨️ 列印學費袋
            </button>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ddd' }}>
            <input 
              type="checkbox" 
              checked={displayRecords.length > 0 && displayRecords.every(r => selectedRecordIds.has(r.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  const newSet = new Set(selectedRecordIds);
                  displayRecords.forEach(r => newSet.add(r.id));
                  setSelectedRecordIds(newSet);
                } else {
                  const newSet = new Set(selectedRecordIds);
                  displayRecords.forEach(r => newSet.delete(r.id));
                  setSelectedRecordIds(newSet);
                }
              }}
              style={{ transform: 'scale(1.2)' }}
            />
            全選目前列表
          </label>

          {selectedRecordIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedRecordIds(new Set())}
              disabled={isProcessingBatch}
              style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: isProcessingBatch ? 'not-allowed' : 'pointer', padding: '4px 0', fontSize: '0.85rem', opacity: isProcessingBatch ? 0.5 : 1 }}
            >
              清除選取
            </button>
          )}

          {activeTab === 'assigned' && selectedRecordIds.size > 0 && (
            <button
              onClick={handleBatchDeleteRecords}
              disabled={isProcessingBatch}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ff6b6b',
                cursor: isProcessingBatch ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                borderRadius: '6px',
                opacity: isProcessingBatch ? 0.5 : 1
              }}
              title="批次移除選取的設定"
            >
              <Trash2 size={18} />
              {isProcessingBatch && <span style={{ fontSize: '0.85rem' }}>處理中...</span>}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {activeTab === 'assigned' && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'white',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            >
              <option value="all" style={{ background: '#1a1a2e', color: 'white' }}>全部狀態</option>
              <option value="unpaid" style={{ background: '#1a1a2e', color: 'white' }}>未繳費</option>
              <option value="paid" style={{ background: '#1a1a2e', color: 'white' }}>已繳清</option>
            </select>
          )}
          <input
            type="text"
            placeholder="搜尋目前列表"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              outline: 'none',
              fontSize: '0.9rem',
              width: '150px'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {sortedDisplayRecords.map(record => (
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
                  {activeTab === 'assigned' && record.status === 'paid' && <span style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>✓ 已繳清</span>}
                  {activeTab === 'assigned' && record.status === 'pending' && <span style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>未繳</span>}
                  {activeTab === 'assigned' && record.status === 'partially_paid' && <span style={{ background: 'rgba(251,188,5,0.1)', color: '#fbbc05', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>部分繳納</span>}
                  
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
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {activeTab === 'assigned' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#aaa', fontSize: '0.9rem' }}>應繳總額（明細自動加總）</span>
                    <strong style={{ color: record.amount_due < 0 ? '#ff6b6b' : '#fff' }}>${record.amount_due}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {getBillingItems(record).map(item => (
                      <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 32px', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const value = e.target.value;
                            setRecords(prev => prev.map(r => r.id === record.id ? {
                              ...r,
                              billing_record_items: getBillingItems(r).map(currentItem => currentItem.id === item.id ? { ...currentItem, name: value } : currentItem)
                            } : r));
                          }}
                          onBlur={(e) => handleUpdateBillingItem(record.id, item.id, { name: e.target.value })}
                          style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: 'white', borderRadius: '6px' }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            setRecords(prev => prev.map(r => r.id === record.id ? {
                              ...r,
                              billing_record_items: getBillingItems(r).map(currentItem => currentItem.id === item.id ? { ...currentItem, amount: value } : currentItem)
                            } : r));
                          }}
                          onBlur={(e) => handleUpdateBillingItem(record.id, item.id, { amount: e.target.value })}
                          style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: Number(item.amount) < 0 ? '#ff6b6b' : 'white', borderRadius: '6px', textAlign: 'right' }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBillingItem(record.id, item.id);
                          }}
                          title="刪除收費明細"
                          style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        focusFeeComposerForRecord(record.id);
                      }}
                      style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed rgba(96,165,250,0.6)', color: '#60a5fa', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      + 加入另一筆費用
                    </button>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '15px' }}>
                  <span style={{ color: '#aaa', fontSize: '0.9rem' }}>備註 (如：400x6(時段) = 2400)</span>
                  <input 
                    type="text" 
                    value={record.note || ''}
                    placeholder="輸入對帳備註..."
                    onChange={(e) => {
                      const val = e.target.value;
                      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, note: val } : r));
                    }}
                    onBlur={(e) => {
                      handleUpdateRecord(record.id, { note: e.target.value });
                    }}
                    style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: 'white', borderRadius: '6px' }}
                  />
                </div>

                {record.status === 'paid' && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ color: '#aaa', fontSize: '0.9rem' }}>繳清日期</span>
                      <input 
                        type="date"
                        value={record.paid_at || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, paid_at: val } : r));
                        }}
                        onBlur={(e) => handleUpdateRecord(record.id, { paid_at: e.target.value })}
                        style={{ padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: 'white', borderRadius: '6px', width: '100%' }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span style={{ color: '#aaa', fontSize: '0.9rem' }}>付款方式</span>
                      <select 
                        value={record.payment_method || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, payment_method: val } : r));
                          handleUpdateRecord(record.id, { payment_method: val });
                        }}
                        style={{ padding: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid #555', color: 'white', borderRadius: '6px', width: '100%' }}
                      >
                        <option value="" style={{ background: '#1a1a2e' }}>未指定</option>
                        <option value="cash" style={{ background: '#1a1a2e' }}>現金</option>
                        <option value="transfer" style={{ background: '#1a1a2e' }}>匯款</option>
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', textAlign: 'right' }}>
                  {record.status !== 'paid' ? (
                    <button 
                      onClick={() => handleMarkAsPaid(record)}
                      disabled={processingRecordId === record.id}
                      style={{ 
                        background: 'rgba(74,222,128,0.2)', 
                        color: '#4ade80', 
                        border: '1px solid #4ade80', 
                        padding: '6px 16px', 
                        borderRadius: '6px', 
                        cursor: processingRecordId === record.id ? 'not-allowed' : 'pointer', 
                        fontWeight: 'bold', 
                        width: '100%',
                        opacity: processingRecordId === record.id ? 0.7 : 1
                      }}
                    >
                      {processingRecordId === record.id ? '處理中...' : '一鍵繳清'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleMarkAsPending(record)}
                      disabled={processingRecordId === record.id}
                      style={{ 
                        background: 'transparent', 
                        color: '#ff6b6b', 
                        border: '1px solid rgba(255,107,107,0.5)', 
                        padding: '6px 16px', 
                        borderRadius: '6px', 
                        cursor: processingRecordId === record.id ? 'not-allowed' : 'pointer', 
                        width: '100%',
                        opacity: processingRecordId === record.id ? 0.7 : 1
                      }}
                    >
                      {processingRecordId === record.id ? '處理中...' : '取消繳清'}
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

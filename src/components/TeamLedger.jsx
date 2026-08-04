import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import Swal from 'sweetalert2';

// 壓縮圖片的小工具
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.7);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// 顯示收據縮圖並獲取安全連結的元件
const ReceiptImage = ({ path }) => {
  const [url, setUrl] = useState(null);
  
  useEffect(() => {
    // 取得暫時的安全觀看連結 (24小時有效)
    supabase.storage.from('receipts').createSignedUrl(path, 60 * 60 * 24).then(({ data }) => {
      if (data) setUrl(data.signedUrl);
    });
  }, [path]);

  if (!url) return <div style={{ width: '60px', height: '60px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', display: 'inline-block' }} />;

  return (
    <img 
      src={url} 
      alt="收據"
      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', transition: 'transform 0.2s' }} 
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      onClick={() => {
        Swal.fire({
          imageUrl: url,
          imageAlt: '收據',
          background: '#1a1a2e',
          showConfirmButton: false,
          width: 'auto',
          padding: '10px'
        });
      }}
    />
  );
};

const TeamLedger = ({ teamId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTx, setNewTx] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    type: 'expense',
    category: '器材',
    amount: '',
    description: '',
    is_settled: false
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(''); // 月份篩選

  useEffect(() => {
    fetchTransactions();
  }, [teamId, selectedMonth]);

  const fetchTransactions = async () => {
    setLoading(true);
    let query = supabase
      .from('team_transactions')
      .select('*')
      .eq('team_id', teamId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    // 加入月份篩選條件
    if (selectedMonth) {
      const startDate = `${selectedMonth}-01`;
      // 計算下個月的第一天
      const [year, month] = selectedMonth.split('-');
      const nextMonth = month === '12' ? '01' : String(Number(month) + 1).padStart(2, '0');
      const nextYear = month === '12' ? String(Number(year) + 1) : year;
      const endDate = `${nextYear}-${nextMonth}-01`;
      
      query = query.gte('transaction_date', startDate).lt('transaction_date', endDate);
    }

    const { data, error } = await query;

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

    // 處理圖片上傳
    let receiptUrls = [];
    if (selectedFiles.length > 0) {
      try {
        Swal.fire({ title: '壓縮與上傳中...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() }, background: '#1a1a2e', color: '#fff' });
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const compressedBlob = await compressImage(file);
          const fileName = `${teamId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });
            
          if (uploadError) throw uploadError;
          if (uploadData) receiptUrls.push(uploadData.path);
        }
      } catch (err) {
        setLoading(false);
        Swal.fire({ title: '圖片上傳失敗', text: err.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
        return;
      }
    }

    const { error } = await supabase
      .from('team_transactions')
      .insert([{
        team_id: teamId,
        transaction_date: newTx.transaction_date,
        type: newTx.type,
        category: newTx.category,
        amount: Number(newTx.amount),
        description: newTx.description,
        receipt_urls: receiptUrls,
        is_settled: newTx.type === 'income' ? true : newTx.is_settled
      }]);

    if (error) {
      Swal.fire({ title: '新增失敗', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      Swal.fire({ title: '成功', text: '已新增一筆紀錄！', icon: 'success', background: '#1a1a2e', color: '#fff', timer: 1500 });
      setShowAddForm(false);
      setNewTx({ ...newTx, amount: '', description: '', is_settled: false });
      setSelectedFiles([]);
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

  const handleToggleSettled = async (id, currentStatus) => {
    const { error } = await supabase
      .from('team_transactions')
      .update({ is_settled: !currentStatus })
      .eq('id', id);

    if (error) {
      Swal.fire({ title: '更新失敗', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      fetchTransactions();
    }
  };

  // 計算總結餘
  const totalBalance = transactions.reduce((acc, curr) => {
    return curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount);
  }, 0);
  
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingReimbursement = transactions.filter(t => t.type === 'expense' && !t.is_settled).reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div>
      <div className="scrollable-container" style={{ display: 'flex', gap: '15px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
        <div style={{ flex: '0 0 auto', minWidth: '130px', background: 'rgba(255, 165, 0, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255, 165, 0, 0.3)' }}>
          <div style={{ fontSize: '0.9rem', color: '#ffa500', marginBottom: '5px' }}>⚠️ 待核銷代墊款</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffa500' }}>
            ${pendingReimbursement}
          </div>
        </div>
        <div style={{ flex: '0 0 auto', minWidth: '130px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '5px' }}>目前總結餘</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: totalBalance >= 0 ? '#4ade80' : '#ff6b6b' }}>
            {totalBalance >= 0 ? '+' : ''}{totalBalance}
          </div>
        </div>
        <div style={{ flex: '0 0 auto', minWidth: '130px', background: 'rgba(74, 222, 128, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
          <div style={{ fontSize: '0.9rem', color: '#4ade80', marginBottom: '5px' }}>總收入</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>+{totalIncome}</div>
        </div>
        <div style={{ flex: '0 0 auto', minWidth: '130px', background: 'rgba(255, 107, 107, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255, 107, 107, 0.2)' }}>
          <div style={{ fontSize: '0.9rem', color: '#ff6b6b', marginBottom: '5px' }}>總支出</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff6b6b' }}>-{totalExpense}</div>
        </div>
      </div>

      <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>交易明細</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }}
            />
            {selectedMonth && (
              <button onClick={() => setSelectedMonth('')} style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px' }}>
                清除
              </button>
            )}
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)} style={{ background: showAddForm ? 'transparent' : 'var(--primary-color)', border: showAddForm ? '1px solid #ccc' : 'none', minWidth: '120px' }}>
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
            {newTx.type === 'expense' && (
              <div style={{ flex: 1, minWidth: '100px', display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px', marginTop: '20px' }}>
                  <input type="checkbox" checked={newTx.is_settled} onChange={e => setNewTx({...newTx, is_settled: e.target.checked})} style={{ width: '18px', height: '18px' }} />
                  <span style={{ fontSize: '0.9rem', color: '#ccc' }}>已直接核銷結清</span>
                </label>
              </div>
            )}
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>備註</label>
              <input type="text" placeholder="選填" value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>收據圖片 (可多選)</label>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={e => setSelectedFiles(Array.from(e.target.files))} 
                style={{ width: '100%', padding: '7px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }} 
              />
            </div>
            <div style={{ flexBasis: '100%', marginTop: '10px' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 20px', height: '48px', fontSize: '1.1rem', fontWeight: 'bold' }} disabled={loading}>
                {loading ? '儲存中...' : '儲存交易'}
              </button>
            </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
          {transactions.map(tx => (
            <div 
              key={tx.id} 
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '12px', 
                border: '1px solid rgba(255,255,255,0.08)', 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{tx.transaction_date}</span>
                {tx.type === 'income' ? (
                  <span style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>收入</span>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {tx.is_settled ? (
                      <span style={{ background: 'rgba(46, 204, 113, 0.2)', border: '1px solid rgba(46, 204, 113, 0.5)', color: '#2ecc71', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>✓ 已結清</span>
                    ) : (
                      <span style={{ background: 'rgba(255, 165, 0, 0.2)', border: '1px solid rgba(255, 165, 0, 0.5)', color: '#ffa500', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>⚠️ 待核銷</span>
                    )}
                    <span style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#ff6b6b', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>支出</span>
                  </div>
                )}
              </div>
              
              <div>
                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>分類</div>
                <div style={{ fontSize: '1.1rem', color: 'white' }}>{tx.category}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '4px' }}>金額</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tx.type === 'income' ? '#4ade80' : '#ff6b6b' }}>
                  {tx.type === 'income' ? '+' : '-'}${tx.amount}
                </div>
              </div>

              {tx.description && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', color: '#ccc' }}>
                  {tx.description}
                </div>
              )}

              {/* 顯示收據圖片 */}
              {tx.receipt_urls && tx.receipt_urls.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {tx.receipt_urls.map((path, index) => (
                    <ReceiptImage key={index} path={path} />
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '10px' }}>
                {tx.type === 'expense' ? (
                  <button 
                    onClick={() => handleToggleSettled(tx.id, tx.is_settled)}
                    style={{ 
                      background: tx.is_settled ? 'transparent' : 'var(--primary-color)',
                      border: tx.is_settled ? '1px solid rgba(255,255,255,0.2)' : 'none',
                      color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'
                    }}
                  >
                    {tx.is_settled ? '取消結清' : '💰 標記為已結清'}
                  </button>
                ) : <div />}

                <button 
                  onClick={() => handleDelete(tx.id)} 
                  style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.2)', color: '#ff8888', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,100,100,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🗑️ 刪除紀錄
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamLedger;

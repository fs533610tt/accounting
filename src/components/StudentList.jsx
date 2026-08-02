import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

const StudentList = ({ teamId }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', grade: '', class_name: '', note: '', is_officer: false, is_active: true });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching students:', error);
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (teamId) {
      fetchStudents();
    }
  }, [teamId]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name.trim()) return;

    const { data, error } = await supabase
      .from('students')
      .insert([
        { 
          team_id: teamId, 
          name: newStudent.name, 
          grade: newStudent.grade, 
          class_name: newStudent.class_name,
          note: newStudent.note,
          is_officer: newStudent.is_officer,
          is_active: newStudent.is_active
        }
      ])
      .select();

    if (error) {
      alert('新增失敗：' + error.message);
    } else if (data) {
      setStudents([data[0], ...students]);
      setShowAddForm(false);
      setNewStudent({ name: '', grade: '', class_name: '', note: '', is_officer: false, is_active: true });
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: '確定要刪除嗎？',
      text: `確定要刪除球員「${name}」嗎？這個操作無法復原。`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff6b6b',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '是的，刪除！',
      cancelButtonText: '取消',
      background: '#1a1a2e',
      color: '#fff'
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      Swal.fire({ title: '刪除失敗', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      setStudents(students.filter(s => s.id !== id));
    }
  };

  const handleEditClick = (student) => {
    setEditingId(student.id);
    setEditForm({ ...student });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.name.trim()) return;

    const { error } = await supabase
      .from('students')
      .update({
        name: editForm.name,
        grade: editForm.grade,
        class_name: editForm.class_name,
        note: editForm.note,
        is_officer: editForm.is_officer,
        is_active: editForm.is_active !== undefined ? editForm.is_active : true
      })
      .eq('id', id);

    if (error) {
      alert('儲存失敗：' + error.message);
    } else {
      setStudents(students.map(s => s.id === id ? { ...s, ...editForm } : s));
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleBulkPromote = async () => {
    const result = await Swal.fire({
      title: '確定要執行「一鍵升級」嗎？',
      text: '系統會自動將所有一到五年級的學生升一級，六年級的學生會被標記為「畢業」。(請確認目前名單正確無誤再執行)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4ade80',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '是的，執行升級！',
      cancelButtonText: '取消',
      background: '#1a1a2e',
      color: '#fff'
    });

    if (!result.isConfirmed) return;

    setLoading(true);

    const gradeMap = {
      '一': '二', '二': '三', '三': '四', '四': '五', '五': '六', '六': '畢業',
      '1': '2', '2': '3', '3': '4', '4': '5', '5': '6', '6': '畢業'
    };

    const updatedStudents = students.map(student => {
      // 移除可能的多餘空白
      const currentGrade = student.grade ? student.grade.trim() : '';
      const nextGrade = gradeMap[currentGrade] || currentGrade; 
      
      return {
        ...student,
        grade: nextGrade,
        // 如果升級後變成畢業，自動標記為離隊
        is_active: nextGrade === '畢業' ? false : (student.is_active !== undefined ? student.is_active : true)
      };
    });

    // 將有改變的資料寫回資料庫
    // Supabase upsert 需要帶有 primary key (id)
    const { error } = await supabase
      .from('students')
      .upsert(updatedStudents)
      .select();

    if (error) {
      Swal.fire({ title: '升級失敗', text: error.message, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } else {
      Swal.fire({ title: '完成！', text: '一鍵升級已成功執行。', icon: 'success', background: '#1a1a2e', color: '#fff' });
      setStudents(updatedStudents);
    }
    
    setLoading(false);
  };

  const handleExportExcel = () => {
    // 準備匯出的資料，將英文狀態轉換為中文
    const exportData = students.map(student => ({
      '姓名': student.name,
      '年級': student.grade || '',
      '班級': student.class_name || '',
      '身分': student.is_officer ? '幹部' : '一般球員',
      '狀態': student.is_active === false ? '離隊/畢業' : '在隊',
      '備註': student.note || ''
    }));

    // 建立 Worksheet 與 Workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '球員名冊');

    // 產生檔案並下載
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `球員名冊_${dateStr}.xlsx`);
  };

  return (
    <div style={{ marginTop: '30px' }}>
      <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>球員名冊管理</h2>
        <div className="action-buttons-container" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button 
            onClick={handleBulkPromote}
            disabled={students.length === 0}
            style={{ 
              background: 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)', 
              color: '#333', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              cursor: students.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(255, 154, 158, 0.3)'
            }}
          >
            🚀 一鍵升年級
          </button>
          <button 
            onClick={() => setShowInactive(!showInactive)}
            style={{ 
              background: 'transparent', 
              color: showInactive ? 'var(--primary-color)' : '#aaa', 
              border: `1px solid ${showInactive ? 'var(--primary-color)' : '#666'}`, 
              padding: '8px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer',
            }}
          >
            {showInactive ? '隱藏離隊球員' : '顯示歷史球員'}
          </button>
          <button 
            onClick={handleExportExcel}
            disabled={students.length === 0}
            style={{ 
              background: '#217346', // Excel 的代表色
              color: '#fff', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              cursor: students.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            📊 匯出 Excel
          </button>
          <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? '取消新增' : '+ 新增球員'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="🔍 搜尋學生姓名..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', maxWidth: '300px', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
        />
      </div>

      {showAddForm && (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ marginTop: 0 }}>新增球員</h3>
          <form className="flex-mobile-column" onSubmit={handleAddStudent} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>姓名</label>
              <input 
                type="text" 
                required
                value={newStudent.name} 
                onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>年級</label>
              <input 
                type="text" 
                placeholder="例如: 三"
                value={newStudent.grade} 
                onChange={e => setNewStudent({...newStudent, grade: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>班級</label>
              <input 
                type="text" 
                placeholder="例如: 忠"
                value={newStudent.class_name} 
                onChange={e => setNewStudent({...newStudent, class_name: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>備註</label>
              <input 
                type="text" 
                placeholder="例如: 大/小"
                value={newStudent.note} 
                onChange={e => setNewStudent({...newStudent, note: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px' }}>
              <input 
                type="checkbox" 
                id="isOfficer"
                checked={newStudent.is_officer}
                onChange={e => setNewStudent({...newStudent, is_officer: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="isOfficer" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>是否為幹部</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', marginLeft: '10px' }}>
              <input 
                type="checkbox" 
                id="isActive"
                checked={newStudent.is_active}
                onChange={e => setNewStudent({...newStudent, is_active: e.target.checked})}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="isActive" style={{ cursor: 'pointer', fontSize: '0.9rem', color: newStudent.is_active ? '#fff' : '#aaa' }}>{newStudent.is_active ? '在隊' : '離隊'}</label>
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', marginLeft: 'auto' }}>儲存</button>
          </form>
        </div>
      )}

      {loading ? (
        <p>載入名冊中...</p>
      ) : students.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
          目前還沒有任何球員資料，點擊上方按鈕新增第一位球員吧！
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {students
            .filter(student => showInactive || student.is_active !== false)
            .filter(student => student.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(student => (
            <div 
              key={student.id} 
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '12px', 
                border: '1px solid rgba(255,255,255,0.08)', 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '15px',
                opacity: student.is_active === false ? 0.6 : 1,
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => { if (editingId !== student.id) e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { if (editingId !== student.id) e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {editingId === student.id ? (
                // 編輯模式
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>姓名</label>
                    <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>年級</label>
                      <input type="text" value={editForm.grade || ''} placeholder="例如: 三" onChange={e => setEditForm({...editForm, grade: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>班級</label>
                      <input type="text" value={editForm.class_name || ''} placeholder="例如: 忠" onChange={e => setEditForm({...editForm, class_name: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>備註</label>
                    <input type="text" value={editForm.note || ''} onChange={e => setEditForm({...editForm, note: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    <label style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editForm.is_officer} onChange={e => setEditForm({...editForm, is_officer: e.target.checked})} />
                      設為幹部
                    </label>
                    <label style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editForm.is_active !== false} onChange={e => setEditForm({...editForm, is_active: e.target.checked})} />
                      目前在隊
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={handleCancelEdit} style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}>取消</button>
                    <button onClick={() => handleSaveEdit(student.id)} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>儲存</button>
                  </div>
                </div>
              ) : (
                // 瀏覽模式
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'white' }}>{student.name}</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {student.is_active === false ? (
                        <span style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#ff6b6b', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>離隊/畢業</span>
                      ) : (
                        <span style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>在隊</span>
                      )}
                      {student.is_officer && (
                        <span style={{ background: 'rgba(251, 188, 5, 0.1)', border: '1px solid rgba(251, 188, 5, 0.3)', color: '#fbbc05', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>幹部</span>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem', width: '50px' }}>班級</span>
                      <span style={{ color: '#e2e8f0', fontSize: '0.95rem' }}>
                        {student.grade ? `${student.grade}年` : ''}{student.class_name ? `${student.class_name}班` : (student.grade ? '' : '-')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem', width: '50px', marginTop: '2px' }}>備註</span>
                      <span style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.4' }}>
                        {student.note || '-'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <button 
                      onClick={() => handleEditClick(student)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                      ✏️ 編輯
                    </button>
                    <button 
                      onClick={() => handleDelete(student.id, student.name)}
                      style={{ background: 'rgba(255,100,100,0.05)', border: '1px solid rgba(255,100,100,0.2)', color: '#ff8888', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,100,100,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,100,100,0.05)'}
                    >
                      🗑️ 刪除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentList;

import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

const StudentList = ({ teamId }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', grade: '', class_name: '', note: '', is_officer: false, is_active: true });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showInactive, setShowInactive] = useState(false);

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
    if (!window.confirm(`確定要刪除球員「${name}」嗎？這個操作無法復原。`)) return;

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      alert('刪除失敗：' + error.message);
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
    if (!window.confirm('確定要執行「一鍵升級」嗎？\n系統會自動將所有一到五年級的學生升一級，六年級的學生會被標記為「畢業」。\n(請確認目前名單正確無誤再執行)')) return;

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
      alert('一鍵升級失敗：' + error.message);
    } else {
      alert('一鍵升級完成！');
      setStudents(updatedStudents);
    }
    
    setLoading(false);
  };

  return (
    <div style={{ marginTop: '30px' }}>
      <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
        <h2 style={{ margin: 0 }}>球員名冊管理</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
          <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? '取消新增' : '+ 新增球員'}
          </button>
        </div>
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
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px' }}>姓名</th>
                <th style={{ padding: '12px' }}>年級/班級</th>
                <th style={{ padding: '12px' }}>備註</th>
                <th style={{ padding: '12px' }}>身分</th>
                <th style={{ padding: '12px' }}>狀態</th>
                <th style={{ padding: '12px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {students
                .filter(student => showInactive || student.is_active !== false)
                .map(student => (
                <tr key={student.id} style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  opacity: student.is_active === false ? 0.5 : 1
                }}>
                  {editingId === student.id ? (
                    // 編輯模式
                    <>
                      <td style={{ padding: '12px' }}>
                        <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: '80px', padding: '4px' }} />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <input type="text" value={editForm.grade || ''} placeholder="年" onChange={e => setEditForm({...editForm, grade: e.target.value})} style={{ width: '40px', padding: '4px', marginRight: '4px' }} />
                        <input type="text" value={editForm.class_name || ''} placeholder="班" onChange={e => setEditForm({...editForm, class_name: e.target.value})} style={{ width: '40px', padding: '4px' }} />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <input type="text" value={editForm.note || ''} onChange={e => setEditForm({...editForm, note: e.target.value})} style={{ width: '80px', padding: '4px' }} />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <input type="checkbox" checked={editForm.is_officer} onChange={e => setEditForm({...editForm, is_officer: e.target.checked})} />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input type="checkbox" checked={editForm.is_active !== false} onChange={e => setEditForm({...editForm, is_active: e.target.checked})} />
                          在隊
                        </label>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => handleSaveEdit(student.id)} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}>儲存</button>
                        <button onClick={handleCancelEdit} style={{ background: 'transparent', border: '1px solid #ccc', color: '#ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>取消</button>
                      </td>
                    </>
                  ) : (
                    // 瀏覽模式
                    <>
                      <td style={{ padding: '12px' }}><strong>{student.name}</strong></td>
                      <td style={{ padding: '12px', color: '#ccc' }}>
                        {student.grade ? `${student.grade}年` : ''}{student.class_name ? `${student.class_name}班` : '-'}
                      </td>
                      <td style={{ padding: '12px', color: '#aaa', fontSize: '0.9rem' }}>
                        {student.note || '-'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {student.is_officer ? (
                          <span style={{ background: 'rgba(251, 188, 5, 0.2)', color: '#fbbc05', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>幹部</span>
                        ) : (
                          <span style={{ color: '#888' }}>一般球員</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {student.is_active === false ? (
                           <span style={{ color: '#ff6b6b', fontSize: '0.9rem' }}>離隊/畢業</span>
                        ) : (
                           <span style={{ color: '#4ade80', fontSize: '0.9rem' }}>在隊</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button 
                          onClick={() => handleEditClick(student)}
                          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
                        >
                          編輯
                        </button>
                        <button 
                          onClick={() => handleDelete(student.id, student.name)}
                          style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.5)', color: '#ff8888', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          刪除
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentList;

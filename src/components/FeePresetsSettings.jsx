import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

const FeePresetsSettings = ({ teamId }) => {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPreset, setNewPreset] = useState({ name: '', amount: 0 });

  useEffect(() => {
    fetchPresets();
  }, [teamId]);

  const fetchPresets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fee_presets')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching fee presets:', error);
    } else {
      setPresets(data || []);
    }
    setLoading(false);
  };

  const handleAddPreset = async (e) => {
    e.preventDefault();
    if (!newPreset.name.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from('fee_presets')
      .insert([{
        team_id: teamId,
        name: newPreset.name,
        amount: Number(newPreset.amount),
        sort_order: presets.length
      }]);

    if (error) {
      alert('新增失敗: ' + error.message);
    } else {
      setNewPreset({ name: '', amount: 0 });
      fetchPresets();
    }
    setLoading(false);
  };

  const handleDeletePreset = async (id) => {
    if (!window.confirm('確定要刪除此收費標籤嗎？')) return;
    setLoading(true);
    const { error } = await supabase
      .from('fee_presets')
      .delete()
      .eq('id', id);

    if (error) {
      alert('刪除失敗: ' + error.message);
    } else {
      fetchPresets();
    }
    setLoading(false);
  };

  const handleMove = async (index, direction) => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === presets.length - 1)
    ) return;

    const newPresets = [...presets];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newPresets[index];
    newPresets[index] = newPresets[targetIndex];
    newPresets[targetIndex] = temp;
    
    // Update local state immediately for snappy UI
    setPresets(newPresets);

    // Update DB
    const updates = newPresets.map((p, i) => ({ id: p.id, sort_order: i }));
    for (const update of updates) {
      await supabase
        .from('fee_presets')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>收費快速標籤設定</h2>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--glass-border)' }}>
        <h3 style={{ marginTop: 0 }}>新增標籤</h3>
        <form className="flex-mobile-column" onSubmit={handleAddPreset} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>標籤名稱 (例如: 月費A、暑訓(全)、出席會議折抵)</label>
            <input 
              type="text" 
              required
              value={newPreset.name} 
              onChange={e => setNewPreset({...newPreset, name: e.target.value})}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>金額 (折抵請填負數，例如: -100)</label>
            <input 
              type="number" 
              required
              value={newPreset.amount} 
              onChange={e => setNewPreset({...newPreset, amount: e.target.value === '' ? '' : Number(e.target.value)})}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '10px 20px', height: '42px' }} disabled={loading}>
            新增標籤
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
        {presets.length === 0 && !loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#888', padding: '20px' }}>
            目前還沒有設定任何標籤。
          </div>
        )}
        {presets.map((preset, index) => (
          <div key={preset.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '5px' }}>{preset.name}</div>
              <div style={{ color: preset.amount >= 0 ? '#4ade80' : '#ff6b6b', fontSize: '1.1rem' }}>
                {preset.amount >= 0 ? '+' : ''}{preset.amount}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginRight: '10px' }}>
                <button 
                  onClick={() => handleMove(index, 'up')}
                  disabled={index === 0}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: index === 0 ? '#555' : 'white', borderRadius: '4px', cursor: index === 0 ? 'not-allowed' : 'pointer', padding: '2px 8px' }}
                >
                  ▲
                </button>
                <button 
                  onClick={() => handleMove(index, 'down')}
                  disabled={index === presets.length - 1}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: index === presets.length - 1 ? '#555' : 'white', borderRadius: '4px', cursor: index === presets.length - 1 ? 'not-allowed' : 'pointer', padding: '2px 8px' }}
                >
                  ▼
                </button>
              </div>
              <button 
                onClick={() => handleDeletePreset(preset.id)}
                style={{ background: 'transparent', border: '1px solid rgba(255,107,107,0.5)', color: '#ff6b6b', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
              >
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeePresetsSettings;

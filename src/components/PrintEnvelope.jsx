import React from 'react';

// 信封尺寸設定 (依據照片測量：寬 22.5cm, 高 10.5cm)
const ENVELOPE_WIDTH = '22.5cm';
const ENVELOPE_HEIGHT = '10.5cm';

const PrintEnvelope = ({ cycle, records, onClose }) => {
  
  return (
    <div className="print-container" style={{ background: '#fff', color: '#000', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, overflowY: 'auto' }}>
      
      {/* 螢幕顯示用的操作區塊 (列印時會被隱藏) */}
      <div className="no-print" style={{ padding: '20px', background: '#333', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🖨️ 學費袋列印預覽</h2>
          <p style={{ margin: '5px 0 0 0', color: '#ccc' }}>請確認印表機已放入正確尺寸 (22.5cm x 10.5cm) 的空白信封，或是直接印在 A4 紙上裁切。</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={{ padding: '10px 20px', background: '#4ade80', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            開始列印
          </button>
          <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '8px', cursor: 'pointer' }}>
            取消並返回
          </button>
        </div>
      </div>

      {/* 實際列印的內容區塊 */}
      <div className="print-area" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: '#e5e5e5' }}>
        
        {records.map((record) => (
          <div 
            key={record.id} 
            className="envelope-page"
            style={{ 
              width: ENVELOPE_WIDTH, 
              height: ENVELOPE_HEIGHT, 
              background: '#fef08a', // 模擬黃色信封底色 (列印時可依需求關閉背景)
              padding: '1.5cm',
              boxSizing: 'border-box',
              position: 'relative',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              fontFamily: '"標楷體", "DFKai-SB", serif', // 傳統信封常用字體
              color: '#b91c1c' // 模擬紅字印刷
            }}
          >
            {/* 信封上半部：姓名與說明 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                姓 名 <span style={{ textDecoration: 'underline', padding: '0 20px', color: '#000' }}>{record.students?.name}</span>
              </div>
              <div style={{ fontSize: '0.8rem', width: '60%', lineHeight: '1.4' }}>
                貴子弟下列月份應繳學費，敬煩家長惠即裝入袋中，
                <br/>
                請於本月 <span style={{ textDecoration: 'underline' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> 日前繳交為荷！ □ 半日 □ 全日
              </div>
            </div>

            {/* 信封下半部：收費表格 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #b91c1c', textAlign: 'center' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #b91c1c' }}>
                  <th style={{ borderRight: '1px solid #b91c1c', padding: '4px', width: '15%' }}>月 份</th>
                  <th style={{ borderRight: '1px solid #b91c1c', padding: '4px', width: '15%' }}>月 費</th>
                  <th style={{ borderRight: '1px solid #b91c1c', padding: '4px', width: '15%' }}>交通費</th>
                  <th style={{ borderRight: '1px solid #b91c1c', padding: '4px', width: '15%' }}>才藝費</th>
                  <th style={{ borderRight: '1px solid #b91c1c', padding: '4px', width: '15%' }}>合 計</th>
                  <th style={{ borderRight: '1px solid #b91c1c', padding: '4px', width: '10%' }}>
                    <div style={{ borderBottom: '1px solid #b91c1c' }}>月</div>
                    <div>日</div>
                  </th>
                  <th style={{ padding: '4px', width: '15%' }}>收款簽章</th>
                </tr>
              </thead>
              <tbody style={{ color: '#000' }}>
                {/* 第一列印出當月收費資訊 */}
                <tr style={{ borderBottom: '1px solid #b91c1c', height: '1.2cm' }}>
                  <td style={{ borderRight: '1px solid #b91c1c' }}>{cycle?.name}</td>
                  <td style={{ borderRight: '1px solid #b91c1c' }}>{record.amount_due}</td>
                  <td style={{ borderRight: '1px solid #b91c1c' }}></td>
                  <td style={{ borderRight: '1px solid #b91c1c' }}></td>
                  <td style={{ borderRight: '1px solid #b91c1c' }}>{record.amount_due}</td>
                  <td style={{ borderRight: '1px solid #b91c1c' }}></td>
                  <td></td>
                </tr>
                {/* 預留幾行空白格，符合原本信封設計 */}
                {[1, 2, 3, 4].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid #b91c1c', height: '0.8cm' }}>
                    <td style={{ borderRight: '1px solid #b91c1c', color: '#b91c1c' }}>月</td>
                    <td style={{ borderRight: '1px solid #b91c1c' }}></td>
                    <td style={{ borderRight: '1px solid #b91c1c' }}></td>
                    <td style={{ borderRight: '1px solid #b91c1c' }}></td>
                    <td style={{ borderRight: '1px solid #b91c1c' }}></td>
                    <td style={{ borderRight: '1px solid #b91c1c' }}></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>
              ※ 備註：本收費袋經收款人簽章後代為收據。
            </div>

          </div>
        ))}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            background: white !important;
          }
          .print-area {
            background: white !important;
            padding: 0 !important;
          }
          .envelope-page {
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always; /* 每印完一個信封就強迫換頁 */
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
          }
        }
      `}} />
    </div>
  );
};

export default PrintEnvelope;

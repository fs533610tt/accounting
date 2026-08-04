import React, { useState, useCallback } from 'react';

// #10 信封標準尺寸
const PAPER_W_MM = 241;
const PAPER_H_MM = 105;
const HEADER_TOP = '1.0cm';
const TABLE_TOP = '2.2cm';
const CONTENT_LEFT = '2.0cm';
const PRINT_ROW_NUMBERS = [1, 2, 3, 4, 5, 6];

const formatPrintAmount = (amount) => Number(amount || 0).toLocaleString('zh-TW');

const getPrintableItemGroups = (record) => {
  const items = [...(record.billing_record_items || [])]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  if (items.length === 0 && Number(record.amount_due) !== 0) {
    return [[{ name: '月費', amount: record.amount_due }], [], [], [], []];
  }

  return [
    items.slice(0, 1),
    items.slice(1, 2),
    items.slice(2, 3),
    items.slice(3, 4),
    items.slice(4)
  ];
};

const PrintEnvelope = ({ cycle, records, onClose }) => {
  const [printMode, setPrintMode] = useState('frame');
  const [targetRow, setTargetRow] = useState(1);
  const [rotate180, setRotate180] = useState(false);
  const shouldPrintName = printMode === 'frame';
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);

  const parseMonth = (name) => {
    if (!name) return '';
    const s = String(name);
    const m = s.match(/(\d+)月/);
    if (m) return m[1];
    const nums = s.match(/(\d+)/g);
    if (nums) return nums[nums.length - 1];
    return s.length > 2 ? s.substring(0, 2) : s;
  };

  const [printMonth, setPrintMonth] = useState(() => {
    const defaultName = cycle?.name || (records && records.length > 0 && records[0].billing_cycles?.name) || '8';
    return parseMonth(defaultName);
  });

  // 產生單一信封的 HTML
  const buildEnvelopeHtml = useCallback((record) => {
    const groups = getPrintableItemGroups(record);
    const name = record.students?.name || '';
    const total = formatPrintAmount(record.amount_due);

    const headerCols = ['月份', '費用1', '費用2', '費用3', '費用4', '費用5', '合計', '<div style="display:flex;flex-direction:column;width:100%;height:100%"><div class="envelope-date-top" style="flex:1;display:flex;align-items:center;justify-content:center">月</div><div style="flex:1;display:flex;align-items:center;justify-content:center">日</div></div>', '收款簽章'];

    let gridCells = headerCols.map(h =>
      `<div class="gc hdr">${h}</div>`
    ).join('');

    for (let rowNum = 1; rowNum <= 6; rowNum++) {
      const isTarget = rowNum === targetRow;
      const cls = isTarget ? 'gc val' : 'gc empty';

      // 月份格
      gridCells += `<div class="${cls}">${isTarget ? `<span style="font-size:1.3rem;font-weight:bold">${printMonth}</span>` : ''}</div>`;

      // 五個費用格
      groups.forEach((items) => {
        if (!isTarget || items.length === 0) {
          gridCells += `<div class="${cls}"></div>`;
        } else if (items.length === 1) {
          gridCells += `<div class="${cls}"><div style="line-height:1.05;overflow:hidden"><div style="font-size:0.62rem;white-space:nowrap">${items[0].name}</div><div style="font-size:1rem;white-space:nowrap">${formatPrintAmount(items[0].amount)}</div></div></div>`;
        } else {
          const inner = items.map(it => `<div style="font-size:0.5rem;white-space:nowrap">${it.name} ${formatPrintAmount(it.amount)}</div>`).join('');
          gridCells += `<div class="${cls}"><div style="line-height:1.05;overflow:hidden">${inner}</div></div>`;
        }
      });

      // 合計
      gridCells += `<div class="${cls}">${isTarget ? `<span style="white-space:nowrap">${total}</span>` : ''}</div>`;
      // 月日 + 收款簽章
      gridCells += `<div class="${cls}"></div><div class="${cls}"></div>`;
    }

    const textOnlyClass = printMode === 'text-only' ? 'text-only' : '';
    const showName = shouldPrintName ? `<span class="dyn" style="display:inline-block;width:5.2cm;text-align:center">${name}</span>` : '';

    const contentTransform = rotate180
      ? `transform: rotate(180deg) translate(${-offsetX}mm, ${-offsetY}mm) scale(${scale}); transform-origin: center center;`
      : (offsetX || offsetY || scale !== 1)
        ? `transform: translate(${offsetX}mm, ${offsetY}mm) scale(${scale}); transform-origin: top left;`
        : '';

    const headerHtml = printMode === 'text-only' ? '' : `
          <div class="header">
            <div class="stat" style="position:absolute;left:0;bottom:0;font-size:1.1rem;font-weight:bold">
              姓 名 ${showName}
            </div>
            <div class="stat" style="position:absolute;right:0;bottom:0;font-size:0.75rem;width:11cm;line-height:1.3;text-align:left">
              貴子弟下列月份應繳學費，敬煩家長惠即裝入袋中，<br/>
              請於本月 <span class="uline date-blank"></span> 日前繳交為荷！ □ 半日 □ 全日
            </div>
          </div>`;

    const footerHtml = printMode === 'text-only' ? '' : `
          <div class="stat footer">※ 備註：本收費袋經收款人簽章後代為收據。</div>`;

    return `
      <div class="page ${textOnlyClass}">
        <div class="content" style="${contentTransform}">
          ${headerHtml}
          <div class="grid">${gridCells}</div>
          ${footerHtml}
        </div>
      </div>`;
  }, [printMode, shouldPrintName, targetRow, printMonth, rotate180, offsetX, offsetY, scale]);

  // iframe 列印法：將列印內容寫入獨立 iframe，完全隔離主頁 CSS
  const handlePrint = useCallback(() => {
    setIsPrinting(true);

    const allPages = records.map(r => buildEnvelopeHtml(r)).join('\n');

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>學費袋列印</title>
<style>
  @page {
    margin: 0;
    size: ${PAPER_W_MM}mm ${PAPER_H_MM}mm;
  }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #fff;
    width: ${PAPER_W_MM}mm;
    font-family: "標楷體", "DFKai-SB", serif;
    color: #b91c1c;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: ${PAPER_W_MM}mm;
    height: ${PAPER_H_MM}mm;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  .content {
    position: absolute;
    top: 0; left: 0;
    width: ${PAPER_W_MM}mm;
    height: ${PAPER_H_MM}mm;
  }

  .header {
    position: absolute;
    top: ${HEADER_TOP};
    left: ${CONTENT_LEFT};
    right: 1.5cm;
    height: 0.8cm;
  }

  .grid {
    position: absolute;
    top: ${TABLE_TOP};
    left: ${CONTENT_LEFT};
    width: 18.9cm;
    height: 6.5cm;
    display: grid;
    grid-template-columns: 1.3cm repeat(5, 2.25cm) 2.5cm 1.2cm 2.65cm;
    grid-template-rows: 0.8cm repeat(6, 0.95cm);
    border: 1px solid #b91c1c;
    overflow: hidden;
  }

  .gc {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-right: 1px solid #b91c1c;
    border-bottom: 1px solid #b91c1c;
    text-align: center;
    line-height: 1;
    min-width: 0;
    min-height: 0;
  }
  .gc:nth-child(9n) { border-right: none; }
  .gc:nth-last-child(-n+9) { border-bottom: none; }

  .hdr { font-size: 0.75rem; }
  .val { color: #000; }
  .stat { color: #b91c1c; }
  .dyn { color: #000; }
  .uline { text-decoration: underline; }
  .date-blank { display: inline-block; width: 1.5cm; }
  .footer {
    position: absolute;
    top: 9.0cm;
    left: ${CONTENT_LEFT};
    font-size: 0.75rem;
  }

  .envelope-date-top { border-bottom: 1px solid #b91c1c; width: 100%; }

  /* 套印模式：隱藏框線與紅字 */
  .text-only .stat,
  .text-only .hdr,
  .text-only .empty { color: transparent; }
  .text-only .grid,
  .text-only .gc,
  .text-only .envelope-date-top { border-color: transparent !important; }
  .text-only .uline { text-decoration: none !important; display: none !important; }
  .text-only .val { color: #000; }
  .text-only .dyn { color: #000; }
</style>
</head>
<body>
${allPages}
</body>
</html>`;

    // 建立隱形 iframe
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();

    // 等 iframe 內容渲染完成後列印
    iframe.contentWindow.onafterprint = () => {
      document.body.removeChild(iframe);
      setIsPrinting(false);
    };

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      // fallback: 如果 onafterprint 沒有觸發 (某些瀏覽器)
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        setIsPrinting(false);
      }, 60000);
    }, 300);
  }, [records, buildEnvelopeHtml]);

  // ===================== 螢幕預覽用的元件 =====================
  const renderPreviewEnvelope = (record) => {
    const groups = getPrintableItemGroups(record);

    return (
      <div
        key={record.id}
        style={{
          width: `${PAPER_W_MM}mm`,
          height: `${PAPER_H_MM}mm`,
          background: '#fff',
          position: 'relative',
          boxSizing: 'border-box',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          fontFamily: '"標楷體", "DFKai-SB", serif',
          color: '#b91c1c',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${PAPER_W_MM}mm`, height: `${PAPER_H_MM}mm`,
          transform: rotate180
            ? `rotate(180deg) translate(${-offsetX}mm, ${-offsetY}mm) scale(${scale})`
            : (offsetX || offsetY || scale !== 1)
              ? `translate(${offsetX}mm, ${offsetY}mm) scale(${scale})`
              : undefined,
          transformOrigin: rotate180 ? 'center center' : 'top left',
          boxSizing: 'border-box'
        }}>
          {/* 信封上半部 */}
          {printMode !== 'text-only' && (
            <div style={{ position: 'absolute', top: HEADER_TOP, left: CONTENT_LEFT, right: '1.5cm', height: '0.8cm' }}>
              <div className="static-text" style={{ position: 'absolute', left: 0, bottom: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>
                姓 名 <span className="dynamic-text" style={{ display: 'inline-block', width: '5.2cm', textAlign: 'center', color: shouldPrintName ? '#000' : 'transparent' }}>{shouldPrintName ? record.students?.name : ''}</span>
              </div>
              <div className="static-text" style={{ position: 'absolute', right: 0, bottom: 0, fontSize: '0.75rem', width: '11cm', lineHeight: '1.3', textAlign: 'left' }}>
                貴子弟下列月份應繳學費，敬煩家長惠即裝入袋中，<br />
                請於本月 <span className="date-blank"></span> 日前繳交為荷！ □ 半日 □ 全日
              </div>
            </div>
          )}

          {/* 表格 */}
          <div style={{
            position: 'absolute', top: TABLE_TOP, left: CONTENT_LEFT, width: '18.9cm', height: '6.5cm',
            display: 'grid',
            gridTemplateColumns: '1.3cm repeat(5, 2.25cm) 2.5cm 1.2cm 2.65cm',
            gridTemplateRows: '0.8cm repeat(6, 0.95cm)',
            border: printMode === 'text-only' ? '1px dashed #e2e8f0' : '1px solid #b91c1c',
            boxSizing: 'border-box', overflow: 'hidden'
          }}>
            {['月份', '費用1', '費用2', '費用3', '費用4', '費用5', '合計'].map(t => (
              <div key={t} className={`envelope-grid-cell ${printMode === 'text-only' ? 'preview-text-only-hdr' : 'static-text'}`}>{printMode === 'text-only' ? '' : t}</div>
            ))}
            <div className={`envelope-grid-cell ${printMode === 'text-only' ? 'preview-text-only-hdr' : 'static-text'} envelope-date-header`}>
              {printMode !== 'text-only' && <><div>月</div><div>日</div></>}
            </div>
            <div className={`envelope-grid-cell ${printMode === 'text-only' ? 'preview-text-only-hdr' : 'static-text'}`}>{printMode === 'text-only' ? '' : '收款簽章'}</div>

            {PRINT_ROW_NUMBERS.flatMap(rowNum => {
              const isTarget = rowNum === targetRow;
              const cls = `${isTarget ? 'envelope-grid-cell dynamic-text' : 'envelope-grid-cell static-text'} ${printMode === 'text-only' ? 'preview-text-only-hdr' : ''}`;
              const cells = [
                <div key={`m-${rowNum}`} className={cls}>
                  {isTarget && <span style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{printMonth}</span>}
                </div>
              ];
              groups.forEach((items, gi) => {
                cells.push(
                  <div key={`i-${rowNum}-${gi}`} className={cls}>
                    {isTarget && items.map(item => (
                      <div key={item.id || `${item.name}-${item.amount}`} style={{ lineHeight: 1.05, overflow: 'hidden' }}>
                        <div style={{ fontSize: items.length > 1 ? '0.5rem' : '0.62rem', whiteSpace: 'nowrap' }}>
                          {items.length > 1 ? `${item.name} ${formatPrintAmount(item.amount)}` : item.name}
                        </div>
                        {items.length === 1 && <div style={{ fontSize: '1rem', whiteSpace: 'nowrap' }}>{formatPrintAmount(item.amount)}</div>}
                      </div>
                    ))}
                  </div>
                );
              });
              cells.push(
                <div key={`t-${rowNum}`} className={cls}>{isTarget && <span style={{ whiteSpace: 'nowrap' }}>{formatPrintAmount(record.amount_due)}</span>}</div>,
                <div key={`d-${rowNum}`} className={cls}></div>,
                <div key={`s-${rowNum}`} className={cls}></div>
              );
              return cells;
            })}
          </div>

          {printMode !== 'text-only' && (
            <div className="static-text" style={{ position: 'absolute', top: '9.0cm', left: CONTENT_LEFT, fontSize: '0.75rem' }}>
              ※ 備註：本收費袋經收款人簽章後代為收據。
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%' }}>
      {/* 操作面板 */}
      <div style={{
        background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px',
        marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px'
      }}>
        <h2 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🖨️ 學費袋列印預覽（{records.length} 人）
        </h2>

        <div style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', padding: '12px 16px', borderRadius: '8px', color: '#fca5a5', fontSize: '0.95rem', lineHeight: '1.5' }}>
          <strong style={{ color: '#f87171', fontSize: '1rem' }}>⚠️ 列印設定提示：</strong><br />
          系統會自動開啟列印視窗。請在印表機對話框中確認：<br />
          1. <strong>紙張大小</strong>：選擇「<strong>信封 #10</strong>」(241 × 105 mm)。<br />
          2. <strong>邊界</strong>：設為「<strong>無 (None)</strong>」。<br />
          3. <strong>縮放</strong>：設為「<strong>100%</strong>」或「<strong>預設</strong>」。
        </div>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 15px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ color: '#ccc', fontSize: '0.95rem' }}>列印內容：</label>
            <select value={printMode} onChange={e => setPrintMode(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', background: '#1a1a2e', color: 'white', border: '1px solid rgba(255,255,255,0.2)', outline: 'none' }}>
              <option value="frame">列印外框＋姓名（空白 #10 信封）</option>
              <option value="text-only">只列印費用資料（套印現有信封）</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ color: '#ccc', fontSize: '0.95rem' }}>費用寫在第幾列：</label>
            <select value={targetRow} onChange={e => setTargetRow(Number(e.target.value))} style={{ padding: '6px 12px', borderRadius: '6px', background: '#1a1a2e', color: 'white', border: '1px solid rgba(255,255,255,0.2)', outline: 'none' }}>
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>第 {n} 格</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ color: '#ccc', fontSize: '0.95rem' }}>套印月份：</label>
            <input type="text" value={printMonth} onChange={e => setPrintMonth(e.target.value)} style={{ padding: '6px', borderRadius: '6px', background: '#1a1a2e', color: 'white', border: '1px solid rgba(255,255,255,0.2)', outline: 'none', width: '50px', textAlign: 'center' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ color: '#ccc', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={rotate180} onChange={e => setRotate180(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              旋轉 180°
            </label>
          </div>
        </div>

        {/* 微調 */}
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 15px', borderRadius: '8px' }}>
          <div style={{ color: '#fbbf24', fontSize: '0.9rem', width: '100%' }}>※ 微調位置偏差：</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '1 1 200px' }}>
            <label style={{ color: '#ccc', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>↔️ 左右 ({offsetX > 0 ? '+' : ''}{offsetX}mm):</label>
            <input type="range" min="-50" max="50" value={offsetX} onChange={e => setOffsetX(Number(e.target.value))} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '1 1 200px' }}>
            <label style={{ color: '#ccc', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>↕️ 上下 ({offsetY > 0 ? '+' : ''}{offsetY}mm):</label>
            <input type="range" min="-50" max="50" value={offsetY} onChange={e => setOffsetY(Number(e.target.value))} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: '1 1 200px' }}>
            <label style={{ color: '#ccc', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>🔍 縮放 ({Math.round(scale * 100)}%):</label>
            <input type="range" min="0.8" max="1.2" step="0.01" value={scale} onChange={e => setScale(Number(e.target.value))} style={{ flex: 1 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="btn-primary"
            style={{ flex: '1 1 200px', padding: '12px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', margin: 0, opacity: isPrinting ? 0.6 : 1 }}
          >
            {isPrinting ? '⏳ 準備列印中...' : '🖨️ 開始列印'}
          </button>
          <button onClick={onClose} style={{ flex: '1 1 150px', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#ccc', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', margin: 0 }}>
            取消並返回
          </button>
        </div>
      </div>

      {/* 螢幕預覽 */}
      <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', minWidth: 'fit-content' }}>
          {records.map(r => renderPreviewEnvelope(r))}
        </div>
      </div>

      {/* 預覽區域的共用 CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        .envelope-grid-cell {
          min-width: 0; min-height: 0;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          border-right: 1px solid #b91c1c;
          border-bottom: 1px solid #b91c1c;
          box-sizing: border-box;
          text-align: center; line-height: 1;
        }
        .envelope-grid-cell:nth-child(9n) { border-right: none; }
        .envelope-grid-cell:nth-last-child(-n+9) { border-bottom: none; }
        .envelope-date-header { flex-direction: column; gap: 0; }
        .envelope-date-header > div:first-child { width: 100%; border-bottom: 1px solid #b91c1c; }

        .preview-text-only-hdr {
          border-color: transparent !important;
        }
        .text-only-preview-cell {
          border-color: rgba(0, 0, 0, 0.05) !important;
        }
      `}} />
    </div>
  );
};

export default PrintEnvelope;

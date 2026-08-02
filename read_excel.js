const XLSX = require('xlsx');
const fs = require('fs');

const files = [
    'c:\\Marco\\作帳\\docs\\日記帳\\115年日記帳.xlsx',
    'c:\\Marco\\作帳\\docs\\收支月報表\\115年收支月報表.xlsx',
    'c:\\Marco\\作帳\\docs\\桌球隊收費表\\桌球隊收費表-115年.xlsx'
];

files.forEach(f => {
    try {
        console.log('File:', f);
        const workbook = XLSX.readFile(f);
        workbook.SheetNames.forEach(sheetName => {
            console.log('  Sheet:', sheetName);
            const worksheet = workbook.Sheets[sheetName];
            // get top 5 rows
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            for (let i = 0; i < Math.min(5, data.length); i++) {
                console.log(`    Row ${i}:`, data[i]);
            }
        });
    } catch (e) {
        console.log('Error reading', f, e.message);
    }
});

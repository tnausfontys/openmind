// apps/web/src/lib/excel-parser/hyperlink-extractor.ts
// AGPLv3 — OpenMind Collective

import * as XLSX from 'xlsx';

export interface Hyperlink {
  row: number;
  column: string;
  text: string;
  url: string;
  topic?: string;
  week?: string;
  whoInitiates?: string;
}

export interface WorkshopRow {
  week: string;
  topic: string;
  whoInitiates: string;
  linkText: string;
  linkUrl: string | null;
}

export async function extractWorkshopPlan(file: File): Promise<WorkshopRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with raw cell data
  const jsonData = XLSX.utils.sheet_to_json(sheet, { 
    header: ['week', 'topic', 'whoInitiates', 'linkText'],
    range: 1 // Skip header row
  });

  const rows: WorkshopRow[] = [];
  
  // Extract hyperlinks from column D
  for (const cell in sheet) {
    // Column D cells start with 'D'
    if (cell.startsWith('D') && cell !== 'D1') {
      const rowNum = parseInt(cell.substring(1));
      const hyperlink = sheet[cell].l;
      const cellText = sheet[cell].w || sheet[cell].v || '';
      
      // Find corresponding row data
      const rowData = jsonData[rowNum - 2] as any;
      
      rows[rowNum - 2] = {
        week: rowData?.week?.toString() || '',
        topic: rowData?.topic || '',
        whoInitiates: rowData?.whoInitiates || '',
        linkText: cellText,
        linkUrl: hyperlink?.Target || null
      };
    }
  }
  
  // Filter out empty rows
  return rows.filter(row => row.topic || row.linkText);
}

/**
 * Usage in component:
 * 
 * const handleFileUpload = async (file) => {
 *   const workshopData = await extractWorkshopPlan(file);
 *   // workshopData[0].linkUrl -> the actual hyperlink! 🎉
 * };
 */

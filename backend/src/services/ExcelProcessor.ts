import * as XLSX from 'xlsx';
import { ExcelData, NEISProcessedData } from '../types/validation';
import { NEISExcelProcessor, NEISStudentRecord } from './NEISExcelProcessor';

export class ExcelProcessor {
  async processFile(buffer: Buffer, fileName: string): Promise<ExcelData> {
    try {
      console.log(`📁 Processing file: ${fileName}`);
      
      // Read the Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });
      
      // First, convert to generic format for format detection
      const genericData = this.convertToGenericFormat(workbook, buffer.length, fileName);
      
      // Check if this is a NEIS format file
      const isNEIS = this.detectNEISFormat(genericData);
      console.log(`🔍 Detected format: ${isNEIS ? 'NEIS' : 'Generic'}`);
      
      if (isNEIS) {
        // Process as NEIS format
        const neisProcessor = new NEISExcelProcessor();
        const neisRecords = await neisProcessor.processNEISFile(buffer, fileName);
        
        return {
          ...genericData,
          format: 'neis',
          neisData: {
            students: neisRecords,
            metadata: {
              processingDate: new Date(),
              totalStudents: neisRecords.length,
              totalSections: neisRecords.reduce((total, record) => total + Object.keys(record.sections).length, 0),
              detectedFormat: 'NEIS',
            }
          }
        };
      } else {
        // Process as generic Excel file
        return {
          ...genericData,
          format: 'generic'
        };
      }
      
    } catch (error) {
      console.error('Excel processing error:', error);
      throw new Error(`Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert workbook to generic format for compatibility
   */
  private convertToGenericFormat(workbook: XLSX.WorkBook, fileSize: number, fileName: string): ExcelData {
    const excelData: ExcelData = {
      sheets: {},
      fileName,
      fileSize
    };

    // Process each worksheet
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) return;

      // Get the range of cells in the worksheet
      const range = worksheet['!ref'];
      if (!range) return;

      // Convert to 2D array with proper indexing
      const data: any[][] = [];
      const decodedRange = XLSX.utils.decode_range(range);
      
      for (let R = decodedRange.s.r; R <= decodedRange.e.r; ++R) {
        const row: any[] = [];
        for (let C = decodedRange.s.c; C <= decodedRange.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
          const cell = worksheet[cellAddress];
          
          if (cell) {
            // Handle different cell types
            let cellValue = '';
            
            if (cell.t === 'n') { // Number
              cellValue = String(cell.v);
            } else if (cell.t === 's') { // String
              cellValue = String(cell.v);
            } else if (cell.t === 'b') { // Boolean
              cellValue = cell.v ? 'TRUE' : 'FALSE';
            } else if (cell.t === 'd') { // Date
              cellValue = cell.v instanceof Date ? cell.v.toISOString().split('T')[0] : String(cell.v);
            } else {
              cellValue = String(cell.v || '');
            }
            
            row[C] = cellValue;
          } else {
            row[C] = '';
          }
        }
        data[R] = row;
      }

      excelData.sheets[sheetName] = {
        data,
        range
      };
    });

    return excelData;
  }

  /**
   * Detect if this is a NEIS format file
   */
  private detectNEISFormat(excelData: ExcelData): boolean {
    // Check if any sheet contains NEIS-specific keywords
    for (const [sheetName, sheet] of Object.entries(excelData.sheets)) {
      if (NEISExcelProcessor.isNEISFormat(sheet.data)) {
        return true;
      }
    }
    return false;
  }

  getCellReference(row: number, col: number): string {
    return XLSX.utils.encode_cell({ r: row, c: col });
  }

  getColumnLetter(col: number): string {
    let letter = '';
    while (col >= 0) {
      letter = String.fromCharCode(col % 26 + 65) + letter;
      col = Math.floor(col / 26) - 1;
    }
    return letter;
  }

  validateFileFormat(buffer: Buffer): boolean {
    try {
      XLSX.read(buffer, { type: 'buffer' });
      return true;
    } catch {
      return false;
    }
  }

  getFileInfo(buffer: Buffer, fileName: string): { isValid: boolean; info?: any; error?: string } {
    try {
      if (!this.validateFileFormat(buffer)) {
        return { isValid: false, error: 'Invalid Excel file format' };
      }

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      return {
        isValid: true,
        info: {
          fileName,
          fileSize: buffer.length,
          sheetCount: workbook.SheetNames.length,
          sheets: workbook.SheetNames,
          createdDate: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
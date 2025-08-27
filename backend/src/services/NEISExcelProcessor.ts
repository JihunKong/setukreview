import * as XLSX from 'xlsx';
import { ExcelData } from '../types/validation';

// NEIS (나이스) school record structure interfaces
export interface NEISStudentRecord {
  studentInfo: {
    name: string;
    studentNumber: string;
    class: string;
    grade: string;
    school: string;
    birthDate?: string;
    gender?: string;
  };
  sections: {
    학적사항?: NEISSectionData;
    출결상황?: NEISSectionData;
    수상경력?: NEISSectionData;
    자격증및인증취득상황?: NEISSectionData;
    창의적체험활동상황?: NEISSectionData;
    교과학습발달상황?: NEISSectionData;
    독서활동상황?: NEISSectionData;
    행동특성및종합의견?: NEISSectionData;
  };
  metadata: {
    recordType: 'NEIS';
    processingDate: Date;
    totalSections: number;
    totalDataCells: number;
  };
}

export interface NEISSectionData {
  title: string;
  startRow: number;
  endRow: number;
  data: string[][];
  headers: string[];
  contentRows: string[][];
}

export class NEISExcelProcessor {
  // NEIS format constants - hardcoded structure based on Korean school records
  private readonly NEIS_STRUCTURE = {
    // Student information is typically in the first few rows
    STUDENT_INFO: {
      NAME_ROW: 3,
      NAME_COL: 2,
      STUDENT_NUMBER_ROW: 3,
      STUDENT_NUMBER_COL: 5,
      CLASS_ROW: 3,
      CLASS_COL: 8,
      GRADE_ROW: 3,
      GRADE_COL: 10,
      SCHOOL_ROW: 1,
      SCHOOL_COL: 2,
    },
    
    // Section markers and their typical positions
    SECTION_MARKERS: {
      '학적사항': { startKeywords: ['학적사항', '학적 사항'], headerRow: 5, dataStartOffset: 2 },
      '출결상황': { startKeywords: ['출결상황', '출결 상황'], headerRow: null, dataStartOffset: 2 },
      '수상경력': { startKeywords: ['수상경력', '수상 경력'], headerRow: null, dataStartOffset: 2 },
      '자격증및인증취득상황': { startKeywords: ['자격증', '인증취득'], headerRow: null, dataStartOffset: 2 },
      '창의적체험활동상황': { startKeywords: ['창의적체험활동', '창의적 체험활동'], headerRow: null, dataStartOffset: 2 },
      '교과학습발달상황': { startKeywords: ['교과학습', '학습발달', '교과 학습'], headerRow: null, dataStartOffset: 2 },
      '독서활동상황': { startKeywords: ['독서활동', '독서 활동'], headerRow: null, dataStartOffset: 2 },
      '행동특성및종합의견': { startKeywords: ['행동특성', '종합의견'], headerRow: null, dataStartOffset: 2 },
    },

    // Common patterns to skip (headers, labels, etc.)
    SKIP_PATTERNS: [
      '※',
      '주)',
      '구분',
      '항목',
      '비고',
      '계',
      '합계',
      '총',
      '전체',
      '학년도',
      '학기',
      '기준일',
    ],

    // Validation context markers
    VALIDATION_CONTEXTS: {
      STUDENT_NAME: '학생명',
      INSTRUCTOR_NAME: '교사명',
      SCHOOL_NAME: '학교명',
      PERIOD: '기간',
      SUBJECT: '과목',
      ACTIVITY: '활동',
      AWARD: '상',
      CERTIFICATE: '자격증',
    }
  };

  /**
   * Process NEIS format Excel file
   */
  async processNEISFile(buffer: Buffer, fileName: string): Promise<NEISStudentRecord[]> {
    try {
      console.log(`📚 Processing NEIS file: ${fileName}`);
      
      const workbook = XLSX.read(buffer, { 
        type: 'buffer', 
        cellDates: true, 
        cellNF: false, 
        cellText: false 
      });
      
      const students: NEISStudentRecord[] = [];
      
      // Process each worksheet (typically one per student or class)
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        console.log(`📝 Processing sheet: ${sheetName}`);
        
        // Convert to 2D array for processing
        const data = this.worksheetToArray(worksheet);
        
        // Extract student records from the sheet
        const studentRecords = this.extractStudentRecords(data, sheetName);
        students.push(...studentRecords);
      }

      console.log(`👥 Found ${students.length} student records in NEIS file`);
      
      return students;
      
    } catch (error) {
      console.error('NEIS processing error:', error);
      throw new Error(`Failed to process NEIS file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert worksheet to 2D array
   */
  private worksheetToArray(worksheet: XLSX.WorkSheet): string[][] {
    const range = worksheet['!ref'];
    if (!range) return [];

    const decodedRange = XLSX.utils.decode_range(range);
    const data: string[][] = [];
    
    for (let R = decodedRange.s.r; R <= decodedRange.e.r; ++R) {
      const row: string[] = [];
      for (let C = decodedRange.s.c; C <= decodedRange.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
        const cell = worksheet[cellAddress];
        
        let cellValue = '';
        if (cell) {
          if (cell.t === 'n') { // Number
            cellValue = String(cell.v);
          } else if (cell.t === 's') { // String
            cellValue = String(cell.v).trim();
          } else if (cell.t === 'b') { // Boolean
            cellValue = cell.v ? 'TRUE' : 'FALSE';
          } else if (cell.t === 'd') { // Date
            cellValue = cell.v instanceof Date ? cell.v.toISOString().split('T')[0] : String(cell.v);
          } else {
            cellValue = String(cell.v || '').trim();
          }
        }
        
        row[C] = cellValue;
      }
      data[R] = row;
    }

    return data;
  }

  /**
   * Extract student records from sheet data
   */
  private extractStudentRecords(data: string[][], sheetName: string): NEISStudentRecord[] {
    const records: NEISStudentRecord[] = [];
    
    // Extract student information
    const studentInfo = this.extractStudentInfo(data);
    
    // Extract sections
    const sections = this.extractSections(data);
    
    // Create student record
    const record: NEISStudentRecord = {
      studentInfo,
      sections,
      metadata: {
        recordType: 'NEIS',
        processingDate: new Date(),
        totalSections: Object.keys(sections).length,
        totalDataCells: this.countDataCells(sections),
      }
    };

    records.push(record);
    
    return records;
  }

  /**
   * Extract student information from known positions
   */
  private extractStudentInfo(data: string[][]) {
    const info = this.NEIS_STRUCTURE.STUDENT_INFO;
    
    return {
      name: this.getCellValue(data, info.NAME_ROW, info.NAME_COL) || '미상',
      studentNumber: this.getCellValue(data, info.STUDENT_NUMBER_ROW, info.STUDENT_NUMBER_COL) || '',
      class: this.getCellValue(data, info.CLASS_ROW, info.CLASS_COL) || '',
      grade: this.getCellValue(data, info.GRADE_ROW, info.GRADE_COL) || '',
      school: this.getCellValue(data, info.SCHOOL_ROW, info.SCHOOL_COL) || '',
    };
  }

  /**
   * Extract all sections from the data
   */
  private extractSections(data: string[][]): NEISStudentRecord['sections'] {
    const sections: NEISStudentRecord['sections'] = {};
    
    // Find section markers and extract data
    for (const [sectionName, config] of Object.entries(this.NEIS_STRUCTURE.SECTION_MARKERS)) {
      const sectionData = this.extractSection(data, sectionName, config);
      if (sectionData) {
        sections[sectionName as keyof NEISStudentRecord['sections']] = sectionData;
      }
    }
    
    return sections;
  }

  /**
   * Extract a specific section from the data
   */
  private extractSection(
    data: string[][], 
    sectionName: string, 
    config: any
  ): NEISSectionData | null {
    
    // Find section start row
    const startRow = this.findSectionStart(data, config.startKeywords);
    if (startRow === -1) {
      console.warn(`Section '${sectionName}' not found in data`);
      return null;
    }

    // Find section end row (next section or end of data)
    const endRow = this.findSectionEnd(data, startRow);
    
    // Extract headers (usually 1-2 rows after section title)
    const headerRow = startRow + 1;
    const headers = data[headerRow] ? data[headerRow].filter(cell => cell && cell.trim()) : [];
    
    // Extract content rows (skip empty rows and headers)
    const contentStartRow = startRow + config.dataStartOffset;
    const contentRows: string[][] = [];
    
    for (let i = contentStartRow; i <= endRow; i++) {
      if (!data[i]) continue;
      
      const row = data[i];
      // Skip empty rows and header-like rows
      if (this.isContentRow(row)) {
        contentRows.push(row);
      }
    }

    return {
      title: sectionName,
      startRow,
      endRow,
      data: data.slice(startRow, endRow + 1),
      headers,
      contentRows,
    };
  }

  /**
   * Find the start row of a section based on keywords
   */
  private findSectionStart(data: string[][], keywords: string[]): number {
    for (let i = 0; i < data.length; i++) {
      if (!data[i]) continue;
      
      for (const row of [data[i]]) {
        for (const cell of row) {
          if (cell && typeof cell === 'string') {
            for (const keyword of keywords) {
              if (cell.includes(keyword)) {
                return i;
              }
            }
          }
        }
      }
    }
    return -1;
  }

  /**
   * Find the end row of a section
   */
  private findSectionEnd(data: string[][], startRow: number): number {
    // Look for next section or end of meaningful data
    for (let i = startRow + 1; i < data.length; i++) {
      if (!data[i]) continue;
      
      // Check if this row starts a new section
      const row = data[i];
      for (const cell of row) {
        if (cell && typeof cell === 'string') {
          for (const [sectionName, config] of Object.entries(this.NEIS_STRUCTURE.SECTION_MARKERS)) {
            for (const keyword of config.startKeywords) {
              if (cell.includes(keyword)) {
                return i - 1;
              }
            }
          }
        }
      }
    }
    
    // If no next section found, return reasonable end
    return Math.min(startRow + 50, data.length - 1);
  }

  /**
   * Check if a row contains actual content (not headers or empty)
   */
  private isContentRow(row: string[]): boolean {
    if (!row || row.length === 0) return false;
    
    const nonEmptyCount = row.filter(cell => cell && cell.trim()).length;
    if (nonEmptyCount === 0) return false;
    
    // Check for skip patterns
    const rowText = row.join(' ').toLowerCase();
    for (const pattern of this.NEIS_STRUCTURE.SKIP_PATTERNS) {
      if (rowText.includes(pattern.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get cell value safely
   */
  private getCellValue(data: string[][], row: number, col: number): string {
    if (!data[row] || !data[row][col]) return '';
    return data[row][col].toString().trim();
  }

  /**
   * Count total data cells in all sections
   */
  private countDataCells(sections: NEISStudentRecord['sections']): number {
    let count = 0;
    for (const section of Object.values(sections)) {
      if (section) {
        count += section.contentRows.flat().filter(cell => cell && cell.trim()).length;
      }
    }
    return count;
  }

  /**
   * Detect if a file is NEIS format
   */
  static isNEISFormat(data: string[][]): boolean {
    if (!data || data.length < 5) return false;
    
    // Look for NEIS-specific keywords in first few rows
    const searchText = data.slice(0, 10)
      .flat()
      .join(' ')
      .toLowerCase();
    
    const neisKeywords = [
      '학적사항', '출결상황', '수상경력', '창의적체험활동',
      '교과학습', '독서활동', '행동특성', '종합의견',
      '나이스', 'neis', '학교', '학생'
    ];
    
    let keywordCount = 0;
    for (const keyword of neisKeywords) {
      if (searchText.includes(keyword)) {
        keywordCount++;
      }
    }
    
    // If we find at least 3 NEIS keywords, consider it NEIS format
    return keywordCount >= 3;
  }
}
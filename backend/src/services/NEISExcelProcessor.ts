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
   * Extract student information using dynamic keyword-based search
   */
  private extractStudentInfo(data: string[][]) {
    // Try dynamic extraction first, fallback to fixed positions
    const dynamicInfo = this.extractStudentInfoDynamically(data);
    const fixedInfo = this.extractStudentInfoFromFixedPositions(data);
    
    // Try alternative search methods for student name
    const alternativeName = this.findStudentNameAlternatively(data);
    
    return {
      name: dynamicInfo.name || fixedInfo.name || alternativeName || '미상',
      studentNumber: dynamicInfo.studentNumber || fixedInfo.studentNumber || '',
      class: dynamicInfo.class || fixedInfo.class || '',
      grade: dynamicInfo.grade || fixedInfo.grade || '',
      school: dynamicInfo.school || fixedInfo.school || '',
    };
  }

  /**
   * Extract student information from fixed positions (original method)
   */
  private extractStudentInfoFromFixedPositions(data: string[][]) {
    const info = this.NEIS_STRUCTURE.STUDENT_INFO;
    
    return {
      name: this.getCellValue(data, info.NAME_ROW, info.NAME_COL),
      studentNumber: this.getCellValue(data, info.STUDENT_NUMBER_ROW, info.STUDENT_NUMBER_COL),
      class: this.getCellValue(data, info.CLASS_ROW, info.CLASS_COL),
      grade: this.getCellValue(data, info.GRADE_ROW, info.GRADE_COL),
      school: this.getCellValue(data, info.SCHOOL_ROW, info.SCHOOL_COL),
    };
  }

  /**
   * Extract student information using keyword-based dynamic search
   */
  private extractStudentInfoDynamically(data: string[][]): any {
    const result: any = {};
    
    // Search in first 10 rows for student information
    for (let row = 0; row < Math.min(data.length, 10); row++) {
      if (!data[row]) continue;
      
      for (let col = 0; col < data[row].length; col++) {
        const cellValue = data[row][col];
        if (!cellValue || typeof cellValue !== 'string') continue;
        
        const cellText = cellValue.trim().toLowerCase();
        
        // Look for name indicators
        if (this.isNameIndicator(cellText)) {
          // Try adjacent cells for actual name
          const name = this.findAdjacentValue(data, row, col);
          if (name && this.isValidName(name)) {
            result.name = name;
          }
        }
        
        // Look for student number indicators  
        if (this.isStudentNumberIndicator(cellText)) {
          const studentNumber = this.findAdjacentValue(data, row, col);
          if (studentNumber && this.isValidStudentNumber(studentNumber)) {
            result.studentNumber = studentNumber;
          }
        }
        
        // Look for class indicators
        if (this.isClassIndicator(cellText)) {
          const classInfo = this.findAdjacentValue(data, row, col);
          if (classInfo) {
            result.class = classInfo;
          }
        }
        
        // Look for school name indicators
        if (this.isSchoolIndicator(cellText)) {
          const school = this.findAdjacentValue(data, row, col);
          if (school && school.length > 2) {
            result.school = school;
          }
        }
      }
    }
    
    return result;
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

  /**
   * Helper methods for dynamic student information extraction
   */
  private isNameIndicator(text: string): boolean {
    const nameIndicators = ['성명', '학생명', '이름', '학생이름', 'name'];
    return nameIndicators.some(indicator => text.includes(indicator));
  }

  private isStudentNumberIndicator(text: string): boolean {
    const numberIndicators = ['학번', '학적번호', '번호', 'id', 'number'];
    return numberIndicators.some(indicator => text.includes(indicator));
  }

  private isClassIndicator(text: string): boolean {
    const classIndicators = ['학급', '반', 'class'];
    return classIndicators.some(indicator => text.includes(indicator));
  }

  private isSchoolIndicator(text: string): boolean {
    const schoolIndicators = ['학교', '교명', 'school'];
    return schoolIndicators.some(indicator => text.includes(indicator));
  }

  private findAdjacentValue(data: string[][], row: number, col: number): string | null {
    // Check adjacent cells (right, below, left, above)
    const directions = [
      [0, 1],   // right
      [1, 0],   // below  
      [0, -1],  // left
      [-1, 0],  // above
    ];

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < data.length && newCol >= 0) {
        const value = this.getCellValue(data, newRow, newCol);
        if (value && value.trim() && !this.isIndicatorText(value)) {
          return value.trim();
        }
      }
    }

    return null;
  }

  private isIndicatorText(text: string): boolean {
    const indicators = ['성명', '학생명', '이름', '학번', '학급', '반', '학교', '교명'];
    const lowerText = text.toLowerCase();
    return indicators.some(indicator => lowerText.includes(indicator));
  }

  private isValidName(name: string): boolean {
    if (!name || !name.trim()) return false;
    
    const trimmed = name.trim();
    
    // Check if the name looks like a Korean name (2-5 Korean characters, allowing some flexibility)
    const koreanNamePattern = /^[가-힣]{2,5}$/;
    if (koreanNamePattern.test(trimmed)) return true;
    
    // Allow mixed Korean-English names or names with parentheses  
    const mixedNamePattern = /^[가-힣a-zA-Z\(\)\s]{2,10}$/;
    if (mixedNamePattern.test(trimmed) && /[가-힣]/.test(trimmed)) return true;
    
    // If it contains common non-name keywords, reject it
    const nonNameKeywords = ['학생', '성명', '이름', '번호', '학급', '반', '학교', '년', '월', '일'];
    if (nonNameKeywords.some(keyword => trimmed.includes(keyword))) return false;
    
    return false;
  }

  private isValidStudentNumber(number: string): boolean {
    // Check if it looks like a student number (contains digits)
    return /\d+/.test(number) && number.length >= 2;
  }

  /**
   * Alternative method to find student name by scanning common patterns
   */
  private findStudentNameAlternatively(data: string[][]): string | null {
    // Scan first 15 rows for potential names
    for (let row = 0; row < Math.min(data.length, 15); row++) {
      if (!data[row]) continue;
      
      for (let col = 0; col < Math.min(data[row].length, 10); col++) {
        const cellValue = data[row][col];
        if (!cellValue) continue;
        
        const trimmed = cellValue.trim();
        
        // Look for standalone Korean names (2-4 characters, no spaces)
        if (this.looksLikeStandaloneName(trimmed)) {
          return trimmed;
        }
        
        // Look for names in common patterns like "이름: 홍길동" or "학생명: 김철수"
        const nameMatch = trimmed.match(/(?:이름|학생명|성명|name)\s*[:：]\s*([가-힣]{2,5})/i);
        if (nameMatch && nameMatch[1]) {
          return nameMatch[1];
        }
        
        // Look for names in parentheses like "(홍길동)"
        const parenthesesMatch = trimmed.match(/\(([가-힣]{2,4})\)/);
        if (parenthesesMatch && parenthesesMatch[1] && this.isValidName(parenthesesMatch[1])) {
          return parenthesesMatch[1];
        }
      }
    }
    
    return null;
  }

  /**
   * Check if a text looks like a standalone Korean name
   */
  private looksLikeStandaloneName(text: string): boolean {
    if (!text || text.length < 2 || text.length > 5) return false;
    
    // Must be pure Korean characters
    if (!/^[가-힣]+$/.test(text)) return false;
    
    // Common non-name patterns to exclude
    const commonNonNames = [
      '학교', '학생', '학급', '학년', '학기', '선생', '담임', '교사', '과목',
      '국어', '영어', '수학', '과학', '사회', '음악', '미술', '체육',
      '월요', '화요', '수요', '목요', '금요', '토요', '일요',
      '오전', '오후', '시간', '분간', '년도', '학기', '반년',
      '출석', '결석', '지각', '조퇴', '수업', '시험', '평가'
    ];
    
    if (commonNonNames.includes(text)) return false;
    
    // Additional heuristics: Korean names typically don't repeat characters too much
    const charCount = text.split('').reduce((acc, char) => {
      acc[char] = (acc[char] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // If any character appears more than half the length, probably not a name
    const maxCount = Math.max(...Object.values(charCount));
    if (maxCount > Math.ceil(text.length / 2)) return false;
    
    return true;
  }
}
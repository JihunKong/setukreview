export interface ValidationError {
  id: string;
  type: 'korean_english' | 'institution_name' | 'grammar' | 'format' | 'ai_validation' | 'duplicate_detection' | 'attendance_duplicate' | 'cross_student_duplicate' | 'vba_alphabet' | 'date_pattern' | 'keyword_prohibition' | 'enhanced_duplicate' | 'spell_check' | 'sentence_duplicate' | 'reading_activity' | 'spacing_normalization';
  severity: 'error' | 'warning' | 'info';
  message: string;
  location: {
    sheet: string;
    row: number;
    column: string;
    cell: string;
  };
  originalText: string;
  suggestion?: string;
  rule: string;
  confidence?: number;
  // Duplicate-specific fields
  duplicateWith?: {
    location: string;
    studentName?: string;
    section?: string;
    similarity: number;
    matchedText: string;
    matchedWords?: string[];
  };
  // Highlighting fields for error location visualization
  highlightRange?: {
    start: number;    // Character position in originalText where error starts
    end: number;      // Character position in originalText where error ends
  };
  contextBefore?: string;   // Text context before the error (for better visualization)
  contextAfter?: string;    // Text context after the error (for better visualization)
  markedText?: string;      // HTML-formatted text with <mark> tags for highlighting
}

export interface ValidationResult {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  summary: {
    totalCells: number;
    checkedCells: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
  createdAt: Date;
  completedAt?: Date;
}

export interface ExcelData {
  sheets: {
    [sheetName: string]: {
      data: any[][];
      range: string;
    };
  };
  fileName: string;
  fileSize: number;
  format?: 'generic' | 'neis';
  neisData?: NEISProcessedData;
}

// NEIS-specific data structures
export interface NEISProcessedData {
  students: NEISStudentRecord[];
  metadata: {
    processingDate: Date;
    totalStudents: number;
    totalSections: number;
    detectedFormat: 'NEIS';
  };
}

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
    [sectionName: string]: NEISSectionData;
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

export interface ValidationRule {
  id: string;
  name: string;
  type: ValidationError['type'];
  severity: ValidationError['severity'];
  description: string;
  enabled: boolean;
  pattern?: RegExp;
  allowedValues?: string[];
  validate: (text: string, context: ValidationContext) => ValidationError | null;
}

export interface ValidationContext {
  sheet: string;
  row: number;
  column: string;
  cell: string;
  // Duplicate detection context
  studentName?: string;
  section?: string;
  adjacentCells?: {
    left?: string;
    right?: string;
    above?: string;
    below?: string;
  };
  neisContext?: {
    studentInfo: {
      name: string;
      studentNumber: string;
      class: string;
      grade: string;
      school: string;
    };
    sectionName: string;
    sectionType: string;
    isHeaderRow: boolean;
    isContentRow: boolean;
  };
}

export interface AIValidationRequest {
  text: string;
  context: string;
  rules: string[];
}

export interface AIValidationResponse {
  isValid: boolean;
  errors: Array<{
    type: string;
    message: string;
    confidence: number;
    suggestion?: string;
  }>;
}

export interface FileUploadResult {
  success: boolean;
  validationId?: string;
  error?: string;
}
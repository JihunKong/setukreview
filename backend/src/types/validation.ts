export interface ValidationError {
  id: string;
  type: 'korean_english' | 'institution_name' | 'grammar' | 'format' | 'ai_validation';
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
  adjacentCells?: {
    left?: string;
    right?: string;
    above?: string;
    below?: string;
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
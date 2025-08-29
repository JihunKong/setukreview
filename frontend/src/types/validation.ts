export interface ValidationError {
  id: string;
  type: 'korean_english' | 'institution_name' | 'grammar' | 'format' | 'ai_validation' | 'personal_info' | 'attendance';
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
  createdAt: string;
  completedAt?: string;
}

export interface FileUploadResult {
  success: boolean;
  validationId?: string;
  error?: string;
}

export interface ValidationStats {
  overview: ValidationResult['summary'];
  errorsByType: Record<string, number>;
  errorsBySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  processingTime: number | null;
  fileName: string;
  status: string;
  progress: number;
}
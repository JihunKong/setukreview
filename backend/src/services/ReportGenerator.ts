import * as XLSX from 'xlsx';
import { ValidationResult, ValidationError } from '../types/validation';

export class ReportGenerator {
  async generateExcelReport(result: ValidationResult): Promise<Buffer> {
    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['검증 보고서', ''],
        ['파일명', result.fileName],
        ['검증 ID', result.id],
        ['검증 시작', result.createdAt.toLocaleString('ko-KR')],
        ['검증 완료', result.completedAt?.toLocaleString('ko-KR') || 'N/A'],
        ['상태', result.status],
        ['', ''],
        ['검증 결과 요약', ''],
        ['총 셀 수', result.summary.totalCells],
        ['검사한 셀 수', result.summary.checkedCells],
        ['오류 수', result.summary.errorCount],
        ['경고 수', result.summary.warningCount],
        ['정보 수', result.summary.infoCount],
        ['', ''],
        ['오류 유형별 통계', ''],
      ];

      // Add error type statistics
      const errorTypes = ['korean_english', 'institution_name', 'grammar', 'format', 'ai_validation'];
      const allErrors = [...result.errors, ...result.warnings, ...result.info];
      
      errorTypes.forEach(type => {
        const count = allErrors.filter(error => error.type === type).length;
        const typeName = this.getTypeDisplayName(type);
        summaryData.push([typeName, count]);
      });

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '검증 요약');

      // Errors sheet
      if (result.errors.length > 0) {
        const errorHeaders = ['유형', '심각도', '위치', '시트', '행', '열', '셀', '오류 메시지', '원본 텍스트', '제안', '규칙', '신뢰도'];
        const errorData = [errorHeaders, ...result.errors.map(error => [
          this.getTypeDisplayName(error.type),
          this.getSeverityDisplayName(error.severity),
          `${error.location.sheet}!${error.location.cell}`,
          error.location.sheet,
          error.location.row,
          error.location.column,
          error.location.cell,
          error.message,
          error.originalText,
          error.suggestion || '',
          error.rule,
          error.confidence || ''
        ])];

        const errorSheet = XLSX.utils.aoa_to_sheet(errorData);
        XLSX.utils.book_append_sheet(workbook, errorSheet, '오류');
      }

      // Warnings sheet
      if (result.warnings.length > 0) {
        const warningHeaders = ['유형', '심각도', '위치', '시트', '행', '열', '셀', '경고 메시지', '원본 텍스트', '제안', '규칙'];
        const warningData = [warningHeaders, ...result.warnings.map(warning => [
          this.getTypeDisplayName(warning.type),
          this.getSeverityDisplayName(warning.severity),
          `${warning.location.sheet}!${warning.location.cell}`,
          warning.location.sheet,
          warning.location.row,
          warning.location.column,
          warning.location.cell,
          warning.message,
          warning.originalText,
          warning.suggestion || '',
          warning.rule
        ])];

        const warningSheet = XLSX.utils.aoa_to_sheet(warningData);
        XLSX.utils.book_append_sheet(workbook, warningSheet, '경고');
      }

      // Info sheet
      if (result.info.length > 0) {
        const infoHeaders = ['유형', '위치', '시트', '행', '열', '셀', '정보 메시지', '원본 텍스트', '규칙'];
        const infoData = [infoHeaders, ...result.info.map(info => [
          this.getTypeDisplayName(info.type),
          `${info.location.sheet}!${info.location.cell}`,
          info.location.sheet,
          info.location.row,
          info.location.column,
          info.location.cell,
          info.message,
          info.originalText,
          info.rule
        ])];

        const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
        XLSX.utils.book_append_sheet(workbook, infoSheet, '정보');
      }

      // Convert to buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return buffer;

    } catch (error) {
      console.error('Excel report generation error:', error);
      throw new Error(`Failed to generate Excel report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateCSVReport(result: ValidationResult): Promise<string> {
    try {
      const lines: string[] = [];

      // Header
      lines.push('유형,심각도,위치,시트,행,열,셀,메시지,원본텍스트,제안,규칙,신뢰도');

      // All errors, warnings, and info
      const allItems = [
        ...result.errors.map(item => ({ ...item, category: '오류' })),
        ...result.warnings.map(item => ({ ...item, category: '경고' })),
        ...result.info.map(item => ({ ...item, category: '정보' }))
      ];

      allItems.forEach(item => {
        const row = [
          this.getTypeDisplayName(item.type),
          this.getSeverityDisplayName(item.severity),
          `${item.location.sheet}!${item.location.cell}`,
          item.location.sheet,
          item.location.row,
          item.location.column,
          item.location.cell,
          this.escapeCsvField(item.message),
          this.escapeCsvField(item.originalText),
          this.escapeCsvField(item.suggestion || ''),
          item.rule,
          item.confidence || ''
        ];
        lines.push(row.join(','));
      });

      return lines.join('\n');

    } catch (error) {
      console.error('CSV report generation error:', error);
      throw new Error(`Failed to generate CSV report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getTypeDisplayName(type: string): string {
    const typeNames: Record<string, string> = {
      korean_english: '한글/영문 입력 규칙',
      institution_name: '기관명 입력 규칙',
      grammar: '문법 검사',
      format: '형식 검사',
      ai_validation: 'AI 검증'
    };
    return typeNames[type] || type;
  }

  private getSeverityDisplayName(severity: string): string {
    const severityNames: Record<string, string> = {
      error: '오류',
      warning: '경고',
      info: '정보'
    };
    return severityNames[severity] || severity;
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
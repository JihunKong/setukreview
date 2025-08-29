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

  /**
   * Generate batch Excel report combining multiple validation results
   */
  async generateBatchExcelReport(results: ValidationResult[]): Promise<Buffer> {
    try {
      const workbook = XLSX.utils.book_new();

      // Batch Summary sheet
      const summaryData = [
        ['일괄 검증 보고서', ''],
        ['생성 일시', new Date().toLocaleString('ko-KR')],
        ['총 파일 수', results.length],
        ['', ''],
        ['전체 요약', ''],
        ['총 검사 셀 수', results.reduce((sum, r) => sum + (r.summary?.totalCells || 0), 0)],
        ['총 오류 수', results.reduce((sum, r) => sum + r.errors.length, 0)],
        ['총 경고 수', results.reduce((sum, r) => sum + r.warnings.length, 0)],
        ['총 정보 수', results.reduce((sum, r) => sum + r.info.length, 0)],
        ['', ''],
        ['파일별 요약', ''],
        ['파일명', '상태', '오류', '경고', '정보', '검사 셀 수'],
      ];

      results.forEach(result => {
        summaryData.push([
          result.fileName,
          result.status,
          result.errors.length,
          result.warnings.length,
          result.info.length,
          result.summary?.totalCells || 0
        ]);
      });

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '일괄 검증 요약');

      // Combined Errors sheet
      const allErrors = results.flatMap(result => 
        result.errors.map(error => ({ ...error, fileName: result.fileName }))
      );
      
      if (allErrors.length > 0) {
        const errorHeaders = ['파일명', '유형', '심각도', '위치', '시트', '행', '열', '셀', '오류 메시지', '원본 텍스트', '제안', '규칙'];
        const errorData = [errorHeaders, ...allErrors.map(error => [
          (error as any).fileName,
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
          error.rule
        ])];

        const errorSheet = XLSX.utils.aoa_to_sheet(errorData);
        XLSX.utils.book_append_sheet(workbook, errorSheet, '전체 오류');
      }

      // Combined Warnings sheet
      const allWarnings = results.flatMap(result => 
        result.warnings.map(warning => ({ ...warning, fileName: result.fileName }))
      );
      
      if (allWarnings.length > 0) {
        const warningHeaders = ['파일명', '유형', '심각도', '위치', '시트', '행', '열', '셀', '경고 메시지', '원본 텍스트', '제안', '규칙'];
        const warningData = [warningHeaders, ...allWarnings.map(warning => [
          (warning as any).fileName,
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
        XLSX.utils.book_append_sheet(workbook, warningSheet, '전체 경고');
      }

      // Individual file sheets with detailed information
      results.forEach((result, index) => {
        const fileData = [
          ['파일명', result.fileName],
          ['검증 ID', result.id],
          ['상태', result.status],
          ['검증 시작', result.createdAt.toLocaleString('ko-KR')],
          ['검증 완료', result.completedAt?.toLocaleString('ko-KR') || 'N/A'],
          ['', ''],
          ['결과 요약', ''],
          ['총 셀 수', result.summary?.totalCells || 0],
          ['검사한 셀 수', result.summary?.checkedCells || 0],
          ['오류 수', result.errors.length],
          ['경고 수', result.warnings.length],
          ['정보 수', result.info.length],
          ['', ''],
        ];

        // Add errors if any
        if (result.errors.length > 0) {
          fileData.push(['오류 내역', '']);
          fileData.push(['유형', '위치', '메시지', '원본 텍스트', '제안']);
          result.errors.forEach(error => {
            fileData.push([
              this.getTypeDisplayName(error.type),
              `${error.location.sheet}!${error.location.cell}`,
              error.message,
              error.originalText,
              error.suggestion || ''
            ]);
          });
          fileData.push(['', '']);
        }

        // Add warnings if any
        if (result.warnings.length > 0) {
          fileData.push(['경고 내역', '']);
          fileData.push(['유형', '위치', '메시지', '원본 텍스트', '제안']);
          result.warnings.forEach(warning => {
            fileData.push([
              this.getTypeDisplayName(warning.type),
              `${warning.location.sheet}!${warning.location.cell}`,
              warning.message,
              warning.originalText,
              warning.suggestion || ''
            ]);
          });
          fileData.push(['', '']);
        }

        const fileSheet = XLSX.utils.aoa_to_sheet(fileData);
        // Clean up sheet name to avoid Excel limitations
        const cleanFileName = result.fileName
          .replace(/[\\/:*?"<>|]/g, '_') // Remove invalid characters
          .slice(0, 25); // Limit length for Excel
        const sheetName = `${index + 1}_${cleanFileName}`;
        XLSX.utils.book_append_sheet(workbook, fileSheet, sheetName);
      });

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return buffer;

    } catch (error) {
      console.error('Batch Excel report generation error:', error);
      throw new Error(`Failed to generate batch Excel report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate batch CSV report combining multiple validation results
   */
  async generateBatchCSVReport(results: ValidationResult[]): Promise<string> {
    try {
      const lines: string[] = [];

      // Header
      lines.push('파일명,유형,심각도,위치,시트,행,열,셀,메시지,원본텍스트,제안,규칙');

      // All items from all results
      results.forEach(result => {
        const allItems = [
          ...result.errors.map(item => ({ ...item, category: '오류', fileName: result.fileName })),
          ...result.warnings.map(item => ({ ...item, category: '경고', fileName: result.fileName })),
          ...result.info.map(item => ({ ...item, category: '정보', fileName: result.fileName }))
        ];

        allItems.forEach(item => {
          const row = [
            this.escapeCsvField((item as any).fileName),
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
            item.rule
          ];
          lines.push(row.join(','));
        });
      });

      return lines.join('\n');

    } catch (error) {
      console.error('Batch CSV report generation error:', error);
      throw new Error(`Failed to generate batch CSV report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate ZIP file containing individual reports for each validation result
   */
  async generateZipReport(results: ValidationResult[]): Promise<Buffer> {
    try {
      // Dynamic import of archiver (install if needed: npm install archiver @types/archiver)
      const archiver = require('archiver');
      const { Readable } = require('stream');
      
      const archive = archiver('zip', {
        zlib: { level: 9 } // Compression level
      });

      const chunks: Buffer[] = [];
      
      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      const zipPromise = new Promise<Buffer>((resolve, reject) => {
        archive.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        
        archive.on('error', (err: Error) => {
          reject(err);
        });
      });

      // Add individual Excel reports to ZIP
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        try {
          const excelBuffer = await this.generateExcelReport(result);
          const fileName = `${i + 1}_${result.fileName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_report.xlsx`;
          
          const stream = new Readable();
          stream.push(excelBuffer);
          stream.push(null);
          
          archive.append(stream, { name: fileName });
        } catch (error) {
          console.error(`Failed to generate report for ${result.fileName}:`, error);
          // Continue with other files even if one fails
        }
      }

      // Add batch summary as JSON
      const batchSummary = {
        batchSummary: {
          totalFiles: results.length,
          totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
          totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
          totalInfo: results.reduce((sum, r) => sum + r.info.length, 0),
          generatedAt: new Date()
        },
        filesList: results.map(r => ({
          fileName: r.fileName,
          id: r.id,
          status: r.status,
          errorCount: r.errors.length,
          warningCount: r.warnings.length,
          infoCount: r.info.length
        }))
      };
      
      archive.append(JSON.stringify(batchSummary, null, 2), { name: 'batch_summary.json' });

      archive.finalize();
      return zipPromise;

    } catch (error) {
      console.error('ZIP report generation error:', error);
      throw new Error(`Failed to generate ZIP report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
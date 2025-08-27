import { ValidationResult, ExcelData, ValidationError, ValidationContext, NEISStudentRecord, NEISSectionData } from '../types/validation';
import { KoreanEnglishValidator } from '../validators/KoreanEnglishValidator';
import { InstitutionNameValidator } from '../validators/InstitutionNameValidator';
import { GrammarValidator } from '../validators/GrammarValidator';
import { FormatValidator } from '../validators/FormatValidator';
import { AIValidator } from '../validators/AIValidator';

export class ValidationService {
  private static validationResults = new Map<string, ValidationResult>();
  private static activeValidations = new Set<string>();

  static async validateData(validationId: string, excelData: ExcelData): Promise<void> {
    const result = this.getResult(validationId);
    if (!result) {
      throw new Error('Validation result not found');
    }

    this.activeValidations.add(validationId);
    result.status = 'processing';
    result.progress = 0;

    try {
      console.log(`🔍 Starting validation for ${validationId} (Format: ${excelData.format || 'generic'})`);

      // Use NEIS-specific validation if format is NEIS
      if (excelData.format === 'neis' && excelData.neisData) {
        await this.validateNEISData(validationId, excelData);
      } else {
        await this.validateGenericData(validationId, excelData);
      }

    } catch (error) {
      console.error(`❌ Validation failed for ${validationId}:`, error);
      result.status = 'failed';
      
      // Add error to result
      const systemError: ValidationError = {
        id: `system-error-${Date.now()}`,
        type: 'ai_validation',
        severity: 'error',
        message: `System error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: { sheet: 'System', row: 0, column: 'A', cell: 'A0' },
        originalText: '',
        rule: 'system-validation'
      };
      result.errors.push(systemError);
      result.summary.errorCount = result.errors.length;
    } finally {
      this.activeValidations.delete(validationId);
      this.storeResult(validationId, result);
    }
  }

  /**
   * Validate NEIS format data with student context
   */
  private static async validateNEISData(validationId: string, excelData: ExcelData): Promise<void> {
    const result = this.getResult(validationId)!;
    const neisData = excelData.neisData!;

    console.log(`👥 Validating NEIS data for ${neisData.students.length} students`);

    // Initialize validators
    const validators = [
      new KoreanEnglishValidator(),
      new InstitutionNameValidator(),
      new GrammarValidator(),
      new FormatValidator(),
      new AIValidator()
    ];

    let checkedCells = 0;
    const totalCells = result.summary.totalCells;

    // Process each student record
    for (let studentIndex = 0; studentIndex < neisData.students.length; studentIndex++) {
      const student = neisData.students[studentIndex];
      
      console.log(`📚 Processing student: ${student.studentInfo.name || '미상'} (${studentIndex + 1}/${neisData.students.length})`);

      // Validate each section for this student
      for (const [sectionName, sectionData] of Object.entries(student.sections)) {
        if (!sectionData) continue;

        console.log(`  📝 Validating section: ${sectionName}`);

        // Only validate content rows (skip headers and empty rows)
        for (let rowIndex = 0; rowIndex < sectionData.contentRows.length; rowIndex++) {
          const row = sectionData.contentRows[rowIndex];
          
          // Check if validation was cancelled
          if (!this.activeValidations.has(validationId)) {
            result.status = 'failed';
            return;
          }

          for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const cellValue = row[colIndex];
            
            // Skip empty cells
            if (!cellValue || cellValue.toString().trim() === '') {
              continue;
            }

            const cellText = cellValue.toString().trim();
            const actualRow = sectionData.startRow + rowIndex + 2; // Adjust for headers
            const cellRef = this.getCellReference(actualRow, colIndex);
            
            // Enhanced context for NEIS validation
            const context: ValidationContext = {
              sheet: `${student.studentInfo.name || '미상'}_${sectionName}`,
              row: actualRow + 1,
              column: this.getColumnLetter(colIndex),
              cell: cellRef,
              adjacentCells: this.getAdjacentCellsFromArray(row, rowIndex, colIndex),
              neisContext: {
                studentInfo: student.studentInfo,
                sectionName,
                sectionType: sectionName,
                isHeaderRow: false,
                isContentRow: true
              }
            };

            // Run all validators on this cell
            for (const validator of validators) {
              try {
                const errors = await validator.validate(cellText, context);
                
                if (errors && errors.length > 0) {
                  errors.forEach(error => {
                    // Enhanced error location with student context
                    error.location = {
                      sheet: `${student.studentInfo.name}_${sectionName}`,
                      row: context.row,
                      column: context.column,
                      cell: context.cell
                    };
                    error.originalText = cellText;
                    
                    // Add student context to error message
                    error.message = `[${student.studentInfo.name} - ${sectionName}] ${error.message}`;
                    
                    // Categorize by severity
                    if (error.severity === 'error') {
                      result.errors.push(error);
                    } else if (error.severity === 'warning') {
                      result.warnings.push(error);
                    } else {
                      result.info.push(error);
                    }
                  });
                }
              } catch (validatorError) {
                console.error(`Validator error for ${student.studentInfo.name} ${sectionName} ${cellRef}:`, validatorError);
              }
            }

            checkedCells++;
            
            // Update progress
            result.progress = Math.round((checkedCells / totalCells) * 100);
            result.summary.checkedCells = checkedCells;

            // Update counts
            result.summary.errorCount = result.errors.length;
            result.summary.warningCount = result.warnings.length;
            result.summary.infoCount = result.info.length;

            // Store updated result
            this.storeResult(validationId, result);

            // Add small delay to prevent overwhelming the system
            if (checkedCells % 50 === 0) {
              await new Promise(resolve => setTimeout(resolve, 1));
            }
          }
        }
      }
    }

    // Complete validation
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();
    
    console.log(`✅ NEIS validation completed for ${validationId}`);
    console.log(`   Students: ${neisData.students.length}, Errors: ${result.errors.length}, Warnings: ${result.warnings.length}, Info: ${result.info.length}`);
  }

  /**
   * Validate generic Excel data (fallback method)
   */
  private static async validateGenericData(validationId: string, excelData: ExcelData): Promise<void> {
    const result = this.getResult(validationId)!;

    console.log(`📊 Starting generic validation for ${validationId}`);

    // Initialize validators
    const validators = [
      new KoreanEnglishValidator(),
      new InstitutionNameValidator(),
      new GrammarValidator(),
      new FormatValidator(),
      new AIValidator()
    ];

    let checkedCells = 0;
    const totalCells = result.summary.totalCells;

    // Process each sheet
    for (const [sheetName, sheet] of Object.entries(excelData.sheets)) {
      console.log(`📋 Processing sheet: ${sheetName}`);

      const { data } = sheet;
      
      for (let row = 0; row < data.length; row++) {
        // Check if validation was cancelled
        if (!this.activeValidations.has(validationId)) {
          result.status = 'failed';
          return;
        }

        for (let col = 0; col < data[row].length; col++) {
          const cellValue = data[row][col];
          
          // Skip empty cells
          if (!cellValue || cellValue.toString().trim() === '') {
            continue;
          }

          const cellText = cellValue.toString().trim();
          const cellRef = this.getCellReference(row, col);
          const context: ValidationContext = {
            sheet: sheetName,
            row: row + 1, // Excel rows are 1-indexed
            column: this.getColumnLetter(col),
            cell: cellRef,
            adjacentCells: this.getAdjacentCells(data, row, col)
          };

          // Run all validators on this cell
          for (const validator of validators) {
            try {
              const errors = await validator.validate(cellText, context);
              
              if (errors && errors.length > 0) {
                errors.forEach(error => {
                  error.location = {
                    sheet: sheetName,
                    row: context.row,
                    column: context.column,
                    cell: context.cell
                  };
                  error.originalText = cellText;

                  // Categorize by severity
                  if (error.severity === 'error') {
                    result.errors.push(error);
                  } else if (error.severity === 'warning') {
                    result.warnings.push(error);
                  } else {
                    result.info.push(error);
                  }
                });
              }
            } catch (validatorError) {
              console.error(`Validator error for cell ${cellRef}:`, validatorError);
              // Continue with other validators
            }
          }

          checkedCells++;
          
          // Update progress
          result.progress = Math.round((checkedCells / totalCells) * 100);
          result.summary.checkedCells = checkedCells;

          // Update counts
          result.summary.errorCount = result.errors.length;
          result.summary.warningCount = result.warnings.length;
          result.summary.infoCount = result.info.length;

          // Store updated result
          this.storeResult(validationId, result);

          // Add small delay to prevent overwhelming the system
          if (checkedCells % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      }
    }

    // Complete validation
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();
    
    console.log(`✅ Generic validation completed for ${validationId}`);
    console.log(`   Errors: ${result.errors.length}, Warnings: ${result.warnings.length}, Info: ${result.info.length}`);
  }

  static storeResult(validationId: string, result: ValidationResult): void {
    this.validationResults.set(validationId, result);
  }

  static getResult(validationId: string): ValidationResult | undefined {
    return this.validationResults.get(validationId);
  }

  static cancelValidation(validationId: string): void {
    this.activeValidations.delete(validationId);
    const result = this.getResult(validationId);
    if (result && result.status === 'processing') {
      result.status = 'failed';
      this.storeResult(validationId, result);
    }
  }

  static getRecentValidations(limit: number = 10): ValidationResult[] {
    const results = Array.from(this.validationResults.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    
    return results;
  }

  static cleanup(): void {
    // Remove validations older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const [id, result] of this.validationResults.entries()) {
      if (result.createdAt < oneDayAgo) {
        this.validationResults.delete(id);
      }
    }
  }

  private static getCellReference(row: number, col: number): string {
    const columnLetter = this.getColumnLetter(col);
    return `${columnLetter}${row + 1}`;
  }

  private static getColumnLetter(col: number): string {
    let letter = '';
    while (col >= 0) {
      letter = String.fromCharCode(col % 26 + 65) + letter;
      col = Math.floor(col / 26) - 1;
    }
    return letter;
  }

  private static getAdjacentCells(data: any[][], row: number, col: number) {
    return {
      left: col > 0 ? data[row][col - 1]?.toString() : undefined,
      right: col < data[row].length - 1 ? data[row][col + 1]?.toString() : undefined,
      above: row > 0 ? data[row - 1][col]?.toString() : undefined,
      below: row < data.length - 1 ? data[row + 1][col]?.toString() : undefined,
    };
  }

  private static getAdjacentCellsFromArray(rowData: string[], rowIndex: number, colIndex: number) {
    return {
      left: colIndex > 0 ? rowData[colIndex - 1]?.toString() : undefined,
      right: colIndex < rowData.length - 1 ? rowData[colIndex + 1]?.toString() : undefined,
      above: undefined, // Not available in single row context
      below: undefined, // Not available in single row context
    };
  }
}

// Cleanup old validations every hour
setInterval(() => {
  ValidationService.cleanup();
}, 60 * 60 * 1000);
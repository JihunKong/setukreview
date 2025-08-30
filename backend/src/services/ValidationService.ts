import { ValidationResult, ExcelData, ValidationError, ValidationContext, NEISStudentRecord, NEISSectionData } from '../types/validation';
import { KoreanEnglishValidator } from '../validators/KoreanEnglishValidator';
import { InstitutionNameValidator } from '../validators/InstitutionNameValidator';
import { GrammarValidator } from '../validators/GrammarValidator';
import { FormatValidator } from '../validators/FormatValidator';
import { AIValidator } from '../validators/AIValidator';
import { DuplicateDetectionValidator } from '../validators/DuplicateDetectionValidator';
import { AttendanceDuplicateValidator } from '../validators/AttendanceDuplicateValidator';
import { CrossStudentDuplicateDetector } from '../validators/CrossStudentDuplicateDetector';
// VBA-based validators
import { VBAAlphabetValidator } from '../validators/VBAAlphabetValidator';
import { DatePatternValidator } from '../validators/DatePatternValidator';
import { KeywordProhibitionValidator } from '../validators/KeywordProhibitionValidator';
import { EnhancedDuplicateValidator } from '../validators/EnhancedDuplicateValidator';
// Additional VBA validators (newly discovered)
import { SpellCheckValidator } from '../validators/SpellCheckValidator';
import { SentenceLevelDuplicateValidator } from '../validators/SentenceLevelDuplicateValidator';
import { ReadingActivityValidator } from '../validators/ReadingActivityValidator';
import { SpacingNormalizationValidator } from '../validators/SpacingNormalizationValidator';
import * as fs from 'fs';
import * as path from 'path';

export class ValidationService {
  private static validationResults = new Map<string, ValidationResult>();
  private static activeValidations = new Set<string>();
  private static readonly STORAGE_DIR = path.join(__dirname, '../validation-storage');
  private static storageInitialized = false;

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

    // Initialize validators (including duplicate detection)
    const duplicateDetector = new DuplicateDetectionValidator();
    const attendanceValidator = new AttendanceDuplicateValidator();
    const crossStudentDetector = new CrossStudentDuplicateDetector();
    
    // VBA-enhanced validators
    const vbaAlphabetValidator = new VBAAlphabetValidator();
    const datePatternValidator = new DatePatternValidator();
    const keywordProhibitionValidator = new KeywordProhibitionValidator();
    const enhancedDuplicateValidator = new EnhancedDuplicateValidator();
    
    // Additional VBA validators (newly discovered from macro analysis)
    const spellCheckValidator = new SpellCheckValidator();
    const sentenceLevelDuplicateValidator = new SentenceLevelDuplicateValidator();
    const readingActivityValidator = new ReadingActivityValidator();
    const spacingNormalizationValidator = new SpacingNormalizationValidator();
    
    const validators = [
      // Core validators
      new KoreanEnglishValidator(),
      new InstitutionNameValidator(),
      new GrammarValidator(),
      new FormatValidator(),
      
      // VBA-based validators (priority order based on analysis)
      vbaAlphabetValidator,          // High priority: exact VBA alphabet detection
      datePatternValidator,          // Important: VBA date format validation  
      keywordProhibitionValidator,   // Critical: comprehensive keyword checking
      spellCheckValidator,           // Korean spell checking (Module16.bas logic)
      spacingNormalizationValidator, // Spacing validation (Module7.bas logic)
      
      // Duplicate detection (enhanced VBA logic + existing)
      enhancedDuplicateValidator,    // VBA 15-character minimum + fuzzy matching
      sentenceLevelDuplicateValidator, // Sentence-level duplicates (Module5.bas logic)
      duplicateDetector,             // Keep existing for backward compatibility
      attendanceValidator,
      crossStudentDetector,
      
      // Specialized validators
      readingActivityValidator,      // Reading activity parsing (Module2.bas logic)
      
      // AI validation last for context-aware checking
      new AIValidator()
    ];

    let checkedCells = 0;
    const totalCells = result.summary.totalCells;

    // Process each student record
    for (let studentIndex = 0; studentIndex < neisData.students.length; studentIndex++) {
      const student = neisData.students[studentIndex];
      
      const displayName = this.getDisplayName(student.studentInfo.name);
      console.log(`📚 Processing student: ${displayName} (${studentIndex + 1}/${neisData.students.length})`);

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
            const displayName = this.getDisplayName(student.studentInfo.name);
            const context: ValidationContext = {
              sheet: `${displayName}_${sectionName}`,
              row: actualRow + 1,
              column: this.getColumnLetter(colIndex),
              cell: cellRef,
              // Duplicate detection context
              studentName: displayName,
              section: sectionName,
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
                    const displayName = this.getDisplayName(student.studentInfo.name);
                    error.location = {
                      sheet: `${displayName}_${sectionName}`,
                      row: context.row,
                      column: context.column,
                      cell: context.cell
                    };
                    error.originalText = cellText;
                    
                    // Add student context to error message
                    error.message = `[${displayName} - ${sectionName}] ${error.message}`;
                    
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
                const displayName = this.getDisplayName(student.studentInfo.name);
                console.error(`Validator error for ${displayName} ${sectionName} ${cellRef}:`, validatorError);
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

    // Initialize validators (including all VBA-based validators for comprehensive coverage)
    const validators = [
      // Core validators
      new KoreanEnglishValidator(),
      new InstitutionNameValidator(), 
      new GrammarValidator(),
      new FormatValidator(),
      
      // VBA-based validators for enhanced detection
      new VBAAlphabetValidator(),
      new DatePatternValidator(),
      new KeywordProhibitionValidator(),
      new SpellCheckValidator(),
      new SpacingNormalizationValidator(),
      new EnhancedDuplicateValidator(),
      new SentenceLevelDuplicateValidator(),
      new ReadingActivityValidator(),
      
      // AI validation last
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
    this.saveToFile(validationId, result);
  }

  static getResult(validationId: string): ValidationResult | undefined {
    // First try memory
    let result = this.validationResults.get(validationId);
    
    // If not in memory, try to load from file
    if (!result) {
      result = this.loadFromFile(validationId);
      if (result) {
        this.validationResults.set(validationId, result);
      }
    }
    
    return result;
  }

  private static initializeStorage(): void {
    if (!this.storageInitialized) {
      try {
        if (!fs.existsSync(this.STORAGE_DIR)) {
          fs.mkdirSync(this.STORAGE_DIR, { recursive: true });
        }
        this.storageInitialized = true;
        console.log(`📁 Validation storage initialized at: ${this.STORAGE_DIR}`);
      } catch (error) {
        console.error('❌ Failed to initialize storage directory:', error);
      }
    }
  }

  private static saveToFile(validationId: string, result: ValidationResult): void {
    try {
      this.initializeStorage();
      const filePath = path.join(this.STORAGE_DIR, `${validationId}.json`);
      
      // Create a serializable copy of the result
      const serializableResult = {
        ...result,
        createdAt: result.createdAt.toISOString(),
        completedAt: result.completedAt?.toISOString(),
      };
      
      fs.writeFileSync(filePath, JSON.stringify(serializableResult, null, 2), 'utf8');
    } catch (error) {
      console.error(`❌ Failed to save validation ${validationId} to file:`, error);
    }
  }

  private static loadFromFile(validationId: string): ValidationResult | undefined {
    try {
      this.initializeStorage();
      const filePath = path.join(this.STORAGE_DIR, `${validationId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return undefined;
      }
      
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Convert date strings back to Date objects
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
      };
    } catch (error) {
      console.error(`❌ Failed to load validation ${validationId} from file:`, error);
      return undefined;
    }
  }

  static loadAllFromFiles(): void {
    try {
      this.initializeStorage();
      
      if (!fs.existsSync(this.STORAGE_DIR)) {
        return;
      }
      
      const files = fs.readdirSync(this.STORAGE_DIR);
      let loadedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const validationId = file.replace('.json', '');
          const result = this.loadFromFile(validationId);
          if (result) {
            this.validationResults.set(validationId, result);
            loadedCount++;
          }
        }
      }
      
      console.log(`📋 Loaded ${loadedCount} validation results from storage`);
    } catch (error) {
      console.error('❌ Failed to load validation results from files:', error);
    }
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
    // Remove validations older than 24 hours from both memory and files
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [id, result] of this.validationResults.entries()) {
      if (result.createdAt < oneDayAgo) {
        this.validationResults.delete(id);
        this.deleteFile(id);
        cleanedCount++;
      }
    }
    
    // Also check files that might not be in memory
    this.cleanupFiles(oneDayAgo);
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old validation results`);
    }
  }

  private static deleteFile(validationId: string): void {
    try {
      const filePath = path.join(this.STORAGE_DIR, `${validationId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`❌ Failed to delete file for validation ${validationId}:`, error);
    }
  }

  private static cleanupFiles(cutoffDate: Date): void {
    try {
      if (!fs.existsSync(this.STORAGE_DIR)) {
        return;
      }
      
      const files = fs.readdirSync(this.STORAGE_DIR);
      let filesDeleted = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.STORAGE_DIR, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            filesDeleted++;
          }
        }
      }
      
      if (filesDeleted > 0) {
        console.log(`🗑️ Deleted ${filesDeleted} old validation files`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old validation files:', error);
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

  /**
   * Get display name for student, handling various cases
   */
  private static getDisplayName(studentName: string | undefined): string {
    if (!studentName || studentName.trim() === '') {
      return '학생정보_없음';
    }
    
    const name = studentName.trim();
    
    // Handle specific cases from NEIS processing
    if (name === '학생정보_미확인') {
      return '학생정보_미확인';
    }
    
    // Handle legacy "미상" case
    if (name === '미상') {
      return '학생정보_미상';
    }
    
    // Return normal name
    return name;
  }
}

// Cleanup old validations every hour
setInterval(() => {
  ValidationService.cleanup();
}, 60 * 60 * 1000);
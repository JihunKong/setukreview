import { ValidationResult, ExcelData, ValidationError } from '../types/validation';
import { ValidationService } from './ValidationService';
import { SessionManager, SessionData } from './SessionManager';
import { FileCategory } from './FileCategoryDetector';
import { ExcelProcessor } from './ExcelProcessor';
import { v4 as uuidv4 } from 'uuid';
import * as xlsx from 'xlsx';

// NEIS page processing interfaces
interface PageContext {
  hasStudentInfo: boolean;
  studentName?: string;
  previousPageContent?: string;
  isHeaderRow: boolean;
  pageNumber?: number;
}

interface SheetData {
  name: string;
  data: any[][];
  range?: string;
}

export interface BatchValidationOptions {
  validateAll: boolean;
  selectedCategories?: string[];
  selectedFileIds?: string[];
  skipDuplicateDetection?: boolean;
  enableCrossValidation?: boolean;
  priority?: 'speed' | 'accuracy' | 'balanced';
  maxConcurrency?: number;
}

export interface BatchValidationResult {
  batchId: string;
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  estimatedCompletionTime?: Date;
  results: Map<string, ValidationResult>; // fileId -> ValidationResult
  summary: {
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    processingTimeSeconds: number;
  };
  options: BatchValidationOptions;
}

export class SelectiveValidationService {
  private static instance: SelectiveValidationService;
  private sessionManager: SessionManager;
  private batchValidations = new Map<string, BatchValidationResult>();
  private activeBatches = new Set<string>();

  private constructor() {
    this.sessionManager = SessionManager.getInstance();
  }

  static getInstance(): SelectiveValidationService {
    if (!SelectiveValidationService.instance) {
      SelectiveValidationService.instance = new SelectiveValidationService();
    }
    return SelectiveValidationService.instance;
  }

  /**
   * Start batch validation for selected categories or files
   */
  async startBatchValidation(
    sessionId: string,
    options: BatchValidationOptions
  ): Promise<string> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Determine which files to validate
    const filesToValidate = this.getFilesToValidate(sessionId, options);
    
    if (filesToValidate.length === 0) {
      throw new Error('No files selected for validation');
    }

    const batchId = uuidv4();
    const batchResult: BatchValidationResult = {
      batchId,
      sessionId,
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
      results: new Map(),
      summary: {
        totalFiles: filesToValidate.length,
        completedFiles: 0,
        failedFiles: 0,
        totalErrors: 0,
        totalWarnings: 0,
        totalInfo: 0,
        processingTimeSeconds: 0
      },
      options
    };

    this.batchValidations.set(batchId, batchResult);
    this.activeBatches.add(batchId);

    console.log(`🚀 Starting batch validation ${batchId} for ${filesToValidate.length} files`);

    // Start validation process asynchronously
    this.processBatchValidation(batchId, filesToValidate)
      .catch(error => {
        console.error(`Batch validation failed for ${batchId}:`, error);
        const batch = this.batchValidations.get(batchId);
        if (batch) {
          batch.status = 'failed';
          batch.completedAt = new Date();
        }
      })
      .finally(() => {
        this.activeBatches.delete(batchId);
      });

    return batchId;
  }

  /**
   * Validate specific category
   */
  async validateCategory(
    sessionId: string,
    category: string,
    options: Omit<BatchValidationOptions, 'selectedCategories' | 'validateAll'> = {}
  ): Promise<string> {
    return this.startBatchValidation(sessionId, {
      ...options,
      validateAll: false,
      selectedCategories: [category]
    });
  }

  /**
   * Validate all files in session
   */
  async validateAll(
    sessionId: string,
    options: Omit<BatchValidationOptions, 'validateAll'> = {}
  ): Promise<string> {
    return this.startBatchValidation(sessionId, {
      ...options,
      validateAll: true
    });
  }

  /**
   * Validate all files in session synchronously - returns results immediately
   */
  async validateAllFilesSync(sessionId: string): Promise<ValidationResult[]> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get ALL session files regardless of status
    const allFiles = this.sessionManager.getSessionFiles(sessionId);
    
    if (allFiles.length === 0) {
      throw new Error('No files found in session');
    }

    console.log(`🚀 Starting synchronous validation for ${allFiles.length} files in session ${sessionId}`);
    
    const results: ValidationResult[] = [];
    
    // Process files in parallel using Promise.allSettled to handle individual failures
    const validationPromises = allFiles.map(async (file) => {
      try {
        console.log(`🔍 Validating file: ${file.fileName}`);
        return await this.validateSingleFileSync(file);
      } catch (error) {
        console.error(`❌ Validation failed for ${file.fileName}:`, error);
        // Return a failed validation result instead of throwing
        return {
          id: file.id,
          fileName: file.fileName,
          status: 'failed' as const,
          progress: 100,
          errors: [{
            id: uuidv4(),
            type: 'ai_validation',
            severity: 'error',
            message: error instanceof Error ? error.message : 'Validation failed',
            location: { sheet: 'unknown', cell: 'N/A', row: 0, column: 'N/A' },
            originalText: '',
            rule: 'System validation error',
            confidence: 1.0,
            suggestion: 'Please check the file format and try again'
          }],
          warnings: [],
          info: [],
          summary: {
            totalCells: 0,
            checkedCells: 0,
            errorCount: 1,
            warningCount: 0,
            infoCount: 0
          },
          createdAt: new Date(),
          completedAt: new Date()
        } as ValidationResult;
      }
    });

    const validationResults = await Promise.allSettled(validationPromises);
    
    // Process results
    for (const result of validationResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else {
        console.error('Failed to process validation result:', result);
      }
    }

    console.log(`✅ Synchronous validation completed for session ${sessionId}. Results: ${results.length} files`);
    
    return results;
  }

  /**
   * Get batch validation result
   */
  getBatchResult(batchId: string): BatchValidationResult | null {
    return this.batchValidations.get(batchId) || null;
  }

  /**
   * Cancel batch validation
   */
  cancelBatchValidation(batchId: string): boolean {
    const batch = this.batchValidations.get(batchId);
    if (!batch || batch.status === 'completed' || batch.status === 'failed') {
      return false;
    }

    batch.status = 'cancelled';
    batch.completedAt = new Date();
    this.activeBatches.delete(batchId);

    console.log(`❌ Cancelled batch validation: ${batchId}`);
    return true;
  }

  /**
   * Get active batch validations for session
   */
  getSessionBatches(sessionId: string): BatchValidationResult[] {
    return Array.from(this.batchValidations.values())
      .filter(batch => batch.sessionId === sessionId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Process batch validation
   */
  private async processBatchValidation(batchId: string, files: FileCategory[]): Promise<void> {
    const batch = this.batchValidations.get(batchId);
    if (!batch) {
      throw new Error('Batch validation not found');
    }

    batch.status = 'processing';
    const startTime = Date.now();
    let completedFiles = 0;

    try {
      const maxConcurrency = batch.options.maxConcurrency || 3;
      const chunks = this.chunkArray(files, maxConcurrency);

      // Process files in chunks for controlled concurrency
      for (const chunk of chunks) {
        // Refresh batch status in case it was cancelled externally
        const currentBatch = this.batchValidations.get(batchId);
        if (!currentBatch || currentBatch.status === 'cancelled') {
          break;
        }

        // Process chunk with individual error handling
        const chunkPromises = chunk.map(async (file) => {
          // Check if batch was cancelled
          const currentBatch = this.batchValidations.get(batchId);
          if (!currentBatch || currentBatch.status === 'cancelled') {
            return { success: false, file, error: 'Cancelled' };
          }

          try {
            await this.validateSingleFile(batchId, file);
            return { success: true, file };
          } catch (error) {
            console.error(`Validation failed for file ${file.fileName}:`, error);
            return { success: false, file, error };
          }
        });

        // Wait for all files in chunk to complete (with individual error handling)
        const chunkResults = await Promise.allSettled(chunkPromises);
        
        // Process results and update counters
        for (const result of chunkResults) {
          if (result.status === 'fulfilled' && result.value) {
            if (result.value.success) {
              completedFiles++;
            } else {
              batch.summary.failedFiles++;
              console.error(`File ${result.value.file.fileName} failed:`, result.value.error);
            }
          } else {
            batch.summary.failedFiles++;
            console.error(`Chunk processing failed:`, result.status === 'rejected' ? result.reason : 'Unknown error');
          }

          // Update progress after each file
          batch.progress = Math.round((completedFiles + batch.summary.failedFiles) / files.length * 100);
          batch.summary.completedFiles = completedFiles;
          
          // Update estimated completion time
          const processedFiles = completedFiles + batch.summary.failedFiles;
          if (processedFiles > 0) {
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const avgTimePerFile = elapsedSeconds / processedFiles;
            const remainingFiles = files.length - processedFiles;
            const estimatedRemainingSeconds = remainingFiles * avgTimePerFile;
            
            batch.estimatedCompletionTime = new Date(Date.now() + estimatedRemainingSeconds * 1000);
          }
        }

        // Small delay between chunks to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Finalize batch
      const finalBatch = this.batchValidations.get(batchId);
      if (finalBatch && finalBatch.status !== 'cancelled') {
        finalBatch.status = 'completed';
        finalBatch.progress = 100;
      }

      batch.completedAt = new Date();
      batch.summary.processingTimeSeconds = (Date.now() - startTime) / 1000;

      console.log(`✅ Batch validation completed: ${batchId} (${batch.summary.processingTimeSeconds}s)`);
      console.log(`   Completed: ${completedFiles}, Failed: ${batch.summary.failedFiles}, Total: ${files.length}`);

    } catch (error) {
      console.error(`Batch validation error for ${batchId}:`, error);
      batch.status = 'failed';
      batch.completedAt = new Date();
      batch.summary.processingTimeSeconds = (Date.now() - startTime) / 1000;
    }
  }

  /**
   * Validate a single file with real Excel processing
   */
  private async validateSingleFile(batchId: string, file: FileCategory): Promise<void> {
    const batch = this.batchValidations.get(batchId);
    if (!batch) {
      throw new Error('Batch validation not found');
    }

    // Update file status in session
    this.sessionManager.updateFileStatus(batch.sessionId, file.id, 'processing');

    try {
      console.log(`🔍 Validating file: ${file.fileName}`);
      
      // Get buffer from file metadata
      const buffer = file.metadata?.buffer;
      if (!buffer) {
        throw new Error(`No buffer found for file: ${file.fileName}`);
      }
      
      // Process the Excel file and validate it
      const validationResult = await this.validateFileContent(file.fileName, buffer);
      
      // Store result in batch
      batch.results.set(file.id, validationResult);
      
      // Add to session
      this.sessionManager.addValidationResult(batch.sessionId, file.id, validationResult);
      
      // Update batch summary
      batch.summary.totalErrors += validationResult.errors.length;
      batch.summary.totalWarnings += validationResult.warnings.length;
      batch.summary.totalInfo += validationResult.info.length;

      // Update file status
      this.sessionManager.updateFileStatus(
        batch.sessionId, 
        file.id, 
        validationResult.status === 'completed' ? 'completed' : 'failed'
      );

    } catch (error) {
      console.error(`❌ Error validating file ${file.fileName}:`, error);
      // Update file status to failed
      this.sessionManager.updateFileStatus(batch.sessionId, file.id, 'failed');
      throw error;
    }
  }

  /**
   * Validate a single file synchronously (for direct session validation)
   */
  private async validateSingleFileSync(file: FileCategory): Promise<ValidationResult> {
    try {
      console.log(`🔍 Starting synchronous validation for: ${file.fileName}`);
      
      // Get buffer from file metadata
      const buffer = file.metadata?.buffer;
      if (!buffer) {
        throw new Error(`No buffer found for file: ${file.fileName}`);
      }
      
      // Process the Excel file and validate it directly
      const validationResult = await this.validateFileContent(file.fileName, buffer);
      
      // Add file ID as a separate field (keep the validation ID intact)
      (validationResult as any).fileId = file.id;
      
      // Store the final result with fileId back to ValidationService
      console.log(`🔍 STORING validation result ${validationResult.id} in ValidationService`);
      ValidationService.storeResult(validationResult.id, validationResult);
      
      // Verify it was stored
      const stored = ValidationService.getResult(validationResult.id);
      console.log(`✅ Verification: stored result exists = ${!!stored}`);
      
      console.log(`✅ Synchronous validation completed for: ${file.fileName}`);
      console.log(`   Errors: ${validationResult.errors.length}, Warnings: ${validationResult.warnings.length}, Info: ${validationResult.info.length}`);
      
      return validationResult;

    } catch (error) {
      console.error(`❌ Synchronous validation failed for ${file.fileName}:`, error);
      throw error;
    }
  }

  /**
   * Validate file content using ExcelProcessor and ValidationService
   */
  private async validateFileContent(fileName: string, buffer: Buffer): Promise<ValidationResult> {
    try {
      // Initialize result
      const validationId = uuidv4();
      const validationResult: ValidationResult = {
        id: validationId,
        fileName,
        status: 'processing',
        progress: 0,
        createdAt: new Date(),
        summary: {
          totalCells: 0,
          checkedCells: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0
        },
        errors: [],
        warnings: [],
        info: []
      };

      // Store initial result
      ValidationService.storeResult(validationId, validationResult);

      // Process Excel file
      const excelProcessor = new ExcelProcessor();
      const excelData = await excelProcessor.processFile(buffer, fileName);

      // Calculate total cells
      let totalCells = 0;
      if (excelData.neisData && excelData.format === 'neis') {
        // Count cells in NEIS format
        for (const student of excelData.neisData.students) {
          for (const [sectionName, sectionData] of Object.entries(student.sections)) {
            if (sectionData) {
              totalCells += sectionData.contentRows.reduce((sum, row) => sum + row.length, 0);
            }
          }
        }
      } else {
        // Count cells in generic format
        for (const sheet of Object.values(excelData.sheets)) {
          totalCells += sheet.data.reduce((sum, row) => sum + row.length, 0);
        }
      }

      validationResult.summary.totalCells = totalCells;
      ValidationService.storeResult(validationId, validationResult);

      // Run validation
      await ValidationService.validateData(validationId, excelData);

      // Get the final result
      const finalResult = ValidationService.getResult(validationId);
      if (!finalResult) {
        throw new Error('Validation result not found after processing');
      }

      return finalResult;

    } catch (error) {
      console.error(`File validation error for ${fileName}:`, error);
      
      // Return error result
      return {
        id: uuidv4(),
        fileName,
        status: 'failed',
        progress: 0,
        createdAt: new Date(),
        summary: {
          totalCells: 0,
          checkedCells: 0,
          errorCount: 1,
          warningCount: 0,
          infoCount: 0
        },
        errors: [{
          id: `system-error-${Date.now()}`,
          type: 'ai_validation',
          severity: 'error',
          message: `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          location: { sheet: 'System', row: 0, column: 'A', cell: 'A0' },
          originalText: '',
          rule: 'system-validation'
        }],
        warnings: [],
        info: []
      };
    }
  }

  /**
   * Get files to validate based on options
   */
  private getFilesToValidate(sessionId: string, options: BatchValidationOptions): FileCategory[] {
    let files: FileCategory[] = [];

    if (options.validateAll) {
      files = this.sessionManager.getSessionFiles(sessionId);
    } else if (options.selectedFileIds && options.selectedFileIds.length > 0) {
      // Validate specific files
      const allFiles = this.sessionManager.getSessionFiles(sessionId);
      files = allFiles.filter(file => options.selectedFileIds!.includes(file.id));
    } else if (options.selectedCategories && options.selectedCategories.length > 0) {
      // Validate by categories
      for (const category of options.selectedCategories) {
        const categoryFiles = this.sessionManager.getFilesByCategory(sessionId, category);
        files.push(...categoryFiles);
      }
    }

    // For batch validation, allow re-validation of files for debugging and testing
    // Include all files except those currently processing
    return files.filter(file => 
      file.status === 'pending' || 
      file.status === 'failed' ||
      file.status === 'completed'  // Allow re-validation of completed files
    );
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get validation statistics by category
   */
  getCategoryValidationStats(batchId: string): Record<string, {
    totalFiles: number;
    completedFiles: number;
    totalErrors: number;
    totalWarnings: number;
    avgErrorsPerFile: number;
    avgWarningsPerFile: number;
  }> {
    const batch = this.batchValidations.get(batchId);
    if (!batch) {
      return {};
    }

    const files = this.sessionManager.getSessionFiles(batch.sessionId);
    const stats: Record<string, any> = {};

    files.forEach(file => {
      const result = batch.results.get(file.id);
      
      if (!stats[file.category]) {
        stats[file.category] = {
          totalFiles: 0,
          completedFiles: 0,
          totalErrors: 0,
          totalWarnings: 0
        };
      }

      stats[file.category].totalFiles++;
      
      if (result) {
        stats[file.category].completedFiles++;
        stats[file.category].totalErrors += result.errors.length;
        stats[file.category].totalWarnings += result.warnings.length;
      }
    });

    // Calculate averages
    Object.keys(stats).forEach(category => {
      const categoryStats = stats[category];
      categoryStats.avgErrorsPerFile = categoryStats.completedFiles > 0 
        ? Math.round((categoryStats.totalErrors / categoryStats.completedFiles) * 100) / 100 
        : 0;
      categoryStats.avgWarningsPerFile = categoryStats.completedFiles > 0 
        ? Math.round((categoryStats.totalWarnings / categoryStats.completedFiles) * 100) / 100 
        : 0;
    });

    return stats;
  }

  /**
   * Cleanup completed batches older than specified time
   */
  cleanupOldBatches(maxAgeHours: number = 24): void {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    const batchesToDelete: string[] = [];

    for (const [batchId, batch] of this.batchValidations.entries()) {
      if (batch.completedAt && batch.completedAt.getTime() < cutoffTime) {
        batchesToDelete.push(batchId);
      }
    }

    batchesToDelete.forEach(batchId => {
      this.batchValidations.delete(batchId);
    });

    if (batchesToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${batchesToDelete.length} old batch validations`);
    }
  }

  /**
   * Get overall service statistics
   */
  getServiceStats(): {
    totalBatches: number;
    activeBatches: number;
    completedBatches: number;
    failedBatches: number;
    totalFilesProcessed: number;
    avgProcessingTimePerFile: number;
  } {
    const batches = Array.from(this.batchValidations.values());
    
    return {
      totalBatches: batches.length,
      activeBatches: this.activeBatches.size,
      completedBatches: batches.filter(b => b.status === 'completed').length,
      failedBatches: batches.filter(b => b.status === 'failed').length,
      totalFilesProcessed: batches.reduce((sum, b) => sum + b.summary.completedFiles, 0),
      avgProcessingTimePerFile: this.calculateAvgProcessingTime(batches)
    };
  }

  private calculateAvgProcessingTime(batches: BatchValidationResult[]): number {
    const completedBatches = batches.filter(b => b.status === 'completed');
    if (completedBatches.length === 0) return 0;

    const totalTime = completedBatches.reduce((sum, b) => sum + b.summary.processingTimeSeconds, 0);
    const totalFiles = completedBatches.reduce((sum, b) => sum + b.summary.completedFiles, 0);

    return totalFiles > 0 ? Math.round((totalTime / totalFiles) * 100) / 100 : 0;
  }
}
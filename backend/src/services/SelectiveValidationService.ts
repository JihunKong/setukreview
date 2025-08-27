import { ValidationResult, ExcelData } from '../types/validation';
import { ValidationService } from './ValidationService';
import { SessionManager, SessionData } from './SessionManager';
import { FileCategory } from './FileCategoryDetector';
import { ExcelProcessor } from './ExcelProcessor';
import { v4 as uuidv4 } from 'uuid';

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

    try {
      const maxConcurrency = batch.options.maxConcurrency || 3;
      const chunks = this.chunkArray(files, maxConcurrency);

      let completedFiles = 0;

      // Process files in chunks for controlled concurrency
      for (const chunk of chunks) {
        // Refresh batch status in case it was cancelled externally
        const currentBatch = this.batchValidations.get(batchId);
        if (!currentBatch || currentBatch.status === 'cancelled') {
          break;
        }

        // Process chunk in parallel
        const chunkPromises = chunk.map(async (file) => {
          // Check if batch was cancelled
          const currentBatch = this.batchValidations.get(batchId);
          if (!currentBatch || currentBatch.status === 'cancelled') {
            return;
          }

          try {
            await this.validateSingleFile(batchId, file);
            completedFiles++;
          } catch (error) {
            console.error(`Validation failed for file ${file.fileName}:`, error);
            batch.summary.failedFiles++;
          }

          // Update progress
          batch.progress = Math.round((completedFiles / files.length) * 100);
          batch.summary.completedFiles = completedFiles;
          
          // Update estimated completion time
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const avgTimePerFile = elapsedSeconds / completedFiles;
          const remainingFiles = files.length - completedFiles;
          const estimatedRemainingSeconds = remainingFiles * avgTimePerFile;
          
          batch.estimatedCompletionTime = new Date(Date.now() + estimatedRemainingSeconds * 1000);
        });

        await Promise.all(chunkPromises);
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

    } catch (error) {
      console.error(`Batch validation error for ${batchId}:`, error);
      batch.status = 'failed';
      batch.completedAt = new Date();
      batch.summary.processingTimeSeconds = (Date.now() - startTime) / 1000;
    }
  }

  /**
   * Validate a single file
   */
  private async validateSingleFile(batchId: string, file: FileCategory): Promise<void> {
    const batch = this.batchValidations.get(batchId);
    if (!batch) {
      throw new Error('Batch validation not found');
    }

    // Update file status in session
    this.sessionManager.updateFileStatus(batch.sessionId, file.id, 'processing');

    try {
      // Create validation ID
      const validationId = uuidv4();

      // For this prototype, we'll simulate file processing
      // In reality, you would need to store the file buffer or read from storage
      
      // Create mock Excel data for validation
      const mockExcelData: ExcelData = {
        sheets: {
          [file.category]: {
            data: [['Sample data for validation']],
            range: 'A1:A1'
          }
        },
        fileName: file.fileName,
        fileSize: file.fileSize,
        format: 'generic'
      };

      // Create validation result
      const validationResult: ValidationResult = {
        id: validationId,
        fileName: file.fileName,
        status: 'pending',
        progress: 0,
        errors: [],
        warnings: [],
        info: [],
        summary: {
          totalCells: 100, // Mock value
          checkedCells: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
        },
        createdAt: new Date(),
      };

      // Store validation result
      ValidationService.storeResult(validationId, validationResult);

      // Start validation
      await ValidationService.validateData(validationId, mockExcelData);

      // Get completed result
      const completedResult = ValidationService.getResult(validationId);
      if (completedResult) {
        // Store result in batch
        batch.results.set(file.id, completedResult);
        
        // Add to session
        this.sessionManager.addValidationResult(batch.sessionId, file.id, completedResult);
        
        // Update batch summary
        batch.summary.totalErrors += completedResult.errors.length;
        batch.summary.totalWarnings += completedResult.warnings.length;
        batch.summary.totalInfo += completedResult.info.length;

        // Update file status
        this.sessionManager.updateFileStatus(
          batch.sessionId, 
          file.id, 
          completedResult.status === 'completed' ? 'completed' : 'failed',
          validationId
        );
      }

    } catch (error) {
      // Update file status to failed
      this.sessionManager.updateFileStatus(batch.sessionId, file.id, 'failed');
      throw error;
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

    // Filter out already processing/completed files unless forced
    return files.filter(file => file.status === 'pending' || file.status === 'failed');
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
import { v4 as uuidv4 } from 'uuid';
import { FileCategory, FileCategoryDetector } from './FileCategoryDetector';
import { ValidationResult } from '../types/validation';

export interface SessionData {
  id: string;
  userId?: string;
  createdAt: Date;
  lastAccessedAt: Date;
  files: Map<string, FileCategory>;
  validationResults: Map<string, ValidationResult>;
  status: 'active' | 'processing' | 'completed' | 'expired';
  metadata: {
    totalFiles: number;
    processedFiles: number;
    totalErrors: number;
    totalWarnings: number;
    estimatedCompletionTime?: Date;
  };
}

export interface BatchValidationOptions {
  validateAll: boolean;
  selectedCategories?: string[];
  skipDuplicateDetection?: boolean;
  enableCrossValidation?: boolean;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  averageFilesPerSession: number;
  popularCategories: Record<string, number>;
  processingTime: {
    average: number;
    min: number;
    max: number;
  };
}

export class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, SessionData>();
  private readonly SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
  private readonly MAX_SESSIONS = 1000; // Memory management
  private readonly MAX_FILES_PER_SESSION = 50;

  private constructor() {
    // Start cleanup interval
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Create a new session
   */
  createSession(userId?: string): string {
    // Cleanup if we're approaching the limit
    if (this.sessions.size >= this.MAX_SESSIONS) {
      this.cleanupOldestSessions(this.MAX_SESSIONS * 0.8);
    }

    const sessionId = uuidv4();
    const session: SessionData = {
      id: sessionId,
      userId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      files: new Map(),
      validationResults: new Map(),
      status: 'active',
      metadata: {
        totalFiles: 0,
        processedFiles: 0,
        totalErrors: 0,
        totalWarnings: 0
      }
    };

    this.sessions.set(sessionId, session);
    console.log(`📝 Created new session: ${sessionId} ${userId ? `for user ${userId}` : '(anonymous)'}`);
    
    return sessionId;
  }

  /**
   * Add file to session
   */
  async addFileToSession(
    sessionId: string, 
    buffer: Buffer, 
    fileName: string, 
    fileSize: number
  ): Promise<FileCategory> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check file limit
    if (session.files.size >= this.MAX_FILES_PER_SESSION) {
      throw new Error(`Maximum ${this.MAX_FILES_PER_SESSION} files per session exceeded`);
    }

    // Detect file category
    const detector = new FileCategoryDetector();
    const categoryResult = await detector.detectCategory(buffer, fileName);

    const fileCategory: FileCategory = {
      id: uuidv4(),
      fileName,
      category: categoryResult.category,
      confidence: categoryResult.confidence,
      uploadedAt: new Date(),
      status: 'pending',
      fileSize,
      metadata: {
        sheetCount: categoryResult.sheetAnalysis.length,
        detectedKeywords: categoryResult.detectedKeywords,
        suggestedAlternatives: categoryResult.suggestedAlternatives
      }
    };

    session.files.set(fileCategory.id, fileCategory);
    session.metadata.totalFiles = session.files.size;
    session.lastAccessedAt = new Date();

    console.log(`📁 Added file to session ${sessionId}: ${fileName} (${categoryResult.category}, confidence: ${categoryResult.confidence})`);
    
    return fileCategory;
  }

  /**
   * Get session data
   */
  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
      return session;
    }
    return null;
  }

  /**
   * Get files in session
   */
  getSessionFiles(sessionId: string): FileCategory[] {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return Array.from(session.files.values());
  }

  /**
   * Get files by category
   */
  getFilesByCategory(sessionId: string, category: string): FileCategory[] {
    const files = this.getSessionFiles(sessionId);
    return files.filter(file => file.category === category);
  }

  /**
   * Update file status
   */
  updateFileStatus(sessionId: string, fileId: string, status: FileCategory['status'], validationId?: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const file = session.files.get(fileId);
    if (!file) {
      throw new Error('File not found in session');
    }

    file.status = status;
    if (validationId) {
      file.validationId = validationId;
    }

    // Update session metadata
    const processedFiles = Array.from(session.files.values())
      .filter(f => f.status === 'completed' || f.status === 'failed').length;
    
    session.metadata.processedFiles = processedFiles;

    if (processedFiles === session.metadata.totalFiles) {
      session.status = 'completed';
    } else if (processedFiles > 0) {
      session.status = 'processing';
    }

    session.lastAccessedAt = new Date();
  }

  /**
   * Add validation result to session
   */
  addValidationResult(sessionId: string, fileId: string, result: ValidationResult): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.validationResults.set(fileId, result);
    
    // Update error/warning counts
    session.metadata.totalErrors += result.errors.length;
    session.metadata.totalWarnings += result.warnings.length;

    session.lastAccessedAt = new Date();
  }

  /**
   * Get validation results for session
   */
  getValidationResults(sessionId: string): Map<string, ValidationResult> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return new Map(session.validationResults);
  }

  /**
   * Get validation result for specific file
   */
  getFileValidationResult(sessionId: string, fileId: string): ValidationResult | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    return session.validationResults.get(fileId) || null;
  }

  /**
   * Remove file from session
   */
  removeFile(sessionId: string, fileId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const removed = session.files.delete(fileId);
    if (removed) {
      session.validationResults.delete(fileId);
      session.metadata.totalFiles = session.files.size;
      session.lastAccessedAt = new Date();
    }

    return removed;
  }

  /**
   * Clear session
   */
  clearSession(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    session.files.clear();
    session.validationResults.clear();
    session.status = 'active';
    session.metadata = {
      totalFiles: 0,
      processedFiles: 0,
      totalErrors: 0,
      totalWarnings: 0
    };
    session.lastAccessedAt = new Date();

    console.log(`🧹 Cleared session: ${sessionId}`);
    return true;
  }

  /**
   * Delete session completely
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`🗑️ Deleted session: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): SessionData['metadata'] & {
    averageFileSize: number;
    categoryDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
  } {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const files = Array.from(session.files.values());
    const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
    const averageFileSize = files.length > 0 ? totalSize / files.length : 0;

    // Category distribution
    const categoryDistribution: Record<string, number> = {};
    files.forEach(file => {
      categoryDistribution[file.category] = (categoryDistribution[file.category] || 0) + 1;
    });

    // Status distribution
    const statusDistribution: Record<string, number> = {};
    files.forEach(file => {
      statusDistribution[file.status] = (statusDistribution[file.status] || 0) + 1;
    });

    return {
      ...session.metadata,
      averageFileSize: Math.round(averageFileSize),
      categoryDistribution,
      statusDistribution
    };
  }

  /**
   * Get overall system statistics
   */
  getSystemStats(): SessionStats {
    const now = Date.now();
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => now - session.lastAccessedAt.getTime() < this.SESSION_TIMEOUT);

    const allFiles = Array.from(this.sessions.values())
      .flatMap(session => Array.from(session.files.values()));

    const totalFiles = allFiles.length;
    const averageFilesPerSession = this.sessions.size > 0 ? totalFiles / this.sessions.size : 0;

    // Popular categories
    const popularCategories: Record<string, number> = {};
    allFiles.forEach(file => {
      popularCategories[file.category] = (popularCategories[file.category] || 0) + 1;
    });

    // Processing time stats (mock for now - would be calculated from actual processing times)
    const processingTimes = [30, 45, 60, 120, 90]; // Example times in seconds
    const processingTime = {
      average: processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length,
      min: Math.min(...processingTimes),
      max: Math.max(...processingTimes)
    };

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      averageFilesPerSession: Math.round(averageFilesPerSession * 100) / 100,
      popularCategories,
      processingTime
    };
  }

  /**
   * Get sessions for user
   */
  getUserSessions(userId: string): SessionData[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt.getTime() > this.SESSION_TIMEOUT) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Clean up oldest sessions to free memory
   */
  private cleanupOldestSessions(targetCount: number): void {
    if (this.sessions.size <= targetCount) return;

    const sessions = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime());

    const toRemove = this.sessions.size - targetCount;
    const removedSessions = sessions.slice(0, toRemove);

    removedSessions.forEach(([sessionId]) => {
      this.sessions.delete(sessionId);
    });

    console.log(`🧹 Cleaned up ${removedSessions.length} oldest sessions`);
  }

  /**
   * Estimate completion time for session
   */
  estimateCompletionTime(sessionId: string): Date | null {
    const session = this.getSession(sessionId);
    if (!session || session.metadata.totalFiles === 0) {
      return null;
    }

    const avgProcessingTimePerFile = 60; // 60 seconds per file (rough estimate)
    const remainingFiles = session.metadata.totalFiles - session.metadata.processedFiles;
    const estimatedSeconds = remainingFiles * avgProcessingTimePerFile;

    const completionTime = new Date(Date.now() + estimatedSeconds * 1000);
    session.metadata.estimatedCompletionTime = completionTime;

    return completionTime;
  }

  /**
   * Update file category (manual override)
   */
  updateFileCategory(sessionId: string, fileId: string, newCategory: FileCategory['category']): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const file = session.files.get(fileId);
    if (!file) {
      return false;
    }

    const oldCategory = file.category;
    file.category = newCategory;
    file.confidence = 1.0; // Manual override gets full confidence
    session.lastAccessedAt = new Date();

    console.log(`📝 Updated file category: ${file.fileName} from ${oldCategory} to ${newCategory}`);
    return true;
  }

  /**
   * Get category summary for session
   */
  getCategorySummary(sessionId: string): Record<string, {
    count: number;
    files: FileCategory[];
    avgConfidence: number;
    status: 'pending' | 'processing' | 'completed' | 'mixed';
  }> {
    const files = this.getSessionFiles(sessionId);
    const summary: Record<string, any> = {};

    // Group by category
    files.forEach(file => {
      if (!summary[file.category]) {
        summary[file.category] = {
          count: 0,
          files: [],
          totalConfidence: 0
        };
      }

      summary[file.category].count++;
      summary[file.category].files.push(file);
      summary[file.category].totalConfidence += file.confidence;
    });

    // Calculate averages and status
    Object.keys(summary).forEach(category => {
      const categoryData = summary[category];
      categoryData.avgConfidence = categoryData.totalConfidence / categoryData.count;
      
      // Determine status
      const statuses = categoryData.files.map((f: FileCategory) => f.status);
      const uniqueStatuses = [...new Set(statuses)];
      
      if (uniqueStatuses.length === 1) {
        categoryData.status = uniqueStatuses[0];
      } else {
        categoryData.status = 'mixed';
      }

      delete categoryData.totalConfidence;
    });

    return summary;
  }
}
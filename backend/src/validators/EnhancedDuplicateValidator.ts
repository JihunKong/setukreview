import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

/**
 * EnhancedDuplicateValidator - Implements VBA duplicate detection logic
 * Based on VBA modules: Module7.bas, 복붙보고서작성.bas
 * 
 * Key VBA Logic:
 * - Uses Excel conditional formatting for basic duplicate highlighting
 * - Advanced duplicate detection for text ≥15 characters
 * - Creates reports with duplicate content and cell addresses
 * - Cross-references student names from column BA
 * - Dictionary-based duplicate tracking with case-insensitive comparison
 */
export class EnhancedDuplicateValidator extends BaseValidator {
  
  // VBA-derived settings
  private readonly minimumLength = 15; // From VBA: Len(cell.Value) >= 15
  private readonly duplicateRegistry = new Map<string, DuplicateEntry[]>();
  private readonly sessionDuplicates = new Map<string, Set<string>>(); // sessionId -> duplicate texts
  
  // Content similarity threshold for fuzzy matching
  private readonly similarityThreshold = 0.85;

  constructor() {
    super('enhanced_duplicate', 'Enhanced Duplicate Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells or text shorter than VBA minimum
    if (!text || text.trim().length < this.minimumLength) {
      return errors;
    }

    const normalizedText = this.normalizeText(text.trim());
    
    // Skip if it's just numbers, dates, or very common phrases
    if (this.shouldSkipDuplicateCheck(normalizedText)) {
      return errors;
    }

    // Create duplicate key (VBA uses case-insensitive comparison)
    const duplicateKey = this.createDuplicateKey(normalizedText);
    
    // Check for exact duplicates within the current session
    const exactDuplicateError = await this.checkExactDuplicates(duplicateKey, text, context);
    if (exactDuplicateError) {
      errors.push(exactDuplicateError);
    }

    // Check for similar content (fuzzy duplicate detection)
    const similarDuplicateError = await this.checkSimilarContent(normalizedText, text, context);
    if (similarDuplicateError) {
      errors.push(similarDuplicateError);
    }

    // Register this content for future duplicate checking
    this.registerContent(duplicateKey, text, context);

    return errors;
  }

  /**
   * Normalize text for duplicate comparison (VBA-style)
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace like VBA
      .replace(/[.!?。]/g, '.') // Normalize punctuation
      .trim()
      .toLowerCase(); // VBA uses TextCompare mode
  }

  /**
   * Create duplicate key for registry (similar to VBA dictionary key)
   */
  private createDuplicateKey(normalizedText: string): string {
    // Remove punctuation and extra spaces for more aggressive duplicate detection
    return normalizedText
      .replace(/[.,!?。]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  /**
   * Check if content should be skipped for duplicate checking
   */
  private shouldSkipDuplicateCheck(text: string): boolean {
    // Skip common educational phrases that might legitimately appear multiple times
    const commonPhrases = [
      '참여함', '활동함', '학습함', '수행함', '완성함',
      '노력함', '발표함', '토론함', '협력함', '탐구함',
      '이해함', '습득함', '개선함', '성장함', '발전함'
    ];

    // Skip if text is mostly common phrases
    const wordCount = text.split(/\s+/).length;
    if (wordCount <= 3 && commonPhrases.some(phrase => text.includes(phrase))) {
      return true;
    }

    // Skip pure numbers, dates, or very short descriptive text
    if (/^\d+[.\-/년월일\s]*\d*$/.test(text)) {
      return true;
    }

    // Skip single words or very short phrases
    if (text.length < this.minimumLength) {
      return true;
    }

    return false;
  }

  /**
   * Check for exact duplicates within session
   */
  private async checkExactDuplicates(
    duplicateKey: string, 
    originalText: string, 
    context: ValidationContext
  ): Promise<ValidationError | null> {
    
    // Get session ID for tracking
    const sessionId = context.neisContext?.studentInfo?.name || 'unknown';
    
    // Initialize session duplicates if needed
    if (!this.sessionDuplicates.has(sessionId)) {
      this.sessionDuplicates.set(sessionId, new Set());
    }

    const sessionDups = this.sessionDuplicates.get(sessionId)!;

    // Check if this exact content already exists
    if (sessionDups.has(duplicateKey)) {
      return this.createDuplicateError(
        'exact',
        originalText,
        context,
        '동일한 내용이 이미 입력되었습니다'
      );
    }

    // Add to session duplicates
    sessionDups.add(duplicateKey);

    // Check global duplicate registry
    if (this.duplicateRegistry.has(duplicateKey)) {
      const existingEntries = this.duplicateRegistry.get(duplicateKey)!;
      const crossStudentDuplicates = existingEntries.filter(
        entry => entry.studentName !== (context.neisContext?.studentInfo?.name || '')
      );

      if (crossStudentDuplicates.length > 0) {
        return this.createCrossStudentDuplicateError(originalText, context, crossStudentDuplicates);
      }
    }

    return null;
  }

  /**
   * Check for similar content using fuzzy matching
   */
  private async checkSimilarContent(
    normalizedText: string,
    originalText: string,
    context: ValidationContext
  ): Promise<ValidationError | null> {
    
    const sessionId = context.neisContext?.studentInfo?.name || 'unknown';

    // Check against recent content from same session
    const sessionDups = this.sessionDuplicates.get(sessionId);
    if (sessionDups) {
      for (const existingKey of sessionDups) {
        const similarity = this.calculateSimilarity(normalizedText, existingKey);
        if (similarity >= this.similarityThreshold) {
          return this.createDuplicateError(
            'similar',
            originalText,
            context,
            `유사한 내용이 발견되었습니다 (유사도: ${Math.round(similarity * 100)}%)`
          );
        }
      }
    }

    return null;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1.0;
    
    // Use Jaccard similarity for simplicity
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Register content for future duplicate checking
   */
  private registerContent(duplicateKey: string, originalText: string, context: ValidationContext): void {
    const entry: DuplicateEntry = {
      text: originalText,
      normalizedKey: duplicateKey,
      studentName: context.neisContext?.studentInfo?.name || 'unknown',
      section: context.neisContext?.sectionName || 'unknown',
      location: `${context.sheet}:${context.cell}`,
      timestamp: new Date()
    };

    if (!this.duplicateRegistry.has(duplicateKey)) {
      this.duplicateRegistry.set(duplicateKey, []);
    }
    
    this.duplicateRegistry.get(duplicateKey)!.push(entry);
  }

  /**
   * Create duplicate error (VBA-style formatting)
   */
  private createDuplicateError(
    type: 'exact' | 'similar',
    originalText: string,
    context: ValidationContext,
    message: string
  ): ValidationError {
    
    const severity = type === 'exact' ? 'error' : 'warning';
    const confidence = type === 'exact' ? 0.95 : 0.8;

    return this.createError(
      message,
      `duplicate-${type}`,
      severity,
      originalText,
      this.suggestDuplicateResolution(originalText, type),
      confidence
    );
  }

  /**
   * Create cross-student duplicate error
   */
  private createCrossStudentDuplicateError(
    originalText: string,
    context: ValidationContext,
    existingEntries: DuplicateEntry[]
  ): ValidationError {
    
    const studentNames = existingEntries.map(entry => entry.studentName).join(', ');
    const locations = existingEntries.map(entry => entry.location).join(', ');

    return this.createError(
      `타 학생과 동일한 내용: ${studentNames} (위치: ${locations})`,
      'cross-student-duplicate',
      'error',
      originalText,
      '학생별 고유한 내용으로 수정하세요',
      0.98 // Very high confidence for cross-student duplicates
    );
  }

  /**
   * Suggest resolution for duplicate content
   */
  private suggestDuplicateResolution(text: string, type: 'exact' | 'similar'): string {
    if (type === 'exact') {
      return '동일한 내용을 삭제하거나 구체적인 차이점을 추가하세요';
    } else {
      return '내용을 더욱 구체적이고 차별화된 내용으로 수정하세요';
    }
  }

  /**
   * Generate duplicate report (similar to VBA 복붙보고서작성)
   */
  generateDuplicateReport(): DuplicateReport {
    const duplicates: DuplicateReportEntry[] = [];
    
    for (const [key, entries] of this.duplicateRegistry.entries()) {
      if (entries.length > 1) {
        duplicates.push({
          content: entries[0].text,
          count: entries.length,
          locations: entries.map(entry => ({
            student: entry.studentName,
            section: entry.section,
            location: entry.location,
            timestamp: entry.timestamp
          }))
        });
      }
    }

    return {
      totalDuplicates: duplicates.length,
      duplicates: duplicates.sort((a, b) => b.count - a.count),
      generatedAt: new Date()
    };
  }

  /**
   * Clear session duplicates (for new validation sessions)
   */
  clearSessionDuplicates(sessionId?: string): void {
    if (sessionId) {
      this.sessionDuplicates.delete(sessionId);
    } else {
      this.sessionDuplicates.clear();
    }
  }

  /**
   * Check if validation should be applied
   */
  shouldValidate(context: ValidationContext): boolean {
    // Apply enhanced duplicate validation to content rows with sufficient length
    return context.neisContext?.isContentRow === true;
  }
}

/**
 * Types for duplicate tracking
 */
interface DuplicateEntry {
  text: string;
  normalizedKey: string;
  studentName: string;
  section: string;
  location: string;
  timestamp: Date;
}

interface DuplicateReport {
  totalDuplicates: number;
  duplicates: DuplicateReportEntry[];
  generatedAt: Date;
}

interface DuplicateReportEntry {
  content: string;
  count: number;
  locations: Array<{
    student: string;
    section: string;
    location: string;
    timestamp: Date;
  }>;
}
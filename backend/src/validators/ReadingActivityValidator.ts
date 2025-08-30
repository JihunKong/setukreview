import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

/**
 * ReadingActivityValidator - Implements VBA reading activity validation logic
 * Based on VBA Module2.bas (독서텍스트나누기, 텍스트나누기, 독서활동보고서작성)
 * 
 * Key VBA Logic:
 * - Remove spaces from reading text
 * - Split text by comma delimiter for book entries
 * - Split by period for detailed information
 * - Check for duplicates using conditional formatting
 * - Create reports for duplicate reading entries
 * - Handle merged cells and unmerge them
 */
export class ReadingActivityValidator extends BaseValidator {
  
  // Reading activity registry for duplicate tracking
  private static readingRegistry = new Map<string, ReadingEntry[]>();
  private static sessionReadings = new Map<string, Set<string>>();

  // Minimum book entry length
  private readonly minimumEntryLength = 5;
  
  // Common reading activity patterns
  private readonly bookTitlePattern = /『[^』]+』|「[^」]+」|《[^》]+》|'[^']+'/g;
  private readonly authorPattern = /저자[:\s]*([^,\s]+)|작가[:\s]*([^,\s]+)|지은이[:\s]*([^,\s]+)/g;
  private readonly publisherPattern = /출판사[:\s]*([^,\s]+)|출간[:\s]*([^,\s]+)/g;

  constructor() {
    super('reading_activity', 'Reading Activity Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells
    if (!text || text.trim().length < this.minimumEntryLength) {
      return errors;
    }

    // Only validate reading activity sections
    if (!this.isReadingActivityContext(context)) {
      return errors;
    }

    const normalizedText = this.normalizeReadingText(text.trim());

    // Apply VBA text processing for reading activities
    const processedEntries = this.parseReadingEntries(normalizedText);
    
    if (processedEntries.length === 0) {
      return errors;
    }

    // Validate each reading entry
    for (const entry of processedEntries) {
      const entryErrors = await this.validateReadingEntry(entry, text, context);
      errors.push(...entryErrors);
    }

    // Check for duplicates across entries
    const duplicateErrors = this.checkReadingDuplicates(processedEntries, text, context);
    errors.push(...duplicateErrors);

    // Register reading entries for cross-validation
    this.registerReadingEntries(processedEntries, text, context);

    return errors;
  }

  /**
   * Normalize reading text (VBA space removal logic)
   */
  private normalizeReadingText(text: string): string {
    // Remove spaces like VBA does: AA.Replace " ", ""
    return text.replace(/\s+/g, '');
  }

  /**
   * Parse reading entries using VBA TextToColumns logic
   */
  private parseReadingEntries(normalizedText: string): ReadingEntry[] {
    const entries: ReadingEntry[] = [];
    
    // First split by comma (VBA: TextToColumns with comma delimiter)
    const commaEntries = normalizedText.split(',')
      .map(entry => entry.trim())
      .filter(entry => entry.length >= this.minimumEntryLength);

    for (const commaEntry of commaEntries) {
      // Then split each entry by period for detailed parsing (VBA: TextToColumns with period)
      const periodParts = commaEntry.split('.')
        .map(part => part.trim())
        .filter(part => part.length > 0);

      if (periodParts.length > 0) {
        const entry = this.createReadingEntry(commaEntry, periodParts);
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Create reading entry from parsed parts
   */
  private createReadingEntry(rawText: string, parts: string[]): ReadingEntry {
    const entry: ReadingEntry = {
      rawText: rawText,
      normalizedText: rawText.toLowerCase(),
      title: this.extractTitle(rawText),
      author: this.extractAuthor(rawText),
      publisher: this.extractPublisher(rawText),
      additionalInfo: parts.slice(1), // Everything after the first part
      wordCount: rawText.length
    };

    return entry;
  }

  /**
   * Extract book title from text
   */
  private extractTitle(text: string): string | null {
    const titleMatch = text.match(this.bookTitlePattern);
    if (titleMatch && titleMatch[0]) {
      // Remove quotation marks
      return titleMatch[0].replace(/[『』「」《》'']/g, '');
    }

    // Look for common title indicators
    const titleIndicators = ['제목', '도서명', '책제목'];
    for (const indicator of titleIndicators) {
      const regex = new RegExp(`${indicator}[:\s]*([^,]+)`, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract author from text
   */
  private extractAuthor(text: string): string | null {
    const authorMatch = text.match(this.authorPattern);
    if (authorMatch) {
      return (authorMatch[1] || authorMatch[2] || authorMatch[3] || '').trim();
    }
    return null;
  }

  /**
   * Extract publisher from text
   */
  private extractPublisher(text: string): string | null {
    const publisherMatch = text.match(this.publisherPattern);
    if (publisherMatch && publisherMatch[1]) {
      return publisherMatch[1].trim();
    }
    return null;
  }

  /**
   * Validate individual reading entry
   */
  private async validateReadingEntry(
    entry: ReadingEntry, 
    originalText: string, 
    context: ValidationContext
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check if entry has identifiable book information
    if (!entry.title && !entry.author && entry.rawText.length > 20) {
      const error = this.createError(
        `독서 정보 부족: "${this.truncateText(entry.rawText)}" - 도서명이나 저자 정보를 명확히 기재하세요`,
        'reading-incomplete-info',
        'warning',
        originalText,
        '『도서명』, 저자: 작가명 형식으로 기재하세요'
      );
      errors.push(error);
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousContent(entry.rawText)) {
      const error = this.createError(
        `의심스러운 독서 내용: "${this.truncateText(entry.rawText)}"`,
        'reading-suspicious-content',
        'warning',
        originalText,
        '실제 독서 활동 내용으로 기재하세요'
      );
      errors.push(error);
    }

    // Validate reading entry length
    if (entry.rawText.length < 10) {
      const error = this.createError(
        `독서 기록이 너무 짧습니다: "${entry.rawText}"`,
        'reading-too-short',
        'info',
        originalText,
        '독서 활동에 대한 구체적인 내용을 추가하세요'
      );
      errors.push(error);
    }

    return errors;
  }

  /**
   * Check for duplicates in reading entries (VBA duplicate detection logic)
   */
  private checkReadingDuplicates(
    entries: ReadingEntry[], 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Internal duplicates (within same text)
    const seenEntries = new Map<string, number>();
    
    entries.forEach((entry, index) => {
      const key = entry.normalizedText;
      
      if (seenEntries.has(key)) {
        const firstIndex = seenEntries.get(key)!;
        const error = this.createError(
          `독서 항목 중복: ${index + 1}번째 항목이 ${firstIndex + 1}번째 항목과 동일합니다`,
          'reading-internal-duplicate',
          'error',
          originalText,
          '중복된 독서 항목을 제거하거나 다른 도서로 변경하세요'
        );
        errors.push(error);
      } else {
        seenEntries.set(key, index);
      }
    });

    // External duplicates (cross-student)
    for (const entry of entries) {
      const externalDuplicates = this.findExternalReadingDuplicates(entry, originalText, context);
      errors.push(...externalDuplicates);
    }

    return errors;
  }

  /**
   * Find external reading duplicates
   */
  private findExternalReadingDuplicates(
    entry: ReadingEntry, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (ReadingActivityValidator.readingRegistry.has(entry.normalizedText)) {
      const existingEntries = ReadingActivityValidator.readingRegistry.get(entry.normalizedText)!;
      const sessionId = this.getSessionId(context);
      
      const externalEntries = existingEntries.filter(existing => 
        existing.sessionId !== sessionId || existing.location !== context.cell
      );

      if (externalEntries.length > 0) {
        const students = [...new Set(externalEntries.map(e => e.studentName))].join(', ');
        const locations = externalEntries.map(e => e.location).join(', ');
        
        const error = this.createError(
          `타 학생과 독서 항목 중복: "${this.truncateText(entry.rawText)}" (${students} - ${locations})`,
          'reading-cross-student-duplicate',
          'error',
          originalText,
          '개인별 고유한 독서 활동으로 변경하세요'
        );
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Register reading entries for cross-validation
   */
  private registerReadingEntries(
    entries: ReadingEntry[], 
    originalText: string, 
    context: ValidationContext
  ): void {
    const sessionId = this.getSessionId(context);
    
    // Initialize session readings
    if (!ReadingActivityValidator.sessionReadings.has(sessionId)) {
      ReadingActivityValidator.sessionReadings.set(sessionId, new Set());
    }
    
    const sessionReadings = ReadingActivityValidator.sessionReadings.get(sessionId)!;

    entries.forEach(entry => {
      // Add to session readings
      sessionReadings.add(entry.normalizedText);
      
      // Add to global registry
      const registryEntry = {
        ...entry,
        sessionId: sessionId,
        studentName: context.neisContext?.studentInfo?.name || 'unknown',
        location: `${context.sheet}:${context.cell}`,
        timestamp: new Date()
      };
      
      if (!ReadingActivityValidator.readingRegistry.has(entry.normalizedText)) {
        ReadingActivityValidator.readingRegistry.set(entry.normalizedText, []);
      }
      
      ReadingActivityValidator.readingRegistry.get(entry.normalizedText)!.push(registryEntry);
    });
  }

  /**
   * Check if context is reading activity related
   */
  private isReadingActivityContext(context: ValidationContext): boolean {
    const sheet = context.sheet?.toLowerCase() || '';
    const section = context.neisContext?.sectionName?.toLowerCase() || '';
    
    return sheet.includes('독서') || 
           section.includes('독서') || 
           sheet.includes('reading') ||
           context.column === 'I'; // VBA column check for reading activities
  }

  /**
   * Check for suspicious reading content
   */
  private containsSuspiciousContent(text: string): boolean {
    const suspiciousPatterns = [
      /^[가-힣]{2,4}$/, // Just a name
      /^\d+$/, // Just numbers
      /^[a-zA-Z]+$/, // Just English letters
      /없음|해당없음|미실시/, // No activity indicators
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Get session ID
   */
  private getSessionId(context: ValidationContext): string {
    return context.neisContext?.studentInfo?.name || 'session';
  }

  /**
   * Truncate text for display
   */
  private truncateText(text: string): string {
    return text.length > 40 ? text.substring(0, 37) + '...' : text;
  }

  /**
   * Clear session data
   */
  static clearSessionData(sessionId?: string): void {
    if (sessionId) {
      ReadingActivityValidator.sessionReadings.delete(sessionId);
    } else {
      ReadingActivityValidator.sessionReadings.clear();
      ReadingActivityValidator.readingRegistry.clear();
    }
  }

  /**
   * Generate reading activity report (similar to VBA 독서활동보고서작성)
   */
  static generateReadingReport(): ReadingActivityReport {
    const duplicates: ReadingDuplicateEntry[] = [];
    
    for (const [normalizedText, entries] of ReadingActivityValidator.readingRegistry.entries()) {
      if (entries.length > 1) {
        duplicates.push({
          content: entries[0].rawText,
          title: entries[0].title,
          author: entries[0].author,
          count: entries.length,
          locations: entries.map(entry => ({
            student: entry.studentName || 'unknown',
            location: entry.location || 'unknown',
            timestamp: entry.timestamp || new Date()
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
   * Check if validation should be applied
   */
  shouldValidate(context: ValidationContext): boolean {
    return this.isReadingActivityContext(context) && 
           context.neisContext?.isContentRow === true;
  }
}

/**
 * Types for reading activity validation
 */
interface ReadingEntry {
  rawText: string;
  normalizedText: string;
  title: string | null;
  author: string | null;
  publisher: string | null;
  additionalInfo: string[];
  wordCount: number;
  sessionId?: string;
  studentName?: string;
  location?: string;
  timestamp?: Date;
}

interface ReadingActivityReport {
  totalDuplicates: number;
  duplicates: ReadingDuplicateEntry[];
  generatedAt: Date;
}

interface ReadingDuplicateEntry {
  content: string;
  title: string | null;
  author: string | null;
  count: number;
  locations: Array<{
    student: string;
    location: string;
    timestamp: Date;
  }>;
}
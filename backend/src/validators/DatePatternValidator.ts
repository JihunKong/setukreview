import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

/**
 * DatePatternValidator - Implements VBA date format validation logic
 * Based on VBA module: 창체날짜형식검색.bas
 * 
 * Key VBA Logic:
 * - Blue highlighting: Invalid \d+\. patterns (numbers followed by period)
 * - Red highlighting: Valid date formats (yyyy.mm.dd.)
 * - Supports date ranges (yyyy.mm.dd.-yyyy.mm.dd.)
 * - Marks problematic rows with value 1 in column 98 (CR)
 */
export class DatePatternValidator extends BaseValidator {
  // VBA patterns extracted from 창체날짜형식검색.bas
  private readonly problematicNumberPattern: RegExp = /\d+\./g;  // "숫자." format
  private readonly validDatePattern1: RegExp = /\d{4}\.\d{2}\.\d{2}\./g;  // yyyy.mm.dd.
  private readonly validDatePattern2: RegExp = /\d{4}\.\d{2}\.\d{2}\.-\d{4}\.\d{2}\.\d{2}\./g;  // date ranges

  // Additional patterns for better validation
  private readonly invalidDatePatterns: RegExp[] = [
    /\d+\.\d+\./g,        // Simple number.number. format
    /\d{1,3}\.\d{1,3}\./g, // Short number patterns
    /\d+\.\s/g,           // Number followed by period and space
  ];

  // Valid date format patterns (more comprehensive)
  private readonly validDatePatterns: RegExp[] = [
    /\d{4}\.\d{1,2}\.\d{1,2}\./g,                    // yyyy.m.d. or yyyy.mm.dd.
    /\d{4}\.\d{1,2}\.\d{1,2}\.-\d{4}\.\d{1,2}\.\d{1,2}\./g, // Date ranges
    /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,              // Korean date format
    /\d{4}-\d{2}-\d{2}/g,                            // ISO date format
  ];

  constructor() {
    super('date_pattern', 'Date Pattern Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells or very short text
    if (!text || text.trim().length < 3) {
      return errors;
    }

    const normalizedText = text.trim();

    // Skip if text is already a proper date/time format
    if (this.isDateTime(normalizedText) || this.isOnlyNumbers(normalizedText)) {
      return errors;
    }

    // Check for problematic number patterns (VBA blue highlighting logic)
    const problematicMatches = this.findProblematicPatterns(normalizedText);
    for (const match of problematicMatches) {
      // Only flag if it's not part of a valid date
      if (!this.isPartOfValidDate(normalizedText, match)) {
        const error = this.createProblematicPatternError(match, text, context);
        errors.push(error);
      }
    }

    // Check for invalid date-like patterns
    const invalidDateMatches = this.findInvalidDatePatterns(normalizedText);
    for (const match of invalidDateMatches) {
      if (!this.isPartOfValidDate(normalizedText, match)) {
        const error = this.createInvalidDateError(match, text, context);
        errors.push(error);
      }
    }

    // Validate date format consistency
    if (this.containsDateLikeContent(normalizedText)) {
      const formatConsistencyError = this.checkDateFormatConsistency(normalizedText, text, context);
      if (formatConsistencyError) {
        errors.push(formatConsistencyError);
      }
    }

    return errors;
  }

  /**
   * Find problematic number patterns (VBA \d+\. pattern)
   */
  private findProblematicPatterns(text: string): Array<{text: string, start: number, end: number}> {
    return this.findPatternMatches(text, this.problematicNumberPattern);
  }

  /**
   * Find invalid date patterns
   */
  private findInvalidDatePatterns(text: string): Array<{text: string, start: number, end: number}> {
    const matches: Array<{text: string, start: number, end: number}> = [];
    
    for (const pattern of this.invalidDatePatterns) {
      const patternMatches = this.findPatternMatches(text, pattern);
      matches.push(...patternMatches);
    }
    
    return matches;
  }

  /**
   * Find pattern matches in text
   */
  private findPatternMatches(text: string, pattern: RegExp): Array<{text: string, start: number, end: number}> {
    const matches: Array<{text: string, start: number, end: number}> = [];
    let match: RegExpExecArray | null;
    
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    return matches;
  }

  /**
   * Check if a match is part of a valid date
   */
  private isPartOfValidDate(text: string, match: {text: string, start: number, end: number}): boolean {
    // Check if the match is contained within any valid date pattern
    for (const validPattern of this.validDatePatterns) {
      validPattern.lastIndex = 0;
      let validMatch: RegExpExecArray | null;
      
      while ((validMatch = validPattern.exec(text)) !== null) {
        const validStart = validMatch.index;
        const validEnd = validMatch.index + validMatch[0].length;
        
        // Check if problematic match is within valid date match
        if (match.start >= validStart && match.end <= validEnd) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if text contains date-like content
   */
  private containsDateLikeContent(text: string): boolean {
    // Look for date-related keywords
    const dateKeywords = ['년', '월', '일', '기간', '날짜', '일정', '시기'];
    return dateKeywords.some(keyword => text.includes(keyword)) || 
           /\d{4}.*\d{1,2}.*\d{1,2}/.test(text);
  }

  /**
   * Check date format consistency
   */
  private checkDateFormatConsistency(text: string, originalText: string, context: ValidationContext): ValidationError | null {
    // Find all date-like patterns
    const datePatterns = text.match(/\d{4}[.\-\/년]\d{1,2}[.\-\/월]\d{1,2}[일]?/g) || [];
    
    if (datePatterns.length > 1) {
      // Check if formats are consistent
      const formats = datePatterns.map(this.getDateFormat);
      const uniqueFormats = [...new Set(formats)];
      
      if (uniqueFormats.length > 1) {
        return this.createError(
          `날짜 형식이 일치하지 않습니다: ${uniqueFormats.join(', ')}`,
          'date-format-inconsistency',
          'warning',
          originalText,
          '일관된 날짜 형식을 사용하세요 (예: 2024.01.01.)'
        );
      }
    }

    return null;
  }

  /**
   * Get date format type from date string
   */
  private getDateFormat(dateString: string): string {
    if (dateString.includes('년') && dateString.includes('월')) {
      return '한국어 형식';
    } else if (dateString.includes('.')) {
      return '점 구분 형식';
    } else if (dateString.includes('-')) {
      return '하이픈 구분 형식';
    } else if (dateString.includes('/')) {
      return '슬래시 구분 형식';
    }
    return '기타 형식';
  }

  /**
   * Create error for problematic number pattern (VBA blue highlighting)
   */
  private createProblematicPatternError(
    match: {text: string, start: number, end: number}, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError {
    
    const contextBefore = originalText.substring(Math.max(0, match.start - 10), match.start);
    const contextAfter = originalText.substring(match.end, Math.min(originalText.length, match.end + 10));

    return this.createErrorWithHighlight(
      `잘못된 숫자 형식: "${match.text}" - 날짜 형식으로 변경이 필요할 수 있습니다`,
      'problematic-number-pattern',
      'warning',
      originalText,
      this.suggestDateFormat(match.text),
      0.8,
      { start: match.start, end: match.end },
      contextBefore,
      contextAfter
    );
  }

  /**
   * Create error for invalid date pattern
   */
  private createInvalidDateError(
    match: {text: string, start: number, end: number}, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError {
    
    const contextBefore = originalText.substring(Math.max(0, match.start - 10), match.start);
    const contextAfter = originalText.substring(match.end, Math.min(originalText.length, match.end + 10));

    return this.createErrorWithHighlight(
      `잘못된 날짜 형식: "${match.text}" - 올바른 날짜 형식을 사용하세요`,
      'invalid-date-format',
      'error',
      originalText,
      this.suggestProperDateFormat(match.text),
      0.9,
      { start: match.start, end: match.end },
      contextBefore,
      contextAfter
    );
  }

  /**
   * Suggest proper date format for problematic pattern
   */
  private suggestDateFormat(problematicText: string): string {
    // Try to extract numbers and suggest proper date format
    const numbers = problematicText.match(/\d+/g);
    
    if (numbers && numbers.length >= 1) {
      const num = numbers[0];
      
      // If it's a 4-digit number, likely a year
      if (num.length === 4) {
        return `"${problematicText}"가 날짜라면 "${num}.01.01." 형식으로 작성하세요`;
      }
      
      // If it's a 1-2 digit number, could be month or day
      if (num.length <= 2) {
        const today = new Date();
        const currentYear = today.getFullYear();
        return `"${problematicText}"가 날짜라면 "${currentYear}.${num.padStart(2, '0')}.01." 형식으로 작성하세요`;
      }
    }

    return `"${problematicText}"를 "YYYY.MM.DD." 형식의 날짜로 변경하세요`;
  }

  /**
   * Suggest proper date format
   */
  private suggestProperDateFormat(invalidText: string): string {
    // Extract any numbers from the invalid text
    const numbers = invalidText.match(/\d+/g) || [];
    
    if (numbers.length >= 3) {
      // Try to construct proper date
      const year = numbers[0];
      const month = numbers[1];
      const day = numbers[2];
      const properYear = year && year.length === 4 ? year : `20${year || '24'}`;
      const properMonth = month ? month.padStart(2, '0') : '01';
      const properDay = day ? day.padStart(2, '0') : '01';
      
      return `"${invalidText}"를 "${properYear}.${properMonth}.${properDay}." 형식으로 변경하세요`;
    } else if (numbers.length === 2) {
      const first = numbers[0];
      const second = numbers[1];
      const currentYear = new Date().getFullYear();
      
      return `"${invalidText}"를 "${currentYear}.${first ? first.padStart(2, '0') : '01'}.${second ? second.padStart(2, '0') : '01'}." 형식으로 변경하세요`;
    }

    return `"${invalidText}"를 "YYYY.MM.DD." 형식으로 변경하세요 (예: 2024.03.15.)`;
  }

  /**
   * Check if validation should be applied based on context
   */
  shouldValidate(context: ValidationContext): boolean {
    // Apply date pattern validation primarily to content rows
    return context.neisContext?.isContentRow === true;
  }
}
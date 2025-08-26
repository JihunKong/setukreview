import { ValidationError, ValidationContext } from '../types/validation';

export abstract class BaseValidator {
  protected readonly type: ValidationError['type'];
  protected readonly name: string;

  constructor(type: ValidationError['type'], name: string) {
    this.type = type;
    this.name = name;
  }

  abstract validate(text: string, context: ValidationContext): Promise<ValidationError[]>;

  protected createError(
    message: string,
    rule: string,
    severity: ValidationError['severity'] = 'error',
    originalText: string = '',
    suggestion?: string,
    confidence?: number
  ): ValidationError {
    return {
      id: `${this.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.type,
      severity,
      message,
      location: {
        sheet: '',
        row: 0,
        column: '',
        cell: ''
      }, // Will be filled by ValidationService
      originalText,
      suggestion,
      rule,
      confidence
    };
  }

  protected isKoreanText(text: string): boolean {
    // Korean Unicode ranges: 
    // Hangul Syllables: AC00-D7AF
    // Hangul Jamo: 1100-11FF
    // Hangul Compatibility Jamo: 3130-318F
    const koreanRegex = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
    return koreanRegex.test(text);
  }

  protected isEnglishText(text: string): boolean {
    const englishRegex = /[A-Za-z]/;
    return englishRegex.test(text);
  }

  protected hasSpecialCharacters(text: string): boolean {
    // Allow only: Korean, English, numbers, spaces, hyphens, parentheses, commas, apostrophes, periods
    const allowedCharsRegex = /^[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AFa-zA-Z0-9\s\-(),'.\u00A0]*$/;
    return !allowedCharsRegex.test(text);
  }

  protected countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  protected normalizeWhitespace(text: string): string {
    // Replace multiple spaces with single space and normalize line breaks
    return text.replace(/\s+/g, ' ').trim();
  }

  protected isOnlyNumbers(text: string): boolean {
    return /^\d+$/.test(text.trim());
  }

  protected isDateTime(text: string): boolean {
    const dateTimePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{4}\.\d{2}\.\d{2}$/,
      /^\d{4}\/\d{2}\/\d{2}$/,
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
    ];
    return dateTimePatterns.some(pattern => pattern.test(text.trim()));
  }
}
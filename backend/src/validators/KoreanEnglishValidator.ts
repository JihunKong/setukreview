import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

export class KoreanEnglishValidator extends BaseValidator {
  private readonly allowedEnglishTerms: Set<string>;
  private readonly allowedEnglishPatterns: RegExp[];

  constructor() {
    super('korean_english', 'Korean/English Input Validator');
    
    // Common allowed English terms (case insensitive)
    this.allowedEnglishTerms = new Set([
      // General acronyms
      'CEO', 'PD', 'UCC', 'IT', 'POP', 'CF', 'TV', 'PAPS', 'SNS', 'PPT',
      'DVD', 'CD', 'USB', 'GPS', 'LED', 'LCD', 'AI', 'VR', 'AR',
      'URL', 'HTTP', 'HTTPS', 'WWW', 'PC', 'OS', 'SW', 'HW',
      
      // Educational terms
      'STEAM', 'STEM', 'IB', 'AP', 'SAT', 'TOEIC', 'TOEFL', 'IELTS',
      'GPA', 'R&E', 'MOOC',
      
      // Common abbreviations
      'OK', 'NO', 'YES', 'Q&A', 'FAQ', 'TIP', 'TOP', 'NEW', 'HOT',
      'ON', 'OFF', 'UP', 'DOWN', 'IN', 'OUT'
    ]);

    // Patterns for allowed English usage
    this.allowedEnglishPatterns = [
      // Road addresses (영문 도로명)
      /\b\d+[가-힣\s]*[A-Za-z]+[가-힣\s]*\d*\b/,
      
      // Foreign names pattern (성명)
      /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/,
      
      // Website URLs
      /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b/,
      
      // Email addresses
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,
      
      // Model numbers or codes
      /\b[A-Z]{1,3}\d{2,6}[A-Z]?\b/,
      
      // Units and measurements
      /\b\d+[a-zA-Z]{1,3}\b/
    ];
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells, numbers only, or dates
    if (!text || this.isOnlyNumbers(text) || this.isDateTime(text)) {
      return errors;
    }

    // Check if text contains English
    if (!this.isEnglishText(text)) {
      return errors; // No English text found, nothing to validate
    }

    const normalizedText = this.normalizeWhitespace(text);
    
    // Extract English words and phrases
    const englishMatches = this.extractEnglishContent(normalizedText);
    
    for (const match of englishMatches) {
      if (!this.isAllowedEnglishUsage(match, normalizedText)) {
        const error = this.createError(
          `허용되지 않은 영문 표현: "${match}"`,
          'korean-english-rule',
          'warning',
          text,
          this.suggestKoreanAlternative(match)
        );
        errors.push(error);
      }
    }

    return errors;
  }

  private extractEnglishContent(text: string): string[] {
    const matches: string[] = [];
    
    // Find all English words and acronyms
    const englishWordRegex = /\b[A-Za-z]+(?:[&][A-Za-z]+)*\b/g;
    let match;
    
    while ((match = englishWordRegex.exec(text)) !== null) {
      matches.push(match[0]);
    }

    // Find English phrases (2-3 consecutive English words)
    const englishPhraseRegex = /\b[A-Z][a-z]+\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g;
    while ((match = englishPhraseRegex.exec(text)) !== null) {
      matches.push(match[0]);
    }

    return [...new Set(matches)]; // Remove duplicates
  }

  private isAllowedEnglishUsage(englishContent: string, fullText: string): boolean {
    const upperContent = englishContent.toUpperCase();
    
    // Check against allowed terms
    if (this.allowedEnglishTerms.has(upperContent)) {
      return true;
    }

    // Check against patterns
    for (const pattern of this.allowedEnglishPatterns) {
      if (pattern.test(englishContent) || pattern.test(fullText)) {
        return true;
      }
    }

    // Check if it's a proper foreign name (Title Case)
    if (this.isForeignName(englishContent)) {
      return true;
    }

    // Check if it's part of a book title or publication
    if (this.isBookTitleOrPublication(englishContent, fullText)) {
      return true;
    }

    // Check if it's a technical term in context
    if (this.isTechnicalTerm(englishContent, fullText)) {
      return true;
    }

    return false;
  }

  private isForeignName(text: string): boolean {
    // Foreign names are typically Title Case with 2-3 parts
    const namePattern = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}$/;
    return namePattern.test(text);
  }

  private isBookTitleOrPublication(englishContent: string, fullText: string): boolean {
    // Check if English content appears with quotes or in publication context
    const bookContexts = ['도서', '책', '저서', '논문', '학술지', '잡지', '신문'];
    const hasBookContext = bookContexts.some(context => fullText.includes(context));
    
    // Check if English content is in quotes
    const quotedPattern = new RegExp(`['"]${englishContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
    const isQuoted = quotedPattern.test(fullText);
    
    return hasBookContext || isQuoted;
  }

  private isTechnicalTerm(englishContent: string, fullText: string): boolean {
    // Check if it's a technical term in educational context
    const technicalContexts = [
      '프로그램', '시스템', '소프트웨어', '하드웨어', '네트워크',
      '데이터베이스', '알고리즘', '인터페이스', '플랫폼', '애플리케이션'
    ];
    
    return technicalContexts.some(context => fullText.includes(context));
  }

  private suggestKoreanAlternative(englishContent: string): string {
    const alternatives: Record<string, string> = {
      'PROGRAM': '프로그램',
      'SYSTEM': '시스템',
      'PROJECT': '프로젝트',
      'TEAM': '팀',
      'GROUP': '그룹',
      'CLASS': '수업',
      'COURSE': '과정',
      'TEST': '시험',
      'EXAM': '시험',
      'STUDY': '학습',
      'CLUB': '동아리',
      'ACTIVITY': '활동',
      'EVENT': '행사',
      'CONTEST': '대회',
      'COMPETITION': '경시대회',
      'FESTIVAL': '축제',
      'CAMP': '캠프',
      'WORKSHOP': '워크숍',
      'SEMINAR': '세미나',
      'CONFERENCE': '회의'
    };

    const upperContent = englishContent.toUpperCase();
    return alternatives[upperContent] || `한글 표기 권장`;
  }
}
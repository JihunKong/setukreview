import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

export class FormatValidator extends BaseValidator {
  private readonly prohibitedSpecialChars: RegExp;
  private readonly allowedSpecialChars: string[];

  constructor() {
    super('format', 'Format Validator');
    
    // Allowed special characters: hyphen, parentheses, comma, apostrophe, period, space
    this.allowedSpecialChars = ['-', '(', ')', ',', "'", '.', ' ', '\u00A0']; // Including non-breaking space
    
    // Pattern for prohibited special characters (excluding allowed ones and Korean/English/numbers)
    this.prohibitedSpecialChars = /[^\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AFa-zA-Z0-9\s\-(),'.\u00A0]/g;
  }

  async validate(text: string, _context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells
    if (!text) {
      return errors;
    }

    // Check for prohibited special characters
    errors.push(...this.checkSpecialCharacters(text));
    
    // Check for quotation mark issues
    errors.push(...this.checkQuotationMarks(text));
    
    // Check for bracket/parentheses consistency
    errors.push(...this.checkBracketConsistency(text));

    return errors;
  }

  private checkSpecialCharacters(text: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    const prohibitedChars = text.match(this.prohibitedSpecialChars);
    
    if (prohibitedChars) {
      const uniqueChars = [...new Set(prohibitedChars)];
      
      for (const char of uniqueChars) {
        const charDescription = this.getCharacterDescription(char);
        const suggestion = this.getSuggestionForChar(char);
        
        const error = this.createError(
          `허용되지 않은 특수문자 사용: ${charDescription}`,
          'prohibited-special-character',
          'warning',
          text,
          suggestion
        );
        errors.push(error);
      }
    }

    return errors;
  }

  private checkQuotationMarks(text: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for different types of quotation marks (left/right different shapes)
    const quotationIssues = [
      { pattern: /[\u201C\u201D]/g, description: '영문 따옴표' },
      { pattern: /[\u2018\u2019]/g, description: '영문 작은따옴표' },
      { pattern: /[\u300C\u300D]/g, description: '일본식 따옴표' },
      { pattern: /[\u300E\u300F]/g, description: '일본식 겹따옴표' },
    ];

    for (const issue of quotationIssues) {
      const matches = text.match(issue.pattern);
      if (matches) {
        const error = this.createError(
          `비표준 따옴표 사용: ${issue.description}`,
          'non-standard-quotation-marks',
          'info',
          text,
          '표준 따옴표(\' 또는 \") 사용 권장'
        );
        errors.push(error);
      }
    }

    // Check for mismatched quotation marks
    errors.push(...this.checkMismatchedQuotes(text));

    return errors;
  }

  private checkMismatchedQuotes(text: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for mismatched single quotes
    const singleQuotes = (text.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      const error = this.createError(
        '짝이 맞지 않는 작은따옴표가 있습니다',
        'mismatched-single-quotes',
        'warning',
        text,
        '따옴표 쌍을 확인하세요'
      );
      errors.push(error);
    }

    // Check for mismatched double quotes
    const doubleQuotes = (text.match(/"/g) || []).length;
    if (doubleQuotes % 2 !== 0) {
      const error = this.createError(
        '짝이 맞지 않는 큰따옴표가 있습니다',
        'mismatched-double-quotes',
        'warning',
        text,
        '따옴표 쌍을 확인하세요'
      );
      errors.push(error);
    }

    return errors;
  }

  private checkBracketConsistency(text: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    const brackets = [
      { open: '(', close: ')', name: '소괄호' },
      { open: '[', close: ']', name: '대괄호' },
      { open: '{', close: '}', name: '중괄호' },
      { open: '〈', close: '〉', name: '홑화살괄호' },
      { open: '《', close: '》', name: '겹화살괄호' }
    ];

    for (const bracket of brackets) {
      const openCount = (text.match(new RegExp(`\\${bracket.open}`, 'g')) || []).length;
      const closeCount = (text.match(new RegExp(`\\${bracket.close}`, 'g')) || []).length;
      
      if (openCount !== closeCount) {
        const error = this.createError(
          `${bracket.name}의 개수가 맞지 않습니다 (열림: ${openCount}, 닫힘: ${closeCount})`,
          'mismatched-brackets',
          'warning',
          text,
          `${bracket.name} 쌍을 확인하세요`
        );
        errors.push(error);
      }
    }

    return errors;
  }

  private getCharacterDescription(char: string): string {
    const descriptions: Record<string, string> = {
      '!': '느낌표(!)',
      '?': '물음표(?)',
      '@': '골뱅이(@)',
      '#': '우물정자(#)',
      '$': '달러($)',
      '%': '퍼센트(%)',
      '^': '캐럿(^)',
      '&': '앰퍼샌드(&)',
      '*': '별표(*)',
      '+': '플러스(+)',
      '=': '등호(=)',
      '|': '세로선(|)',
      '\\': '역슬래시(\\)',
      '/': '슬래시(/)',
      ':': '콜론(:)',
      ';': '세미콜론(;)',
      '<': '작다기호(<)',
      '>': '크다기호(>)',
      '~': '틸드(~)',
      '`': '백틱(`)',
      '₩': '원화기호(₩)',
    };

    return descriptions[char] || `특수문자(${char})`;
  }

  private getSuggestionForChar(char: string): string {
    const suggestions: Record<string, string> = {
      '!': '문장 끝에는 마침표(.) 사용',
      '?': '의문문이 아닌 경우 마침표(.) 사용',
      '@': '이메일 주소가 아닌 경우 삭제',
      '#': '삭제 또는 "제" 등으로 대체',
      '$': '삭제 또는 "달러" 등으로 표기',
      '%': '삭제 또는 "퍼센트" 등으로 표기',
      '&': '삭제 또는 "그리고", "와/과" 등으로 대체',
      '*': '삭제',
      '+': '삭제 또는 "플러스" 등으로 표기',
      '=': '삭제',
      '|': '삭제',
      '\\': '삭제',
      '/': '삭제 또는 "또는" 등으로 대체',
      ':': '삭제',
      ';': '삭제',
      '<': '삭제',
      '>': '삭제',
      '~': '삭제 또는 하이픈(-) 사용',
      '`': '삭제 또는 작은따옴표(\') 사용',
      '₩': '삭제 또는 "원" 등으로 표기',
    };

    return suggestions[char] || '허용된 문자로 대체';
  }
}
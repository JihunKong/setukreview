import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

export class GrammarValidator extends BaseValidator {
  constructor() {
    super('grammar', 'Grammar Validator');
  }

  async validate(text: string, _context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells, numbers only, or dates
    if (!text || this.isOnlyNumbers(text) || this.isDateTime(text)) {
      return errors;
    }

    const normalizedText = text.trim();
    
    // Check for missing period at the end of sentences
    errors.push(...this.checkMissingPeriod(normalizedText, text));
    
    // Check for double spacing
    errors.push(...this.checkDoubleSpacing(normalizedText, text));
    
    // Check for awkward particle usage with parentheses
    errors.push(...this.checkParticleWithParentheses(normalizedText, text));
    
    // Check for English expressions that should be in Korean
    errors.push(...this.checkEnglishExpressions(normalizedText, text));

    return errors;
  }

  private checkMissingPeriod(normalizedText: string, originalText: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Skip short text or text that's clearly not a sentence
    if (normalizedText.length < 10) {
      return errors;
    }

    // Skip if it's a title, header, or list item
    if (this.isTitle(normalizedText) || this.isListItem(normalizedText)) {
      return errors;
    }

    // Check if text ends with appropriate punctuation
    const endsWithPunctuation = /[.!?。]$/.test(normalizedText);
    
    if (!endsWithPunctuation && this.shouldEndWithPeriod(normalizedText)) {
      const error = this.createError(
        '문장의 끝에 마침표가 빠져있습니다',
        'missing-period',
        'warning',
        originalText,
        `${normalizedText}.`
      );
      errors.push(error);
    }

    return errors;
  }

  private checkDoubleSpacing(normalizedText: string, originalText: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for multiple consecutive spaces
    const doubleSpacePattern = /\s{2,}/g;
    const matches = normalizedText.match(doubleSpacePattern);
    
    if (matches) {
      const error = this.createError(
        '연속된 공백이 발견되었습니다',
        'double-spacing',
        'info',
        originalText,
        normalizedText.replace(/\s+/g, ' ')
      );
      errors.push(error);
    }

    return errors;
  }

  private checkParticleWithParentheses(normalizedText: string, originalText: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for particles (을/를) that come after parentheses
    // The particle should be determined by the word before the parentheses
    const particlePattern = /([가-힣]+)\([^)]*\)\s*([을를])/g;
    let match;
    
    while ((match = particlePattern.exec(normalizedText)) !== null) {
      const wordBeforeParens = match[1];
      const currentParticle = match[2];
      const correctParticle = this.getCorrectParticle(wordBeforeParens);
      
      if (correctParticle && correctParticle !== currentParticle) {
        const error = this.createError(
          `조사 사용이 부적절합니다. "${wordBeforeParens}"에는 "${correctParticle}"이 적절합니다`,
          'particle-with-parentheses',
          'warning',
          originalText,
          normalizedText.replace(match[0], `${wordBeforeParens}(${match[0].match(/\(([^)]*)\)/)?.[1] || ''})${correctParticle}`)
        );
        errors.push(error);
      }
    }

    return errors;
  }

  private checkEnglishExpressions(normalizedText: string, originalText: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Common English expressions that should be in Korean in educational context
    const englishExpressions: Record<string, string> = {
      'feedback': '피드백',
      'workshop': '워크숍',
      'seminar': '세미나',
      'project': '프로젝트',
      'program': '프로그램',
      'portfolio': '포트폴리오',
      'presentation': '발표',
      'report': '보고서',
      'assignment': '과제',
      'homework': '숙제',
      'test': '시험',
      'quiz': '퀴즈',
      'review': '검토, 복습',
      'practice': '연습',
      'training': '훈련',
      'activity': '활동',
      'experience': '경험',
      'interview': '인터뷰',
      'survey': '설문조사',
      'research': '연구',
      'study': '공부, 연구'
    };

    for (const [english, korean] of Object.entries(englishExpressions)) {
      const regex = new RegExp(`\\b${english}\\b`, 'gi');
      if (regex.test(normalizedText)) {
        const error = this.createError(
          `영어 표현 "${english}"는 한글로 표기하는 것이 권장됩니다`,
          'english-expression',
          'info',
          originalText,
          `"${korean}" 사용 권장`
        );
        errors.push(error);
      }
    }

    return errors;
  }

  private isTitle(text: string): boolean {
    // Check if text looks like a title or header
    return text.length < 50 && 
           !text.includes('다') && 
           !text.includes('었') && 
           !text.includes('했') &&
           !/[.!?]/.test(text);
  }

  private isListItem(text: string): boolean {
    // Check if text is a list item
    return /^[\d\s]*[-•·]\s/.test(text) || 
           /^\d+\.\s/.test(text) ||
           /^[가나다라마바사아자차카타파하]\.\s/.test(text);
  }

  private shouldEndWithPeriod(text: string): boolean {
    // Text should end with period if it contains verb endings
    const verbEndings = ['다', '었다', '였다', '했다', '됐다', '된다', '한다', '있다', '없다'];
    return verbEndings.some(ending => text.includes(ending));
  }

  private getCorrectParticle(word: string): string | null {
    if (!word) return null;
    
    // Get the last character to determine if it has final consonant (받침)
    const lastChar = word.charAt(word.length - 1);
    
    // Korean character Unicode ranges
    if (lastChar >= '가' && lastChar <= '힣') {
      // Check if the character has final consonant (받침)
      const charCode = lastChar.charCodeAt(0) - '가'.charCodeAt(0);
      const hasFinalConsonant = (charCode % 28) !== 0;
      
      return hasFinalConsonant ? '을' : '를';
    }
    
    // For non-Korean characters or numbers, default to '을'
    return '을';
  }
}
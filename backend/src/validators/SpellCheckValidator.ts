import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

/**
 * SpellCheckValidator - Implements VBA spell checking logic
 * Based on VBA Module16.bas 맞춤법검사 function
 * 
 * Key VBA Logic:
 * - Uses Application.CheckSpelling for word validation
 * - Ignores single character tokens (spacing errors)
 * - Removes punctuation for checking
 * - Collects misspelled words and reports them
 * - Column-specific checking based on sheet type
 */
export class SpellCheckValidator extends BaseValidator {
  
  // Common Korean spelling errors and corrections
  private readonly commonMisspellings = new Map([
    // Spacing errors
    ['않돼', '안 돼'], ['않되', '안 되'], ['않해', '안 해'], ['못돼', '못 돼'],
    ['갖고있', '가지고 있'], ['하고있', '하고 있'], ['되어있', '되어 있'],
    ['살고있', '살고 있'], ['보고있', '보고 있'], ['알고있', '알고 있'],
    
    // Common typos
    ['되요', '돼요'], ['되서', '돼서'], ['구름이', '구름이'], ['됬다', '됐다'],
    ['써요', '써요'], ['되구', '되고'], ['그런데', '그런데'], ['문제가', '문제가'],
    
    // Particle errors
    ['한데', '한테'], ['ㄱ이', '가이'], ['맞추어', '맞춰'], ['다르다', '다르다'],
    
    // Educational context errors
    ['참여하여', '참여하여'], ['수행하여', '수행하여'], ['학습하여', '학습하여'],
    ['활동하여', '활동하여'], ['노력하여', '노력하여'], ['발전하여', '발전하여'],
    
    // Achievement context
    ['뛰어나다', '뛰어나다'], ['우수하다', '우수하다'], ['훌륭하다', '훌륭하다'],
    
    // Common verb forms
    ['함으로써', '함으로써'], ['통하여', '통하여'], ['의하여', '의하여'],
  ]);

  // Pattern-based error detection
  private readonly errorPatterns = [
    // Double consonants
    { pattern: /([ㄱ-ㅎ])\1+/g, type: 'double-consonant', message: '자음 중복 오류' },
    
    // Incomplete Hangul
    { pattern: /[ㄱ-ㅎㅏ-ㅣ]/g, type: 'incomplete-hangul', message: '불완전한 한글 문자' },
    
    // Excessive punctuation
    { pattern: /[.]{3,}|[!]{2,}|[?]{2,}/g, type: 'excessive-punctuation', message: '과도한 문장부호' },
    
    // Mixed spacing
    { pattern: /\s{3,}/g, type: 'excessive-spacing', message: '과도한 공백' },
    
    // Number-Korean mixing errors
    { pattern: /\d+[가-힣]{1,2}\d+/g, type: 'number-korean-mix', message: '숫자-한글 혼재 오류' },
  ];

  // Educational vocabulary for context checking
  private readonly educationalTerms = new Set([
    '학습', '활동', '참여', '수행', '노력', '발전', '성장', '이해', '탐구', '협력',
    '토론', '발표', '과제', '프로젝트', '연구', '실험', '관찰', '분석', '창의',
    '문제해결', '의사소통', '리더십', '책임감', '배려', '존중', '협동', '봉사',
    '독서', '글쓰기', '발표력', '표현력', '사고력', '판단력', '실행력', '적응력'
  ]);

  constructor() {
    super('spell_check', 'Spell Check Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells or very short text
    if (!text || text.trim().length < 2) {
      return errors;
    }

    const normalizedText = this.normalizeText(text.trim());
    
    // Skip pure numbers or dates
    if (this.isOnlyNumbers(normalizedText) || this.isDateTime(normalizedText)) {
      return errors;
    }

    // Check for common misspellings (VBA-style word checking)
    const misspellingErrors = this.checkCommonMisspellings(normalizedText, text, context);
    errors.push(...misspellingErrors);

    // Check for pattern-based errors
    const patternErrors = this.checkErrorPatterns(normalizedText, text, context);
    errors.push(...patternErrors);

    // Check educational context appropriateness
    const contextErrors = this.checkEducationalContext(normalizedText, text, context);
    errors.push(...contextErrors);

    // Check spacing consistency (VBA punctuation removal logic)
    const spacingErrors = this.checkSpacing(normalizedText, text, context);
    errors.push(...spacingErrors);

    return errors;
  }

  /**
   * Normalize text for spell checking (similar to VBA punctuation removal)
   */
  private normalizeText(text: string): string {
    // Remove punctuation like VBA does
    const punctuation = [',', '.', ';', ':', '!', '?', '(', ')', '"', "'"];
    let normalized = text;
    
    punctuation.forEach(punct => {
      normalized = normalized.replace(new RegExp(`\\${punct}`, 'g'), ' ');
    });
    
    return normalized.replace(/\s+/g, ' ').trim();
  }

  /**
   * Check for common misspellings (VBA Application.CheckSpelling equivalent)
   */
  private checkCommonMisspellings(
    normalizedText: string, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const [misspelling, correction] of this.commonMisspellings) {
      const regex = new RegExp(misspelling, 'gi');
      let match;
      
      while ((match = regex.exec(originalText)) !== null) {
        const error = this.createErrorWithHighlight(
          `맞춤법 오류: "${match[0]}" → "${correction}"으로 수정하세요`,
          'spell-check-misspelling',
          'warning',
          originalText,
          `"${match[0]}"를 "${correction}"로 수정하세요`,
          0.85,
          { start: match.index, end: match.index + match[0].length }
        );
        errors.push(error);
      }
    }
    
    return errors;
  }

  /**
   * Check for pattern-based spelling errors
   */
  private checkErrorPatterns(
    normalizedText: string, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const errorPattern of this.errorPatterns) {
      let match;
      errorPattern.pattern.lastIndex = 0; // Reset regex
      
      while ((match = errorPattern.pattern.exec(originalText)) !== null) {
        const error = this.createErrorWithHighlight(
          `${errorPattern.message}: "${match[0]}"`,
          `spell-check-${errorPattern.type}`,
          'warning',
          originalText,
          this.getSuggestionForPatternError(errorPattern.type, match[0]),
          0.8,
          { start: match.index, end: match.index + match[0].length }
        );
        errors.push(error);
      }
    }
    
    return errors;
  }

  /**
   * Check educational context appropriateness
   */
  private checkEducationalContext(
    normalizedText: string, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check if text contains educational vocabulary
    const words = normalizedText.split(/\s+/);
    const educationalWordCount = words.filter(word => this.educationalTerms.has(word)).length;
    
    // If text is longer than 50 characters but has no educational terms, flag it
    if (originalText.length > 50 && educationalWordCount === 0 && this.containsComplexSentences(normalizedText)) {
      const error = this.createError(
        '교육적 맥락 부족: 학습 활동과 관련된 표현을 포함하는 것을 권장합니다',
        'spell-check-context',
        'info',
        originalText,
        '학습, 활동, 참여, 성장 등의 교육 관련 용어를 포함하세요'
      );
      errors.push(error);
    }
    
    return errors;
  }

  /**
   * Check spacing consistency (VBA style)
   */
  private checkSpacing(
    normalizedText: string, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for spaces before punctuation (common error)
    const spaceBeforePunctuation = /\s+[.,!?]/g;
    let match;
    
    while ((match = spaceBeforePunctuation.exec(originalText)) !== null) {
      const error = this.createErrorWithHighlight(
        `문장부호 앞 불필요한 공백: "${match[0]}"`,
        'spell-check-spacing',
        'info',
        originalText,
        '문장부호 앞의 공백을 제거하세요',
        0.75,
        { start: match.index, end: match.index + match[0].length }
      );
      errors.push(error);
    }
    
    return errors;
  }

  /**
   * Get suggestion for pattern-based errors
   */
  private getSuggestionForPatternError(type: string, errorText: string): string {
    switch (type) {
      case 'double-consonant':
        return '중복된 자음을 제거하세요';
      case 'incomplete-hangul':
        return '완전한 한글로 입력하세요';
      case 'excessive-punctuation':
        return '문장부호를 적절히 사용하세요';
      case 'excessive-spacing':
        return '공백을 하나로 줄이세요';
      case 'number-korean-mix':
        return '숫자와 한글 사이에 적절한 간격을 두세요';
      default:
        return '맞춤법을 확인하세요';
    }
  }

  /**
   * Check if text contains complex sentences
   */
  private containsComplexSentences(text: string): boolean {
    const sentences = text.split(/[.!?]/);
    return sentences.some(sentence => sentence.trim().length > 30);
  }

  /**
   * Get column to check based on sheet name (VBA logic)
   */
  private getCheckColumn(context: ValidationContext): string {
    const sheet = context.sheet?.toLowerCase() || '';
    
    if (sheet.includes('창체') || sheet.includes('창의적체험활동')) {
      return 'I';
    } else if (sheet.includes('세특') || sheet.includes('세부특기')) {
      return 'F';
    } else if (sheet.includes('행특') || sheet.includes('행동특성')) {
      return 'E';
    }
    
    return 'I'; // Default
  }

  /**
   * Check if validation should be applied
   */
  shouldValidate(context: ValidationContext): boolean {
    // Apply spell checking primarily to content rows with Korean text
    const hasKoreanText = /[가-힣]/.test(context.cell || '');
    return context.neisContext?.isContentRow === true && hasKoreanText;
  }
}
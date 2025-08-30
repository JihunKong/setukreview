import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

/**
 * SpacingNormalizationValidator - Implements VBA spacing validation logic
 * Based on VBA Module7.bas (수상띄어쓰기) and general spacing patterns
 * 
 * Key VBA Logic:
 * - Remove all spaces for comparison: AA.Replace " ", ""
 * - Copy and paste operations for spacing analysis
 * - Normalize spacing for duplicate detection
 * - Check spacing consistency across different ranges
 */
export class SpacingNormalizationValidator extends BaseValidator {
  
  // Spacing rules for Korean text
  private readonly spacingRules = [
    // Particle spacing (조사 띄어쓰기)
    { pattern: /([가-힣]+)\s+(을|를|이|가|에게|에서|으로|로|와|과|의|도|만|은|는|에|께|한테)/g, 
      message: '조사는 앞 단어와 붙여 써야 합니다', type: 'particle-spacing' },
    
    // Auxiliary verb spacing (보조동사 띄어쓰기)
    { pattern: /([가-힣]+)\s+(주다|드리다|보다|오다|가다|하다|있다|없다|되다)/g,
      message: '보조동사는 본동사와 띄어 써야 합니다', type: 'auxiliary-verb-spacing' },
    
    // Number + unit spacing (숫자 단위 띄어쓰기)
    { pattern: /(\d+)\s*([가-힣]{1,2})/g,
      message: '숫자와 단위는 붙여 써야 합니다', type: 'number-unit-spacing' },
    
    // Punctuation spacing (문장부호 띄어쓰기)
    { pattern: /\s+([.!?,:;])/g,
      message: '문장부호 앞에는 공백이 없어야 합니다', type: 'punctuation-before-spacing' },
    
    { pattern: /([.!?])[^.\s]/g,
      message: '문장부호 뒤에는 공백이 있어야 합니다', type: 'punctuation-after-spacing' },
  ];

  // Excessive spacing patterns
  private readonly excessiveSpacingPatterns = [
    { pattern: /\s{3,}/g, message: '연속된 공백이 너무 많습니다', type: 'excessive-spaces' },
    { pattern: /^\s+/g, message: '문장 시작에 불필요한 공백이 있습니다', type: 'leading-spaces' },
    { pattern: /\s+$/g, message: '문장 끝에 불필요한 공백이 있습니다', type: 'trailing-spaces' },
  ];

  // Korean compound word patterns
  private readonly compoundWordPatterns = [
    // Common educational compound words that should not be spaced
    { pattern: /학교\s+생활/g, correct: '학교생활', message: '학교생활은 붙여 써야 합니다' },
    { pattern: /창의\s*적\s*체험\s*활동/g, correct: '창의적체험활동', message: '창의적체험활동은 붙여 써야 합니다' },
    { pattern: /세부\s*능력\s*및\s*특기\s*사항/g, correct: '세부능력및특기사항', message: '세부능력및특기사항은 붙여 써야 합니다' },
    { pattern: /행동\s*특성\s*및\s*종합\s*의견/g, correct: '행동특성및종합의견', message: '행동특성및종합의견은 붙여 써야 합니다' },
    
    // Common activity terms
    { pattern: /봉사\s+활동/g, correct: '봉사활동', message: '봉사활동은 붙여 써야 합니다' },
    { pattern: /동아리\s+활동/g, correct: '동아리활동', message: '동아리활동은 붙여 써야 합니다' },
    { pattern: /진로\s+활동/g, correct: '진로활동', message: '진로활동은 붙여 써야 합니다' },
    
    // Achievement terms
    { pattern: /문제\s+해결/g, correct: '문제해결', message: '문제해결은 붙여 써야 합니다' },
    { pattern: /의사\s+소통/g, correct: '의사소통', message: '의사소통은 붙여 써야 합니다' },
    { pattern: /협력\s+학습/g, correct: '협력학습', message: '협력학습은 붙여 써야 합니다' },
  ];

  constructor() {
    super('spacing_normalization', 'Spacing Normalization Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells or very short text
    if (!text || text.trim().length < 3) {
      return errors;
    }

    const originalText = text;
    
    // Skip pure numbers or dates
    if (this.isOnlyNumbers(originalText) || this.isDateTime(originalText)) {
      return errors;
    }

    // Check excessive spacing patterns
    const excessiveSpacingErrors = this.checkExcessiveSpacing(originalText, context);
    errors.push(...excessiveSpacingErrors);

    // Check Korean spacing rules
    const spacingRuleErrors = this.checkSpacingRules(originalText, context);
    errors.push(...spacingRuleErrors);

    // Check compound word spacing
    const compoundWordErrors = this.checkCompoundWordSpacing(originalText, context);
    errors.push(...compoundWordErrors);

    // Apply VBA-style spacing normalization check
    const normalizationErrors = this.checkSpacingNormalization(originalText, context);
    errors.push(...normalizationErrors);

    return errors;
  }

  /**
   * Check for excessive spacing patterns
   */
  private checkExcessiveSpacing(text: string, context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const spacingPattern of this.excessiveSpacingPatterns) {
      let match;
      spacingPattern.pattern.lastIndex = 0;
      
      while ((match = spacingPattern.pattern.exec(text)) !== null) {
        const error = this.createErrorWithHighlight(
          spacingPattern.message,
          `spacing-${spacingPattern.type}`,
          'warning',
          text,
          this.getSuggestionForSpacingError(spacingPattern.type, match[0]),
          0.8,
          { start: match.index, end: match.index + match[0].length }
        );
        errors.push(error);
      }
    }
    
    return errors;
  }

  /**
   * Check Korean spacing rules
   */
  private checkSpacingRules(text: string, context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const rule of this.spacingRules) {
      let match;
      rule.pattern.lastIndex = 0;
      
      while ((match = rule.pattern.exec(text)) !== null) {
        const error = this.createErrorWithHighlight(
          rule.message,
          `spacing-rule-${rule.type}`,
          'info',
          text,
          this.getSpacingRuleSuggestion(rule.type, match[0]),
          0.7,
          { start: match.index, end: match.index + match[0].length }
        );
        errors.push(error);
      }
    }
    
    return errors;
  }

  /**
   * Check compound word spacing
   */
  private checkCompoundWordSpacing(text: string, context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const compoundPattern of this.compoundWordPatterns) {
      let match;
      compoundPattern.pattern.lastIndex = 0;
      
      while ((match = compoundPattern.pattern.exec(text)) !== null) {
        const error = this.createErrorWithHighlight(
          compoundPattern.message,
          'spacing-compound-word',
          'warning',
          text,
          `"${match[0]}"를 "${compoundPattern.correct}"로 수정하세요`,
          0.85,
          { start: match.index, end: match.index + match[0].length }
        );
        errors.push(error);
      }
    }
    
    return errors;
  }

  /**
   * Check spacing normalization (VBA style)
   */
  private checkSpacingNormalization(text: string, context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // VBA logic: Remove all spaces and compare
    const spacesRemoved = text.replace(/\s/g, '');
    const normalSpacing = this.applyProperSpacing(spacesRemoved);
    
    if (normalSpacing !== text && this.hasSignificantSpacingDifference(text, normalSpacing)) {
      const error = this.createError(
        '띄어쓰기 정규화 제안: 올바른 띄어쓰기 규칙을 적용하세요',
        'spacing-normalization',
        'info',
        text,
        `정규화된 형태: "${this.truncateText(normalSpacing)}"`
      );
      errors.push(error);
    }
    
    return errors;
  }

  /**
   * Apply proper Korean spacing rules
   */
  private applyProperSpacing(textWithoutSpaces: string): string {
    let result = textWithoutSpaces;
    
    // Apply basic Korean spacing rules
    // Add spaces around certain particles and conjunctions
    result = result.replace(/([가-힣]+)(그리고|하지만|그런데|또한)([가-힣]+)/g, '$1 $2 $3');
    
    // Add spaces after periods
    result = result.replace(/\.([가-힣])/g, '. $1');
    
    // Add spaces around numbers and Korean text
    result = result.replace(/(\d+)([가-힣])/g, '$1 $2');
    result = result.replace(/([가-힣])(\d+)/g, '$1 $2');
    
    return result;
  }

  /**
   * Check if there's a significant difference in spacing
   */
  private hasSignificantSpacingDifference(original: string, normalized: string): boolean {
    const originalSpaceCount = (original.match(/\s/g) || []).length;
    const normalizedSpaceCount = (normalized.match(/\s/g) || []).length;
    
    // Consider it significant if space count differs by more than 2
    return Math.abs(originalSpaceCount - normalizedSpaceCount) > 2;
  }

  /**
   * Get suggestion for spacing errors
   */
  private getSuggestionForSpacingError(type: string, errorText: string): string {
    switch (type) {
      case 'excessive-spaces':
        return '공백을 하나로 줄이세요';
      case 'leading-spaces':
        return '문장 시작의 공백을 제거하세요';
      case 'trailing-spaces':
        return '문장 끝의 공백을 제거하세요';
      default:
        return '적절한 공백으로 수정하세요';
    }
  }

  /**
   * Get spacing rule suggestions
   */
  private getSpacingRuleSuggestion(type: string, errorText: string): string {
    switch (type) {
      case 'particle-spacing':
        return '조사를 앞 단어와 붙여서 쓰세요';
      case 'auxiliary-verb-spacing':
        return '보조동사를 본동사와 띄어서 쓰세요';
      case 'number-unit-spacing':
        return '숫자와 단위를 붙여서 쓰세요';
      case 'punctuation-before-spacing':
        return '문장부호 앞의 공백을 제거하세요';
      case 'punctuation-after-spacing':
        return '문장부호 뒤에 공백을 추가하세요';
      default:
        return '올바른 띄어쓰기를 적용하세요';
    }
  }

  /**
   * Truncate text for display
   */
  private truncateText(text: string): string {
    return text.length > 60 ? text.substring(0, 57) + '...' : text;
  }

  /**
   * Normalize spaces for comparison (VBA equivalent)
   */
  private normalizeSpacesForComparison(text: string): string {
    // VBA style: Remove all spaces
    return text.replace(/\s/g, '');
  }

  /**
   * Check specific spacing patterns for educational content
   */
  private checkEducationalSpacingPatterns(text: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Common educational spacing errors
    const educationalPatterns = [
      { pattern: /([가-힣]+)\s+(하였다|하였음|하였습니다)/g, 
        message: '과거시제 어미는 동사와 붙여 써야 합니다' },
      { pattern: /([가-힣]+)\s+(입니다|습니다|됩니다)/g, 
        message: '경어 어미는 동사와 붙여 써야 합니다' },
      { pattern: /통해\s+서/g, 
        message: '통해서는 붙여 써야 합니다' },
      { pattern: /함으로\s+써/g, 
        message: '함으로써는 붙여 써야 합니다' },
    ];

    for (const pattern of educationalPatterns) {
      let match;
      pattern.pattern.lastIndex = 0;
      
      while ((match = pattern.pattern.exec(text)) !== null) {
        const error = this.createErrorWithHighlight(
          pattern.message,
          'spacing-educational-pattern',
          'info',
          text,
          '단어를 붙여서 쓰세요',
          0.75,
          { start: match.index, end: match.index + match[0].length }
        );
        errors.push(error);
      }
    }
    
    return errors;
  }

  /**
   * Check if validation should be applied
   */
  shouldValidate(context: ValidationContext): boolean {
    // Apply spacing validation to all content rows with Korean text
    const hasKoreanText = /[가-힣]/.test(context.cell || '');
    return context.neisContext?.isContentRow === true && hasKoreanText;
  }
}
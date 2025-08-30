import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

/**
 * VBAAlphabetValidator - Implements exact VBA alphabet detection logic
 * Based on VBA modules: 알파벳검색.bas, 알파벳정리.bas
 * 
 * Key VBA Logic:
 * - Uses regex [A-Za-z]+ to find any alphabetic characters
 * - Highlights matches in red bold text
 * - Marks problematic rows with value 1 in specific columns
 * - Applied to different NEIS sections (창체활동, 세부특기, etc.)
 */
export class VBAAlphabetValidator extends BaseValidator {
  // Exact VBA regex pattern for alphabet detection
  private readonly alphabetPattern: RegExp = /[A-Za-z]+/g;
  
  // Section-specific column mappings from VBA analysis
  private readonly sectionColumnMappings = {
    '창체활동': { contentColumn: 'I', flagColumn: 97 }, // CQ column
    '세부특기': { contentColumn: 'F', flagColumn: 97 },
    '행동특성': { contentColumn: 'I', flagColumn: 97 },
    '진로활동': { contentColumn: 'I', flagColumn: 97 },
    '개별점검': { contentColumn: 'I', flagColumn: 97 }
  };

  // Allowed English terms that should NOT trigger the VBA alphabet validator
  // These are exceptions that the VBA code should allow
  private readonly vbaAllowedEnglish: Set<string> = new Set([
    // Common educational abbreviations
    'STEAM', 'STEM', 'AI', 'VR', 'AR', 'IT', 'SW', 'HW',
    'CEO', 'PD', 'UCC', 'POP', 'CF', 'TV', 'SNS', 'PPT',
    
    // Units and measurements
    'kg', 'cm', 'mm', 'km', 'pH', 'CO2', 'H2O',
    
    // Common terms in Korean education
    'QR', 'USB', 'GPS', 'LED', 'LCD', 'DVD', 'CD',
    'URL', 'HTTP', 'WWW', 'PC', 'OS',
    
    // Educational qualifications
    'TOEIC', 'TOEFL', 'IELTS', 'SAT', 'AP', 'IB'
  ]);

  constructor() {
    super('vba_alphabet', 'VBA Alphabet Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells, pure numbers, or dates
    if (!text || this.isOnlyNumbers(text) || this.isDateTime(text)) {
      return errors;
    }

    const normalizedText = text.trim();
    
    // Skip very short text that might be abbreviations
    if (normalizedText.length < 2) {
      return errors;
    }

    // Find all alphabet matches using exact VBA pattern
    const alphabetMatches = this.findAlphabetMatches(normalizedText);
    
    if (alphabetMatches.length === 0) {
      return errors; // No English text found
    }

    // Process each alphabet match
    for (const match of alphabetMatches) {
      if (!this.isVBAAllowedException(match.text, normalizedText)) {
        const error = this.createVBAAlphabetError(match, text, context);
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Find alphabet matches using exact VBA regex pattern
   */
  private findAlphabetMatches(text: string): Array<{text: string, start: number, end: number}> {
    const matches: Array<{text: string, start: number, end: number}> = [];
    let match: RegExpExecArray | null;
    
    // Reset regex lastIndex
    this.alphabetPattern.lastIndex = 0;
    
    while ((match = this.alphabetPattern.exec(text)) !== null) {
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    return matches;
  }

  /**
   * Check if the English text should be allowed (VBA exceptions)
   */
  private isVBAAllowedException(englishText: string, fullText: string): boolean {
    const upperText = englishText.toUpperCase();
    
    // Check against VBA allowed list
    if (this.vbaAllowedEnglish.has(upperText)) {
      return true;
    }

    // Allow single letters that might be grades or codes
    if (englishText.length === 1) {
      return true;
    }

    // Allow common model numbers (letter + numbers)
    if (/^[A-Z]\d+$/.test(upperText)) {
      return true;
    }

    // Allow URLs and email patterns
    if (this.isUrlOrEmail(fullText)) {
      return true;
    }

    // Allow foreign names (proper capitalization)
    if (this.isForeignName(englishText)) {
      return true;
    }

    // Allow road addresses with English
    if (this.isRoadAddress(fullText)) {
      return true;
    }

    return false;
  }

  /**
   * Create VBA-specific alphabet validation error
   */
  private createVBAAlphabetError(
    match: {text: string, start: number, end: number}, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError {
    
    // Get context around the match (similar to VBA highlighting)
    const contextLength = 15;
    const contextStart = Math.max(0, match.start - contextLength);
    const contextEnd = Math.min(originalText.length, match.end + contextLength);
    
    const contextBefore = match.start > contextLength ? 
      '...' + originalText.substring(contextStart, match.start) :
      originalText.substring(0, match.start);
      
    const contextAfter = match.end + contextLength < originalText.length ?
      originalText.substring(match.end, contextEnd) + '...' :
      originalText.substring(match.end);

    // Determine section-specific message
    const sectionInfo = this.getSectionInfo(context);
    const sectionMessage = sectionInfo ? ` (${sectionInfo.sectionName} 영역)` : '';

    return this.createErrorWithHighlight(
      `VBA 알파벳 검출: "${match.text}" - 한글 입력이 필요합니다${sectionMessage}`,
      'vba-alphabet-detection',
      'warning',
      originalText,
      this.suggestKoreanReplacement(match.text),
      0.9, // High confidence - exact VBA pattern match
      { start: match.start, end: match.end },
      contextBefore,
      contextAfter
    );
  }

  /**
   * Get section-specific information based on context
   */
  private getSectionInfo(context: ValidationContext): {sectionName: string, contentColumn: string} | null {
    const sheet = context.sheet?.toLowerCase() || '';
    
    if (sheet.includes('창체') || sheet.includes('창의적체험활동')) {
      return { sectionName: '창체활동', contentColumn: 'I' };
    }
    if (sheet.includes('세특') || sheet.includes('세부특기')) {
      return { sectionName: '세부특기', contentColumn: 'F' };
    }
    if (sheet.includes('행특') || sheet.includes('행동특성')) {
      return { sectionName: '행동특성', contentColumn: 'I' };
    }
    if (sheet.includes('진로')) {
      return { sectionName: '진로활동', contentColumn: 'I' };
    }
    if (sheet.includes('개별')) {
      return { sectionName: '개별점검', contentColumn: 'I' };
    }
    
    return null;
  }

  /**
   * Check if text contains URL or email pattern
   */
  private isUrlOrEmail(text: string): boolean {
    const urlPattern = /https?:\/\/|www\.|@.*\./;
    return urlPattern.test(text);
  }

  /**
   * Check if text appears to be a foreign name
   */
  private isForeignName(text: string): boolean {
    // Check for proper name capitalization (First Last format)
    const namePattern = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/;
    return namePattern.test(text) && text.includes(' ');
  }

  /**
   * Check if text contains road address with English
   */
  private isRoadAddress(text: string): boolean {
    // Korean road addresses often contain English road names
    const roadPattern = /\d+[가-힣\s]*[A-Za-z]+[가-힣\s]*\d*/;
    return roadPattern.test(text);
  }

  /**
   * Suggest Korean replacement for English text
   */
  private suggestKoreanReplacement(englishText: string): string {
    const suggestions: Record<string, string> = {
      'competition': '대회',
      'contest': '경진대회',
      'award': '상',
      'certificate': '인증서',
      'program': '프로그램',
      'project': '프로젝트',
      'activity': '활동',
      'club': '동아리',
      'team': '팀',
      'group': '그룹',
      'study': '학습',
      'research': '연구',
      'presentation': '발표',
      'report': '보고서',
      'experience': '경험',
      'volunteer': '봉사',
      'service': '서비스',
      'leadership': '리더십',
      'skill': '기술',
      'knowledge': '지식'
    };

    const lowerText = englishText.toLowerCase();
    if (suggestions[lowerText]) {
      return `"${englishText}"를 "${suggestions[lowerText]}"로 변경을 검토하세요`;
    }

    return `"${englishText}"에 대한 한글 표현 사용을 검토하세요`;
  }

  /**
   * Check if the validation should be applied to this context
   * Based on VBA column mappings
   */
  shouldValidate(context: ValidationContext): boolean {
    // VBA alphabet validator is applied to specific columns in specific sections
    const sectionInfo = this.getSectionInfo(context);
    if (!sectionInfo) {
      return true; // Apply to all if section not identified
    }

    // In VBA, this validator is applied to specific columns
    // For web implementation, we apply to content fields
    return context.neisContext?.isContentRow === true;
  }
}
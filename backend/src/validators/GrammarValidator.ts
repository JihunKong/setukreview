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
    if (normalizedText.length < 20) { // Increased threshold to reduce noise
      return errors;
    }

    // Skip if it's a title, header, or list item
    if (this.isTitle(normalizedText) || this.isListItem(normalizedText)) {
      return errors;
    }

    // Skip if text looks like structured data or contains many numbers/dates
    if (this.isStructuredData(normalizedText)) {
      return errors;
    }

    // Check if text ends with appropriate punctuation
    const endsWithPunctuation = /[.!?。]$/.test(normalizedText);
    
    if (!endsWithPunctuation && this.shouldEndWithPeriod(normalizedText)) {
      // Only report for clearly narrative text
      if (this.isNarrativeText(normalizedText)) {
        const error = this.createError(
          '문장의 끝에 마침표가 빠져있습니다',
          'missing-period',
          'info',
          originalText,
          `${normalizedText}.`
        );
        errors.push(error);
      }
    }

    return errors;
  }

  private checkDoubleSpacing(normalizedText: string, originalText: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for excessive consecutive spaces (5 or more, to be less strict)
    const excessiveSpacePattern = /\s{5,}/g;
    let match;
    const matches = [];
    
    // Find all matches with their positions
    while ((match = excessiveSpacePattern.exec(normalizedText)) !== null) {
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        length: match[0].length
      });
    }
    
    if (matches.length > 0) {
      // Skip if it looks like intentional indentation or tabular formatting
      if (this.isIntentionalSpacing(normalizedText)) {
        return errors;
      }
      
      // Only report if there are many instances or very long spaces
      const spaceCount = matches.reduce((sum, match) => sum + match.length, 0);
      const maxSpaces = Math.max(...matches.map(m => m.length));
      
      if (spaceCount > 10 || matches.some(match => match.length > 8)) {
        // Create error for the first (or longest) excessive spacing occurrence
        const targetMatch = matches.reduce((longest, current) => 
          current.length > longest.length ? current : longest
        );
        
        // Calculate context around the spacing error
        const contextLength = 15;
        const contextStart = Math.max(0, targetMatch.start - contextLength);
        const contextEnd = Math.min(normalizedText.length, targetMatch.end + contextLength);
        
        const contextBefore = targetMatch.start > contextLength ? 
          '...' + normalizedText.substring(contextStart, targetMatch.start) :
          normalizedText.substring(0, targetMatch.start);
          
        const contextAfter = targetMatch.end + contextLength < normalizedText.length ?
          normalizedText.substring(targetMatch.end, contextEnd) + '...' :
          normalizedText.substring(targetMatch.end);
        
        const error = this.createErrorWithHighlight(
          `과도한 연속 공백이 발견되었습니다 (${maxSpaces}개)`,
          'excessive-spacing',
          'info',
          originalText,
          normalizedText.replace(/\s{5,}/g, ' '),
          0.9,
          { start: targetMatch.start, end: targetMatch.end },
          contextBefore,
          contextAfter
        );
        errors.push(error);
      }
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
          'info',
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

  /**
   * Check if spacing appears to be intentional formatting (tables, lists, indentation)
   */
  private isIntentionalSpacing(text: string): boolean {
    // Check for tabular data patterns (numbers or structured content with spacing)
    const tabularPatterns = [
      /\d+\s{3,}\d+/,           // Numbers separated by multiple spaces
      /[가-힣]+\s{3,}[가-힣]+\s{3,}[가-힣]+/, // Korean words in columns
      /^[\s]{3,}[^\s]/m,        // Lines starting with indentation
      /[A-Za-z]\s{3,}[A-Za-z]/, // English letters in columns
    ];
    
    // Check for list-like formatting
    const listPatterns = [
      /^\s*[-•·]\s+/m,          // Bullet points with spacing
      /^\s*\d+\.\s+/m,          // Numbered lists with spacing
      /^\s*[가나다라마]\.\s+/m, // Korean numbered lists
    ];
    
    const allPatterns = [...tabularPatterns, ...listPatterns];
    
    return allPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if text contains structured data (numbers, dates, tables) rather than narrative content
   */
  private isStructuredData(text: string): boolean {
    // Check for patterns indicating structured/tabular data
    const structuredPatterns = [
      /\d{4}[-./]\d{1,2}[-./]\d{1,2}/,    // Date patterns
      /\d+시\s*\d*분?/,                   // Time patterns (3시, 14시 30분)
      /\d+학년\s*\d*반?/,                 // Grade/class patterns
      /^\s*\d+[.)\s]/,                   // Numbered list items
      /\d+\s*[점명개]$/,                  // Numbers with units (5점, 3명, 2개)
      /^\s*[-•·]\s/,                     // Bullet points
      /\d+\s*[%℃도]/,                   // Percentages, temperatures
      /[가-힣]+\s*:\s*\d/,               // Label: number patterns
      /\d+\s*\/\s*\d+/,                  // Fraction patterns (3/5)
    ];

    // If more than 30% of text is numbers/punctuation, likely structured
    const nonKoreanChars = text.replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').length;
    const totalChars = text.length;
    const nonKoreanRatio = totalChars > 0 ? nonKoreanChars / totalChars : 0;

    return structuredPatterns.some(pattern => pattern.test(text)) || 
           nonKoreanRatio > 0.3;
  }

  /**
   * Check if text is narrative content that should end with proper punctuation
   */
  private isNarrativeText(text: string): boolean {
    // Text is narrative if it contains Korean sentence patterns
    const narrativePatterns = [
      /[가-힣]+다\s*$/,                   // Verb endings: ~다
      /[가-힣]+었다\s*$/,                 // Past tense: ~었다
      /[가-힣]+였다\s*$/,                 // Past tense: ~였다  
      /[가-힣]+했다\s*$/,                 // Past tense: ~했다
      /[가-힣]+한다\s*$/,                 // Present tense: ~한다
      /[가-힣]+된다\s*$/,                 // Passive: ~된다
      /[가-힣]+있다\s*$/,                 // State: ~있다
      /[가-힣]+없다\s*$/,                 // Negation: ~없다
      /[가-힣]+된\s*[가-힣]+/,           // Adjective patterns
      /[가-힣]+하는\s*[가-힣]+/,         // Modifier patterns
    ];

    // Must contain Korean text and sentence-like patterns
    const hasKoreanText = /[가-힣]/.test(text);
    const hasNarrativePattern = narrativePatterns.some(pattern => pattern.test(text));
    
    // Must be longer than typical structured data
    const isLongEnough = text.length > 15;
    
    // Should not be predominantly numbers/symbols
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const hasEnoughKorean = koreanChars > 5;

    return hasKoreanText && hasNarrativePattern && isLongEnough && hasEnoughKorean;
  }
}
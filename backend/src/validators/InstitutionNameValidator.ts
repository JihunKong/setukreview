import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

export class InstitutionNameValidator extends BaseValidator {
  private readonly allowedInstitutions: Set<string>;
  private readonly prohibitedPatterns: RegExp[];
  private readonly allowedPatterns: RegExp[];

  constructor() {
    super('institution_name', 'Institution Name Validator');
    
    // Educational institutions that are allowed
    this.allowedInstitutions = new Set([
      // 교육부 소속기관 (6개)
      '대한민국학술원',
      '국사편찬위원회',
      '국립국제교육원',
      '국립특수교육원',
      '교원소청심사위원회',
      '중앙교육연수원',
      
      // 교육부
      '교육부',
      
      // 시도교육청 (일반적인 명칭)
      '교육청',
      '교육지원청',
      '직속기관',
      '소속기관',
      
      // 일반적인 교육관련 기관 표현
      '학교밖교육기관',
      '교육기관',
      '교육관련기관'
    ]);

    // Patterns that typically indicate prohibited institution names
    this.prohibitedPatterns = [
      // University names
      /\b[가-힣]+대학교?\b/,
      /\b[가-힣]*대학\b/,
      
      // Company names
      /\b[가-힣]+(?:회사|기업|그룹|코퍼레이션|Corp|Inc|Ltd)\b/i,
      
      // Hospital names
      /\b[가-힣]+병원\b/,
      /\b[가-힣]+의료원\b/,
      
      // Foundation names
      /\b[가-힣]+재단\b/,
      /\b[가-힣]+법인\b/,
      
      // Institute names
      /\b[가-힣]+연구소\b/,
      /\b[가-힣]+연구원\b/,
      /\b[가-힣]+연구센터\b/,
      
      // Cultural centers
      /\b[가-힣]+문화센터\b/,
      /\b[가-힣]+센터\b/,
      
      // Private academies
      /\b[가-힣]+학원\b/,
      
      // Museums
      /\b[가-힣]+박물관\b/,
      /\b[가-힣]+미술관\b/,
      
      // Religious organizations
      /\b[가-힣]+교회\b/,
      /\b[가-힣]+성당\b/,
      /\b[가-힣]+사찰\b/,
      
      // Specific instructor names (Korean names pattern)
      /\b[가-힣]{2,4}\s?(?:선생님?|교사|강사|교수|박사|원장)\b/,
      
      // Commercial brand names
      /\b[A-Z][a-zA-Z]*\s?[가-힣]*(?:코리아|Korea)\b/i,
      
      // Media companies
      /\b[가-힣]+(?:방송|미디어|언론|신문|잡지)\b/
    ];

    // Patterns for allowed educational institutions
    this.allowedPatterns = [
      // Education office patterns
      /\b[가-힣]+교육청\b/,
      /\b[가-힣]+교육지원청\b/,
      
      // General educational terms
      /\b교육관련기관\b/,
      /\b학교밖교육기관\b/,
      /\b교육기관\b/,
      
      // Ministry of Education related
      /\b교육부.*기관\b/,
      /\b교육부.*소속\b/
    ];
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells, numbers only, or dates
    if (!text || this.isOnlyNumbers(text) || this.isDateTime(text)) {
      return errors;
    }

    const normalizedText = this.normalizeWhitespace(text);
    
    // Check if this appears to be a volunteer activity location (봉사활동)
    if (this.isVolunteerActivityContext(normalizedText, context)) {
      // Volunteer activity locations are allowed to have specific institution names
      return errors;
    }

    // Check for prohibited institution patterns
    const prohibitedMatches = this.findProhibitedInstitutions(normalizedText);
    
    for (const match of prohibitedMatches) {
      // Check if this institution is in the allowed list
      if (!this.isAllowedInstitution(match)) {
        const error = this.createError(
          `구체적인 기관명 사용 금지: "${match}"`,
          'institution-name-rule',
          'error',
          text,
          this.suggestGenericAlternative(match)
        );
        errors.push(error);
      }
    }

    // Check for specific instructor names
    const instructorMatches = this.findInstructorNames(normalizedText);
    
    for (const match of instructorMatches) {
      const error = this.createError(
        `특정 강사명 사용 금지: "${match}"`,
        'instructor-name-rule',
        'error',
        text,
        '강사, 전문가, 외부 강사 등으로 표기'
      );
      errors.push(error);
    }

    return errors;
  }

  private isVolunteerActivityContext(text: string, context: ValidationContext): boolean {
    // Check if this is in a volunteer activity context
    const volunteerKeywords = ['봉사', '봉사활동', '자원봉사', '장소', '주관기관'];
    return volunteerKeywords.some(keyword => text.includes(keyword)) ||
           volunteerKeywords.some(keyword => context.sheet.includes(keyword));
  }

  private findProhibitedInstitutions(text: string): string[] {
    const matches: string[] = [];
    
    for (const pattern of this.prohibitedPatterns) {
      const match = text.match(pattern);
      if (match) {
        matches.push(match[0]);
      }
    }

    return matches;
  }

  private findInstructorNames(text: string): string[] {
    const matches: string[] = [];
    
    // Pattern for Korean names followed by instructor titles
    const instructorPattern = /\b[가-힣]{2,4}\s?(?:선생님?|교사|강사|교수|박사|원장|대표|관장)\b/g;
    let match;
    
    while ((match = instructorPattern.exec(text)) !== null) {
      matches.push(match[0]);
    }

    return matches;
  }

  private isAllowedInstitution(institutionName: string): boolean {
    // Check exact match in allowed institutions
    if (this.allowedInstitutions.has(institutionName)) {
      return true;
    }

    // Check against allowed patterns
    for (const pattern of this.allowedPatterns) {
      if (pattern.test(institutionName)) {
        return true;
      }
    }

    // Check if it contains allowed institution keywords
    const allowedKeywords = Array.from(this.allowedInstitutions);
    return allowedKeywords.some(keyword => institutionName.includes(keyword));
  }

  private suggestGenericAlternative(institutionName: string): string {
    // Suggest generic alternatives based on the type of institution
    if (institutionName.includes('대학')) {
      return '대학교, 고등교육기관';
    }
    if (institutionName.includes('병원')) {
      return '의료기관';
    }
    if (institutionName.includes('연구')) {
      return '연구기관';
    }
    if (institutionName.includes('문화센터') || institutionName.includes('센터')) {
      return '문화시설, 교육시설';
    }
    if (institutionName.includes('학원')) {
      return '교육기관';
    }
    if (institutionName.includes('재단') || institutionName.includes('법인')) {
      return '기관, 단체';
    }
    if (institutionName.includes('박물관') || institutionName.includes('미술관')) {
      return '문화시설';
    }
    if (institutionName.includes('교회') || institutionName.includes('성당') || institutionName.includes('사찰')) {
      return '종교시설';
    }
    if (institutionName.includes('회사') || institutionName.includes('기업')) {
      return '기업체, 사업체';
    }
    
    return '관련 기관, 외부 기관';
  }
}
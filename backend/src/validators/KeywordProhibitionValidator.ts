import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

/**
 * KeywordProhibitionValidator - Implements VBA keyword prohibition logic
 * Based on VBA modules: Module3.bas, Module4.bas, Module6.bas, Module9.bas, Module14.bas
 * 
 * Key VBA Logic:
 * - Keywords stored in specific cells (S4, T4, U4, V4, W4, etc.)
 * - Different keyword sets for different validation types
 * - Section-specific validation (창체활동, 세부특기, 행동특성, 진로활동)
 * - Red highlighting for prohibited keywords
 */
export class KeywordProhibitionValidator extends BaseValidator {
  
  // Comprehensive keyword categories extracted from VBA analysis
  private readonly prohibitedKeywords = {
    // Competition-related terms (창체대회, 세특대회, etc.)
    competitions: new Set([
      '대회', '경진대회', '올림피아드', '공모전', '콘테스트', 'contest',
      '경연대회', '토너먼트', '챔피언십', '선발대회', '예선', '본선', '결선',
      '수학올림피아드', '과학올림피아드', '정보올림피아드', '물리올림피아드',
      '화학올림피아드', '생물올림피아드', '지구과학올림피아드',
      '국제수학올림피아드', '국제과학올림피아드', 'IMO', 'IPhO', 'IChO', 'IBO',
      '한국수학올림피아드', 'KMO', '한국물리올림피아드', 'KPhO'
    ]),

    // Awards and recognition (창체표창, 세특표창, etc.)
    awards: new Set([
      '표창', '상장', '수상', '우수상', '최우수상', '금상', '은상', '동상',
      '대상', '특상', '장려상', '입상', '당선', '선발', '선정',
      '교육감상', '교육부장관상', '국무총리상', '대통령상',
      '학교장상', '교장상', '학급상', '모범상', '우등상'
    ]),

    // External activities (창체교외, 세특교외, etc.)
    external: new Set([
      '교외', '외부기관', '사설기관', '민간기관', '사설학원', '사설교육기관',
      '학원', '과외', '개인교습', '개인지도', '외부강사', '외부교육',
      '사설연수', '민간연수', '외부연수', '사설프로그램', '민간프로그램'
    ]),

    // Certifications (창체인증, 세특인증, etc.)
    certifications: new Set([
      '인증', '자격증', '면허', '면허증', '증명서', '수료증', '이수증',
      '검정고시', '토익', 'TOEIC', '토플', 'TOEFL', '아이엘츠', 'IELTS',
      '텝스', 'TEPS', '오픽', 'OPIc', 'JPT', 'JLPT', 'HSK', 'DELE',
      '컴활', '워드프로세서', 'GTQ', 'ITQ', '정보처리기사', '네트워크관리사'
    ]),

    // Publications (창체논문, 세특논문, etc.)
    publications: new Set([
      '논문', '출간', '도서', '책', '저서', '공저', '편저', '역서',
      '학술논문', '연구논문', '소논문', '리포트', '보고서출간',
      '출판', '발행', '간행물', '학회지', '저널', 'journal',
      '국제논문', 'SCI', 'SCIE', 'SSCI', 'A&HCI'
    ]),

    // Patents and inventions (창체특허, 세특특허, etc.)
    patents: new Set([
      '특허', '출원', '발명', '실용신안', '디자인등록', '상표등록',
      '지적재산권', '아이디어', '창작물', '발명품', '특허청',
      '국제특허', 'PCT', '미국특허', '일본특허', '중국특허'
    ]),

    // Language and overseas (창체어학, 세특어학, etc.)
    language: new Set([
      '어학', '연수', '해외', '유학', '교환학생', '해외연수', '어학연수',
      '해외여행', '국제교류', '외국어', '영어캠프', '해외캠프',
      '단기유학', '장기유학', '어학원', '해외어학원', '해외인턴',
      '글로벌', '국제', '외국', '영어권', '중국어권', '일본어권'
    ]),

    // Scholarships (창체장학, 세특장학, etc.)
    scholarships: new Set([
      '장학', '장학금', '장학생', '전액장학금', '반액장학금', '부분장학금',
      '성적장학금', '특기장학금', '외부장학금', '교내장학금',
      '정부장학금', '국가장학금', '민간장학금', '기업장학금',
      '재단장학금', '단체장학금', '개인장학금'
    ]),

    // Grades and levels (창체등급, 세특등급, etc.)
    grades: new Set([
      '등급', '급수', '단계', '레벨', 'level', '1급', '2급', '3급', '4급', '5급',
      '초급', '중급', '고급', '상급', '최고급', '1등급', '2등급', '3등급',
      '특급', '고급자', '중급자', '초급자', '입문자', '전문가급'
    ]),

    // Family references (창체아버지, 창체어머니, etc.)
    family: new Set([
      '아버지', '어머니', '아빠', '엄마', '부모', '부모님', '가족',
      '형', '누나', '언니', '동생', '오빠', '남동생', '여동생',
      '할아버지', '할머니', '외할아버지', '외할머니', '조부', '조모',
      '삼촌', '고모', '이모', '외삼촌', '사촌', '친척'
    ]),

    // Specific institutions (VBA 전남대 and similar patterns)
    institutions: new Set([
      '전남대', '전남대학교', '서울대', '서울대학교', '연세대', '연세대학교',
      '고려대', '고려대학교', '카이스트', 'KAIST', '포스텍', 'POSTECH',
      '서강대', '성균관대', '한양대', '중앙대', '경희대', '한국외대',
      '이화여대', '숙명여대', '국민대', '건국대', '동국대', '홍익대',
      '광운대', '명지대', '상명대', '세종대', '단국대', '아주대'
    ]),

    // Instructor names and titles
    instructors: new Set([
      '강사', '교수', '선생', '선생님', '교사', '박사', '원장', '관장',
      '지도교수', '담당교수', '전임교수', '객원교수', '초빙교수',
      '강사님', '교수님', '박사님', '원장님', '관장님'
    ]),

    // Commercial and private entities
    commercial: new Set([
      '회사', '기업', '법인', '재단', '협회', '단체', '조합', '센터',
      '연구소', '연구원', '연구센터', '기술원', '개발원',
      'SK', 'LG', '삼성', '현대', 'KT', 'CJ', '롯데', '신세계',
      '(주)', '주식회사', '유한회사', '합자회사', 'Inc', 'Corp', 'Ltd'
    ])
  };

  // Section-specific keyword restrictions (based on VBA modules)
  private readonly sectionKeywordMappings = {
    '창체활동': ['competitions', 'awards', 'external', 'certifications', 'publications', 
                'patents', 'language', 'scholarships', 'grades', 'family', 'institutions'],
    '세부특기': ['competitions', 'awards', 'external', 'publications', 'patents', 
                'language', 'scholarships', 'grades', 'family', 'institutions'],
    '행동특성': ['awards', 'external', 'certifications', 'scholarships', 'grades', 
                'family', 'institutions', 'instructors'],
    '진로활동': ['competitions', 'awards', 'external', 'certifications', 'publications',
                'patents', 'language', 'scholarships', 'grades', 'family'],
    '개별점검': ['competitions', 'awards', 'external', 'certifications', 'publications',
                'patents', 'language', 'scholarships', 'grades', 'family', 'institutions']
  };

  constructor() {
    super('keyword_prohibition', 'Keyword Prohibition Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells or very short text
    if (!text || text.trim().length < 2) {
      return errors;
    }

    const normalizedText = text.trim();

    // Get applicable keyword categories for this section
    const sectionName = this.getSectionName(context);
    const applicableCategories = this.getApplicableCategories(sectionName);

    // Check each applicable category
    for (const categoryName of applicableCategories) {
      const keywords = this.prohibitedKeywords[categoryName as keyof typeof this.prohibitedKeywords];
      if (keywords) {
        const violations = this.findKeywordViolations(normalizedText, keywords, categoryName);
        
        for (const violation of violations) {
          const error = this.createKeywordError(violation, text, context, categoryName);
          errors.push(error);
        }
      }
    }

    return errors;
  }

  /**
   * Get section name from context
   */
  private getSectionName(context: ValidationContext): string {
    const sheet = context.sheet?.toLowerCase() || '';
    
    if (sheet.includes('창체') || sheet.includes('창의적체험활동')) {
      return '창체활동';
    }
    if (sheet.includes('세특') || sheet.includes('세부특기')) {
      return '세부특기';
    }
    if (sheet.includes('행특') || sheet.includes('행동특성')) {
      return '행동특성';
    }
    if (sheet.includes('진로')) {
      return '진로활동';
    }
    if (sheet.includes('개별')) {
      return '개별점검';
    }
    
    return 'general'; // Default to general validation
  }

  /**
   * Get applicable keyword categories for a section
   */
  private getApplicableCategories(sectionName: string): string[] {
    if (this.sectionKeywordMappings[sectionName as keyof typeof this.sectionKeywordMappings]) {
      return this.sectionKeywordMappings[sectionName as keyof typeof this.sectionKeywordMappings];
    }
    
    // Default to all categories if section not specified
    return Object.keys(this.prohibitedKeywords);
  }

  /**
   * Find keyword violations in text
   */
  private findKeywordViolations(
    text: string, 
    keywords: Set<string>, 
    categoryName: string
  ): Array<{keyword: string, start: number, end: number}> {
    const violations: Array<{keyword: string, start: number, end: number}> = [];
    
    // Convert text to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();
    
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      let startIndex = 0;
      
      while (true) {
        const index = lowerText.indexOf(lowerKeyword, startIndex);
        if (index === -1) break;
        
        // Check if it's a whole word match (avoid partial matches)
        if (this.isWholeWordMatch(lowerText, index, lowerKeyword.length)) {
          violations.push({
            keyword: keyword,
            start: index,
            end: index + keyword.length
          });
        }
        
        startIndex = index + 1;
      }
    }
    
    return violations;
  }

  /**
   * Check if keyword match is a whole word
   */
  private isWholeWordMatch(text: string, start: number, length: number): boolean {
    const end = start + length;
    
    // Check character before
    if (start > 0) {
      const charBefore = text[start - 1];
      if (/[가-힣a-zA-Z0-9]/.test(charBefore)) {
        return false; // Part of another word
      }
    }
    
    // Check character after
    if (end < text.length) {
      const charAfter = text[end];
      if (/[가-힣a-zA-Z0-9]/.test(charAfter)) {
        return false; // Part of another word
      }
    }
    
    return true;
  }

  /**
   * Create keyword violation error
   */
  private createKeywordError(
    violation: {keyword: string, start: number, end: number},
    originalText: string,
    context: ValidationContext,
    categoryName: string
  ): ValidationError {
    
    const contextBefore = originalText.substring(Math.max(0, violation.start - 15), violation.start);
    const contextAfter = originalText.substring(violation.end, Math.min(originalText.length, violation.end + 15));

    const categoryDescription = this.getCategoryDescription(categoryName);
    const sectionName = this.getSectionName(context);

    return this.createErrorWithHighlight(
      `금지 키워드 검출: "${violation.keyword}" - ${categoryDescription} (${sectionName})`,
      `prohibited-keyword-${categoryName}`,
      'error',
      originalText,
      this.suggestAlternative(violation.keyword, categoryName),
      0.95, // High confidence for exact keyword matches
      { start: violation.start, end: violation.end },
      contextBefore,
      contextAfter
    );
  }

  /**
   * Get category description in Korean
   */
  private getCategoryDescription(categoryName: string): string {
    const descriptions: Record<string, string> = {
      competitions: '대회/경진대회 관련 용어는 사용할 수 없습니다',
      awards: '구체적인 상장/수상 내역은 기재할 수 없습니다',
      external: '교외/외부기관 활동은 명시할 수 없습니다',
      certifications: '구체적인 자격증명은 기재할 수 없습니다',
      publications: '논문/출간 관련 내용은 기재할 수 없습니다',
      patents: '특허/발명 관련 내용은 기재할 수 없습니다',
      language: '구체적인 어학/해외 활동은 기재할 수 없습니다',
      scholarships: '장학금 관련 내용은 기재할 수 없습니다',
      grades: '구체적인 등급/급수는 기재할 수 없습니다',
      family: '가족 관련 내용은 기재할 수 없습니다',
      institutions: '구체적인 대학/기관명은 기재할 수 없습니다',
      instructors: '구체적인 강사/교수명은 기재할 수 없습니다',
      commercial: '상업적 기관/회사명은 기재할 수 없습니다'
    };

    return descriptions[categoryName] || '해당 키워드는 사용할 수 없습니다';
  }

  /**
   * Suggest alternative phrasing
   */
  private suggestAlternative(keyword: string, categoryName: string): string {
    const alternatives: Record<string, Record<string, string>> = {
      competitions: {
        '대회': '교내 활동',
        '경진대회': '학습 발표회',
        '올림피아드': '학업 심화 활동',
        '공모전': '창작 활동'
      },
      awards: {
        '상장': '우수 평가',
        '수상': '좋은 성과',
        '표창': '인정받음',
        '금상': '우수한 결과'
      },
      external: {
        '교외': '학교 연계',
        '외부기관': '교육기관',
        '사설': '별도'
      },
      family: {
        '아버지': '가정에서',
        '어머니': '가정 환경',
        '부모': '가정 배경'
      },
      institutions: {
        '전남대': '지역 대학',
        '서울대': '국립대',
        '대학교': '고등교육기관'
      }
    };

    if (alternatives[categoryName] && alternatives[categoryName][keyword]) {
      return `"${keyword}" 대신 "${alternatives[categoryName][keyword]}" 등의 표현을 사용하세요`;
    }

    // Generic suggestions based on category
    const genericSuggestions: Record<string, string> = {
      competitions: '교내 학습 활동이나 프로젝트로 표현하세요',
      awards: '성취나 성과로 표현하세요',
      external: '학교 연계 활동으로 표현하세요',
      family: '개인적 배경보다 학습 과정에 집중하세요',
      institutions: '일반적인 기관 유형으로 표현하세요'
    };

    return genericSuggestions[categoryName] || `"${keyword}" 사용을 피하고 다른 표현을 사용하세요`;
  }

  /**
   * Check if validation should be applied
   */
  shouldValidate(context: ValidationContext): boolean {
    // Apply keyword prohibition to content rows
    return context.neisContext?.isContentRow === true;
  }
}
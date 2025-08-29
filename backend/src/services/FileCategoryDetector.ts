import * as XLSX from 'xlsx';
import { ExcelData } from '../types/validation';

export interface FileCategory {
  id: string;
  fileName: string;
  category: '출결상황' | '개인세부능력' | '인적사항' | '수상경력' | '창의적체험활동' | '독서활동' | '행동특성및종합의견' | '기타';
  confidence: number; // 0-1, 분류 신뢰도
  uploadedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileSize: number;
  validationId?: string;
  metadata?: {
    sheetCount: number;
    detectedKeywords: string[];
    suggestedAlternatives?: string[];
    buffer?: Buffer; // Store buffer temporarily for batch validation
  };
}

export interface CategoryDetectionResult {
  category: FileCategory['category'];
  confidence: number;
  detectedKeywords: string[];
  sheetAnalysis: SheetAnalysis[];
  suggestedAlternatives: string[];
}

interface SheetAnalysis {
  sheetName: string;
  keywordMatches: KeywordMatch[];
  structureScore: number;
  contentType: 'data' | 'summary' | 'header' | 'unknown';
}

interface KeywordMatch {
  keyword: string;
  category: string;
  count: number;
  positions: string[];
  weight: number;
}

export class FileCategoryDetector {
  // 카테고리별 키워드 패턴 (가중치 포함)
  private readonly CATEGORY_PATTERNS: Record<string, { keywords: string[], weight: number, synonyms: string[] }> = {
    '출결상황': {
      keywords: ['출결', '결석', '지각', '조퇴', '결과', '무단', '병결', '사고', '출석일수', '수업일수'],
      weight: 1.0,
      synonyms: ['출석부', '출결관리', '출결현황', '출석현황']
    },
    '개인세부능력': {
      keywords: ['세부능력', '특기사항', '교과학습', '발달상황', '성취수준', '학습활동', '수행평가', '과목별'],
      weight: 0.9,
      synonyms: ['개인별특기', '학습상황', '교과발달', '성취도']
    },
    '인적사항': {
      keywords: ['성명', '생년월일', '성별', '주소', '전화번호', '학적번호', '학년', '반', '번호', '보호자'],
      weight: 1.0,
      synonyms: ['개인정보', '학적정보', '기본정보', '학생정보']
    },
    '수상경력': {
      keywords: ['수상', '대회', '상장', '표창', '시상', '우수상', '최우수', '장려상', '입상', '금상', '은상', '동상'],
      weight: 0.8,
      synonyms: ['수상실적', '대회실적', '시상실적', '표창실적']
    },
    '창의적체험활동': {
      keywords: ['창의적', '체험활동', '봉사활동', '동아리', '자율활동', '진로활동', 'CA', '특별활동'],
      weight: 0.9,
      synonyms: ['창체', '체험학습', '특활', '창의활동']
    },
    '독서활동': {
      keywords: ['독서', '도서', '책', '읽기', '서명', '저자', '출판사', '독후감', '책읽기'],
      weight: 0.7,
      synonyms: ['독서현황', '독서실적', '독서기록', '도서목록']
    },
    '행동특성및종합의견': {
      keywords: ['행동특성', '종합의견', '담임', '교사의견', '행동관찰', '성격', '태도', '특징', '관찰내용'],
      weight: 0.8,
      synonyms: ['행특', '담임소견', '종합평가', '행동평가']
    }
  };

  // NEIS 구조 패턴
  private readonly NEIS_STRUCTURE_INDICATORS = [
    '나이스', 'NEIS', '학교생활기록부', '생활기록', '학생부',
    '학급', '학년', '학기', '기준일', '작성일', '출력일'
  ];

  // 제외할 일반적인 시트명
  private readonly EXCLUDED_SHEET_NAMES = [
    'Sheet1', 'Sheet2', 'Sheet3', '시트1', '시트2', '시트3',
    'summary', '요약', '전체', 'total', '합계'
  ];

  /**
   * 파일의 카테고리를 자동으로 감지
   */
  async detectCategory(buffer: Buffer, fileName: string): Promise<CategoryDetectionResult> {
    try {
      console.log(`🔍 Detecting category for file: ${fileName}`);
      
      const workbook = XLSX.read(buffer, { type: 'buffer', cellText: false });
      const excelData = this.convertWorkbookToExcelData(workbook, fileName);
      
      // 여러 분석 방법으로 카테고리 감지
      const analyses = await Promise.all([
        this.analyzeByFileName(fileName),
        this.analyzeBySheetNames(workbook.SheetNames),
        this.analyzeByContent(excelData),
        this.analyzeByStructure(excelData)
      ]);

      // 결과 통합 및 신뢰도 계산
      const combinedResult = this.combineAnalysisResults(analyses);
      
      console.log(`✅ Category detected: ${combinedResult.category} (confidence: ${combinedResult.confidence})`);
      
      return combinedResult;
      
    } catch (error) {
      console.error(`❌ Failed to detect category for ${fileName}:`, error);
      
      return {
        category: '기타',
        confidence: 0.0,
        detectedKeywords: [],
        sheetAnalysis: [],
        suggestedAlternatives: []
      };
    }
  }

  /**
   * 파일명으로 카테고리 분석
   */
  private async analyzeByFileName(fileName: string): Promise<Partial<CategoryDetectionResult>> {
    const lowerFileName = fileName.toLowerCase();
    const detectedKeywords: string[] = [];
    const scores: Record<string, number> = {};

    for (const [category, pattern] of Object.entries(this.CATEGORY_PATTERNS)) {
      let score = 0;
      
      // 키워드 매칭
      for (const keyword of pattern.keywords) {
        if (lowerFileName.includes(keyword.toLowerCase())) {
          score += pattern.weight;
          detectedKeywords.push(keyword);
        }
      }
      
      // 동의어 매칭
      for (const synonym of pattern.synonyms) {
        if (lowerFileName.includes(synonym.toLowerCase())) {
          score += pattern.weight * 0.8; // 동의어는 약간 낮은 가중치
          detectedKeywords.push(synonym);
        }
      }
      
      scores[category] = score;
    }

    const topCategory = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      category: topCategory ? topCategory[0] as FileCategory['category'] : '기타',
      confidence: topCategory ? Math.min(topCategory[1] / 3, 1.0) : 0,
      detectedKeywords: detectedKeywords.slice(0, 10) // 최대 10개
    };
  }

  /**
   * 시트명으로 카테고리 분석
   */
  private async analyzeBySheetNames(sheetNames: string[]): Promise<Partial<CategoryDetectionResult>> {
    const detectedKeywords: string[] = [];
    const scores: Record<string, number> = {};
    const sheetAnalysis: SheetAnalysis[] = [];

    for (const sheetName of sheetNames) {
      // 제외할 시트명 스킵
      if (this.EXCLUDED_SHEET_NAMES.some(excluded => 
        sheetName.toLowerCase().includes(excluded.toLowerCase()))) {
        continue;
      }

      const analysis: SheetAnalysis = {
        sheetName,
        keywordMatches: [],
        structureScore: 0,
        contentType: 'unknown'
      };

      // 각 카테고리별로 시트명 분석
      for (const [category, pattern] of Object.entries(this.CATEGORY_PATTERNS)) {
        for (const keyword of [...pattern.keywords, ...pattern.synonyms]) {
          if (sheetName.toLowerCase().includes(keyword.toLowerCase())) {
            const match: KeywordMatch = {
              keyword,
              category,
              count: 1,
              positions: [`sheet:${sheetName}`],
              weight: pattern.weight
            };
            
            analysis.keywordMatches.push(match);
            detectedKeywords.push(keyword);
            scores[category] = (scores[category] || 0) + pattern.weight * 1.5; // 시트명은 높은 가중치
          }
        }
      }

      sheetAnalysis.push(analysis);
    }

    const topCategory = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      category: topCategory ? topCategory[0] as FileCategory['category'] : '기타',
      confidence: topCategory ? Math.min(topCategory[1] / 5, 1.0) : 0,
      detectedKeywords,
      sheetAnalysis
    };
  }

  /**
   * 셀 내용으로 카테고리 분석
   */
  private async analyzeByContent(excelData: ExcelData): Promise<Partial<CategoryDetectionResult>> {
    const detectedKeywords: string[] = [];
    const scores: Record<string, number> = {};
    const keywordCounts: Record<string, number> = {};

    // 모든 시트의 데이터를 분석
    for (const [sheetName, sheet] of Object.entries(excelData.sheets)) {
      const { data } = sheet;
      
      // 처음 20행만 분석 (성능 최적화)
      const sampleRows = data.slice(0, 20);
      
      for (const row of sampleRows) {
        for (const cell of row) {
          if (typeof cell === 'string' && cell.length > 0) {
            const cellText = cell.toLowerCase();
            
            // 카테고리별 키워드 검색
            for (const [category, pattern] of Object.entries(this.CATEGORY_PATTERNS)) {
              for (const keyword of [...pattern.keywords, ...pattern.synonyms]) {
                const keywordLower = keyword.toLowerCase();
                
                if (cellText.includes(keywordLower)) {
                  const count = (cellText.match(new RegExp(keywordLower, 'g')) || []).length;
                  keywordCounts[keyword] = (keywordCounts[keyword] || 0) + count;
                  
                  scores[category] = (scores[category] || 0) + (pattern.weight * count);
                  
                  if (!detectedKeywords.includes(keyword)) {
                    detectedKeywords.push(keyword);
                  }
                }
              }
            }
          }
        }
      }
    }

    const topCategory = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      category: topCategory ? topCategory[0] as FileCategory['category'] : '기타',
      confidence: topCategory ? Math.min(topCategory[1] / 10, 1.0) : 0,
      detectedKeywords: detectedKeywords.slice(0, 15) // 상위 15개 키워드
    };
  }

  /**
   * 파일 구조로 카테고리 분석 (NEIS 특성 기반)
   */
  private async analyzeByStructure(excelData: ExcelData): Promise<Partial<CategoryDetectionResult>> {
    let neisScore = 0;
    let structuralHints: string[] = [];

    // NEIS 구조 지표 검사
    const allText = this.extractAllText(excelData).toLowerCase();
    
    for (const indicator of this.NEIS_STRUCTURE_INDICATORS) {
      if (allText.includes(indicator.toLowerCase())) {
        neisScore += 1;
        structuralHints.push(indicator);
      }
    }

    // 학생 정보가 특정 위치에 있는지 확인 (NEIS 특성)
    const hasStudentInfoPattern = this.detectStudentInfoPattern(excelData);
    if (hasStudentInfoPattern) {
      neisScore += 2;
      structuralHints.push('학생정보패턴');
    }

    // 날짜 패턴 검사
    const datePatterns = this.detectDatePatterns(excelData);
    if (datePatterns.length > 0) {
      neisScore += 1;
      structuralHints.push(...datePatterns);
    }

    return {
      category: neisScore > 3 ? '인적사항' : '기타', // 높은 NEIS 점수면 기본적으로 인적사항으로 분류
      confidence: Math.min(neisScore / 6, 0.8),
      detectedKeywords: structuralHints
    };
  }

  /**
   * 여러 분석 결과를 통합하여 최종 결과 생성
   */
  private combineAnalysisResults(analyses: Partial<CategoryDetectionResult>[]): CategoryDetectionResult {
    const categoryScores: Record<string, number> = {};
    const allKeywords = new Set<string>();
    const allSheetAnalysis: SheetAnalysis[] = [];

    // 각 분석 결과의 가중치
    const weights = [0.3, 0.4, 0.25, 0.05]; // 파일명, 시트명, 내용, 구조

    analyses.forEach((analysis, index) => {
      if (analysis.category && analysis.category !== '기타') {
        const weight = weights[index];
        const score = (analysis.confidence || 0) * weight;
        categoryScores[analysis.category] = (categoryScores[analysis.category] || 0) + score;
      }

      // 키워드 수집
      if (analysis.detectedKeywords) {
        analysis.detectedKeywords.forEach(keyword => allKeywords.add(keyword));
      }

      // 시트 분석 수집
      if (analysis.sheetAnalysis) {
        allSheetAnalysis.push(...analysis.sheetAnalysis);
      }
    });

    // 최고 점수 카테고리 선택
    const sortedCategories = Object.entries(categoryScores)
      .sort(([, a], [, b]) => b - a);

    const topCategory = sortedCategories[0];
    const finalCategory = topCategory ? topCategory[0] as FileCategory['category'] : '기타';
    const finalConfidence = topCategory ? Math.min(topCategory[1], 1.0) : 0;

    // 대안 카테고리 제안 (상위 3개)
    const suggestedAlternatives = sortedCategories
      .slice(1, 4)
      .map(([category]) => category);

    return {
      category: finalCategory,
      confidence: finalConfidence,
      detectedKeywords: Array.from(allKeywords).slice(0, 20),
      sheetAnalysis: allSheetAnalysis,
      suggestedAlternatives
    };
  }

  /**
   * 워크북을 ExcelData 형식으로 변환
   */
  private convertWorkbookToExcelData(workbook: XLSX.WorkBook, fileName: string): ExcelData {
    const sheets: ExcelData['sheets'] = {};

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        raw: false,
        defval: ''
      });

      sheets[sheetName] = {
        data: jsonData as any[][],
        range: worksheet['!ref'] || 'A1:A1'
      };
    }

    return {
      sheets,
      fileName,
      fileSize: 0, // Will be set by caller
      format: 'generic' // Will be determined later
    };
  }

  /**
   * 모든 텍스트 추출
   */
  private extractAllText(excelData: ExcelData): string {
    const allText: string[] = [];

    for (const sheet of Object.values(excelData.sheets)) {
      for (const row of sheet.data) {
        for (const cell of row) {
          if (typeof cell === 'string' && cell.trim()) {
            allText.push(cell.trim());
          }
        }
      }
    }

    return allText.join(' ');
  }

  /**
   * NEIS 학생정보 패턴 검출
   */
  private detectStudentInfoPattern(excelData: ExcelData): boolean {
    // 첫 번째 시트의 초기 몇 행에서 학생 정보 패턴 찾기
    const firstSheet = Object.values(excelData.sheets)[0];
    if (!firstSheet || firstSheet.data.length < 5) return false;

    const topRows = firstSheet.data.slice(0, 5);
    const textContent = topRows.flat().join(' ').toLowerCase();

    const studentInfoIndicators = ['성명', '학번', '학급', '학년', '생년월일'];
    const matchCount = studentInfoIndicators.filter(indicator => 
      textContent.includes(indicator)
    ).length;

    return matchCount >= 2;
  }

  /**
   * 날짜 패턴 검출
   */
  private detectDatePatterns(excelData: ExcelData): string[] {
    const datePatterns = [
      /\d{4}[-.]?\d{1,2}[-.]?\d{1,2}/g,  // YYYY-MM-DD, YYYY.MM.DD
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g, // YYYY년 MM월 DD일
      /\d{1,2}\/\d{1,2}\/\d{4}/g         // MM/DD/YYYY
    ];

    const detectedPatterns: string[] = [];
    const sampleText = this.extractAllText(excelData).slice(0, 1000); // 샘플만 체크

    datePatterns.forEach((pattern, index) => {
      const matches = sampleText.match(pattern);
      if (matches && matches.length > 2) {
        detectedPatterns.push(`날짜패턴${index + 1}`);
      }
    });

    return detectedPatterns;
  }

  /**
   * 카테고리별 색상 테마 반환
   */
  static getCategoryTheme(category: FileCategory['category']): { color: string; icon: string; bgColor: string } {
    const themes = {
      '출결상황': { color: '#f44336', icon: '📅', bgColor: '#ffebee' },
      '개인세부능력': { color: '#2196f3', icon: '📚', bgColor: '#e3f2fd' },
      '인적사항': { color: '#4caf50', icon: '👤', bgColor: '#e8f5e8' },
      '수상경력': { color: '#ff9800', icon: '🏆', bgColor: '#fff3e0' },
      '창의적체험활동': { color: '#9c27b0', icon: '🎨', bgColor: '#f3e5f5' },
      '독서활동': { color: '#795548', icon: '📖', bgColor: '#efebe9' },
      '행동특성및종합의견': { color: '#607d8b', icon: '📝', bgColor: '#eceff1' },
      '기타': { color: '#757575', icon: '📄', bgColor: '#f5f5f5' }
    };

    return themes[category] || themes['기타'];
  }
}
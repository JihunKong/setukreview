import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

export interface SimilarityResult {
  jaccardScore: number;
  lcsScore: number;
  editDistanceScore: number;
  weightedScore: number;
  longestCommonSubstring: string;
  matchedWords: string[];
}

export interface DuplicateMatch {
  text: string;
  location: string;
  similarity: SimilarityResult;
  studentName?: string;
  section?: string;
}

export class DuplicateDetectionValidator extends BaseValidator {
  private textCorpus: Map<string, DuplicateMatch[]> = new Map();
  private readonly SIMILARITY_THRESHOLDS = {
    EXACT_DUPLICATE: 0.90,     // 90% 이상: 완전 중복 (error)
    HIGH_SIMILARITY: 0.80,     // 80-89%: 높은 유사도 (warning)
    PARTIAL_DUPLICATE: 0.70    // 70-79%: 부분 중복 (info)
  };

  // 교육 분야 표준 표현 화이트리스트 (중복 검사 제외)
  private readonly EDUCATION_STANDARD_EXPRESSIONS = [
    '성실한 자세', '적극적인 참여', '바른 인성', '창의적 사고',
    '협력적 태도', '책임감 있는', '꾸준한 노력', '긍정적인 마음',
    '리더십을 발휘', '배려하는 마음', '성장하는 모습', '발전하는 자세',
    '노력하는 모습', '관심을 보임', '참여도가 높음', '이해도가 높음',
    '잘 수행함', '성과를 보임', '향상됨', '발전함'
  ];

  private readonly WEIGHTS = {
    JACCARD: 0.4,              // 40% - 단어 집합 기반 유사도
    LCS: 0.4,                  // 40% - 연속 문구 유사도
    EDIT_DISTANCE: 0.2         // 20% - 편집 거리 기반 유사도
  };

  constructor() {
    super('duplicate_detection', 'Duplicate Detection Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Skip validation for empty cells, numbers only, or very short text
    if (!text || this.isOnlyNumbers(text) || this.isDateTime(text) || text.length < 30) {
      return errors;
    }

    // Korean text only
    if (!this.isKoreanText(text)) {
      return errors;
    }

    // Skip validation for standard educational expressions
    if (this.isStandardEducationExpression(text)) {
      return errors;
    }

    // Store current text in corpus
    const currentMatch: DuplicateMatch = {
      text,
      location: `${context.sheet}!${context.cell}`,
      similarity: this.createEmptySimilarityResult(),
      studentName: context.studentName,
      section: context.section
    };

    // Find duplicates against existing corpus
    const duplicates = this.findDuplicates(text, context);

    // Add current text to corpus for future comparisons
    const corpusKey = this.generateCorpusKey(context);
    if (!this.textCorpus.has(corpusKey)) {
      this.textCorpus.set(corpusKey, []);
    }
    this.textCorpus.get(corpusKey)!.push(currentMatch);

    // Generate errors for found duplicates
    for (const duplicate of duplicates) {
      const severity = this.determineSeverity(duplicate.similarity.weightedScore);
      const error = this.createError(
        this.generateDuplicateMessage(duplicate),
        'text-duplicate',
        severity,
        text,
        this.generateDuplicateSuggestion(duplicate),
        duplicate.similarity.weightedScore
      );

      // Add duplicate-specific information
      (error as any).duplicateWith = {
        location: duplicate.location,
        studentName: duplicate.studentName,
        section: duplicate.section,
        similarity: duplicate.similarity.weightedScore,
        matchedText: duplicate.similarity.longestCommonSubstring,
        matchedWords: duplicate.similarity.matchedWords
      };

      errors.push(error);
    }

    return errors;
  }

  /**
   * Jaccard 유사도 계산: 두 텍스트의 단어 집합 기반 비교
   * J(A,B) = |A ∩ B| / |A ∪ B|
   */
  private calculateJaccardSimilarity(text1: string, text2: string): { score: number, matchedWords: string[] } {
    const words1 = this.tokenizeKoreanText(text1);
    const words2 = this.tokenizeKoreanText(text2);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    // 교집합 계산
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const matchedWords = Array.from(intersection);

    // 합집합 계산
    const union = new Set([...set1, ...set2]);

    const score = union.size === 0 ? 0 : intersection.size / union.size;
    return { score, matchedWords };
  }

  /**
   * 최장 공통 부분 문자열 (LCS) 계산: 연속된 동일 문구 검출
   */
  private findLongestCommonSubstring(text1: string, text2: string): { substring: string, score: number } {
    const normalizedText1 = this.normalizeForComparison(text1);
    const normalizedText2 = this.normalizeForComparison(text2);

    let longest = '';
    let maxLength = 0;

    // Dynamic programming approach for LCS
    for (let i = 0; i < normalizedText1.length; i++) {
      for (let j = 0; j < normalizedText2.length; j++) {
        let length = 0;
        while (
          i + length < normalizedText1.length &&
          j + length < normalizedText2.length &&
          normalizedText1[i + length] === normalizedText2[j + length]
        ) {
          length++;
        }

        if (length > maxLength) {
          maxLength = length;
          longest = normalizedText1.substring(i, i + length);
        }
      }
    }

    // Normalize score by shorter text length
    const shorterLength = Math.min(normalizedText1.length, normalizedText2.length);
    const score = shorterLength === 0 ? 0 : maxLength / shorterLength;

    return { substring: longest.trim(), score };
  }

  /**
   * 편집 거리 기반 유사도 계산 (Levenshtein Distance)
   */
  private calculateEditDistanceSimilarity(text1: string, text2: string): number {
    const normalized1 = this.normalizeForComparison(text1);
    const normalized2 = this.normalizeForComparison(text2);

    const editDistance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    return maxLength === 0 ? 1 : 1 - (editDistance / maxLength);
  }

  /**
   * 가중 평균을 이용한 종합적 유사도 계산
   */
  private calculateWeightedSimilarity(text1: string, text2: string): SimilarityResult {
    const jaccard = this.calculateJaccardSimilarity(text1, text2);
    const lcs = this.findLongestCommonSubstring(text1, text2);
    const editDistance = this.calculateEditDistanceSimilarity(text1, text2);

    const weightedScore = 
      (jaccard.score * this.WEIGHTS.JACCARD) +
      (lcs.score * this.WEIGHTS.LCS) +
      (editDistance * this.WEIGHTS.EDIT_DISTANCE);

    return {
      jaccardScore: jaccard.score,
      lcsScore: lcs.score,
      editDistanceScore: editDistance,
      weightedScore: Math.min(1.0, Math.max(0.0, weightedScore)),
      longestCommonSubstring: lcs.substring,
      matchedWords: jaccard.matchedWords
    };
  }

  /**
   * Korean text tokenization for similarity comparison
   */
  private tokenizeKoreanText(text: string): string[] {
    // Remove punctuation and normalize
    const normalized = text.replace(/[^\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\s]/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim();

    // Split by whitespace and filter out short tokens
    return normalized.split(' ')
                    .filter(word => word.length >= 2)
                    .map(word => word.toLowerCase());
  }

  /**
   * Normalize text for character-level comparison
   */
  private normalizeForComparison(text: string): string {
    return text.replace(/\s+/g, '')              // Remove all whitespace
              .replace(/[^\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/g, '') // Keep only Korean chars
              .toLowerCase();
  }

  /**
   * Levenshtein distance calculation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    // Initialize first row and column
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    // Fill the matrix
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Find duplicate texts in the corpus
   */
  private findDuplicates(text: string, context: ValidationContext): DuplicateMatch[] {
    const duplicates: DuplicateMatch[] = [];

    // Check against all stored texts
    for (const [corpusKey, matches] of this.textCorpus.entries()) {
      for (const match of matches) {
        // Skip self-comparison
        if (match.location === `${context.sheet}!${context.cell}`) {
          continue;
        }

        const similarity = this.calculateWeightedSimilarity(text, match.text);

        // Only report if similarity exceeds minimum threshold
        if (similarity.weightedScore >= this.SIMILARITY_THRESHOLDS.PARTIAL_DUPLICATE) {
          duplicates.push({
            ...match,
            similarity
          });
        }
      }
    }

    // Sort by similarity score (highest first)
    return duplicates.sort((a, b) => b.similarity.weightedScore - a.similarity.weightedScore);
  }

  /**
   * Generate corpus key for grouping similar texts
   */
  private generateCorpusKey(context: ValidationContext): string {
    return context.section || context.sheet || 'general';
  }

  /**
   * Determine error severity based on similarity score
   */
  private determineSeverity(score: number): ValidationError['severity'] {
    if (score >= this.SIMILARITY_THRESHOLDS.EXACT_DUPLICATE) {
      return 'error';
    } else if (score >= this.SIMILARITY_THRESHOLDS.HIGH_SIMILARITY) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Generate duplicate error message
   */
  private generateDuplicateMessage(duplicate: DuplicateMatch): string {
    const percentage = Math.round(duplicate.similarity.weightedScore * 100);
    const location = duplicate.studentName ? 
      `${duplicate.studentName}의 ${duplicate.section || '기록'}` : 
      duplicate.location;

    if (percentage >= 90) {
      return `거의 동일한 내용이 ${location}에서 발견됨 (유사도: ${percentage}%)`;
    } else if (percentage >= 70) {
      return `매우 유사한 내용이 ${location}에서 발견됨 (유사도: ${percentage}%)`;
    } else {
      return `유사한 내용이 ${location}에서 발견됨 (유사도: ${percentage}%)`;
    }
  }

  /**
   * Generate suggestion for duplicate content
   */
  private generateDuplicateSuggestion(duplicate: DuplicateMatch): string {
    const percentage = Math.round(duplicate.similarity.weightedScore * 100);

    if (percentage >= 90) {
      return '내용을 다시 작성하거나 차별화된 표현을 사용하세요';
    } else if (percentage >= 70) {
      return '중복되는 부분을 수정하여 고유한 내용으로 작성하세요';
    } else {
      return '일부 표현이 중복됩니다. 다양한 어휘를 활용해보세요';
    }
  }

  /**
   * Create empty similarity result for initialization
   */
  private createEmptySimilarityResult(): SimilarityResult {
    return {
      jaccardScore: 0,
      lcsScore: 0,
      editDistanceScore: 0,
      weightedScore: 0,
      longestCommonSubstring: '',
      matchedWords: []
    };
  }

  /**
   * Clear corpus to free memory (call periodically)
   */
  public clearCorpus(): void {
    this.textCorpus.clear();
  }

  /**
   * Get corpus statistics for monitoring
   */
  public getCorpusStats(): { totalEntries: number, sections: string[], avgTextsPerSection: number } {
    const totalEntries = Array.from(this.textCorpus.values()).reduce((sum, matches) => sum + matches.length, 0);
    const sections = Array.from(this.textCorpus.keys());
    const avgTextsPerSection = sections.length > 0 ? totalEntries / sections.length : 0;

    return {
      totalEntries,
      sections,
      avgTextsPerSection: Math.round(avgTextsPerSection * 100) / 100
    };
  }

  /**
   * Check if text contains standard educational expressions that should not be flagged as duplicates
   */
  private isStandardEducationExpression(text: string): boolean {
    const normalizedText = text.toLowerCase().trim();
    
    return this.EDUCATION_STANDARD_EXPRESSIONS.some(expression => 
      normalizedText.includes(expression.toLowerCase()) && 
      normalizedText.length < expression.length + 20 // Allow some context but avoid very long texts
    );
  }
}
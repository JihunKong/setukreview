import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';
import { DuplicateDetectionValidator, SimilarityResult } from './DuplicateDetectionValidator';

export interface GlobalTextEntry {
  id: string;
  studentName: string;
  section: string;
  location: string;
  text: string;
  hash: string;
  wordCount: number;
  createdAt: Date;
  metadata?: {
    isTemplate?: boolean;
    frequency?: number;
    commonPhrases?: string[];
  };
}

export interface CrossStudentMatch {
  similarity: SimilarityResult;
  sourceEntry: GlobalTextEntry;
  matchType: 'exact' | 'high_similarity' | 'partial' | 'template';
  affectedStudents: string[];
}

export class CrossStudentDuplicateDetector extends BaseValidator {
  private globalTextCorpus: Map<string, GlobalTextEntry[]> = new Map(); // section -> entries
  private duplicateDetector: DuplicateDetectionValidator;
  private processedTexts: Set<string> = new Set(); // Track processed text hashes to avoid re-processing

  private readonly CROSS_STUDENT_THRESHOLDS = {
    EXACT_MATCH: 0.95,          // 95%+ similarity - likely copy-paste
    HIGH_SIMILARITY: 0.80,      // 80-94% - significant overlap
    TEMPLATE_USAGE: 0.70,       // 70-79% - possible template usage
    MINIMUM_LENGTH: 30,         // Minimum text length for cross-student checking
    MAX_CORPUS_SIZE: 10000      // Memory management
  };

  private readonly SECTION_RULES = {
    // High-risk sections for plagiarism
    HIGH_RISK: [
      '행동특성및종합의견', '종합의견', '특기사항',
      '창의적체험활동상황', '봉사활동', '동아리활동'
    ],
    // Medium-risk sections  
    MEDIUM_RISK: [
      '독서활동상황', '자율활동', '진로활동'
    ],
    // Low-risk sections (more standardized)
    LOW_RISK: [
      '수상경력', '자격증및인증취득상황', '교과학습발달상황'
    ],
    // Excluded from cross-student checking
    EXCLUDED: [
      '학적사항', '출결상황', '신체발달상황'
    ]
  };

  constructor() {
    super('cross_student_duplicate', 'Cross Student Duplicate Detector');
    this.duplicateDetector = new DuplicateDetectionValidator();
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Skip if text is too short or not suitable for cross-student checking
    if (!this.shouldCheckCrossStudent(text, context)) {
      return errors;
    }

    const textHash = this.generateTextHash(text);
    
    // Skip if already processed this exact text
    if (this.processedTexts.has(textHash)) {
      return errors;
    }

    const sectionKey = this.getSectionKey(context);
    const studentName = context.studentName || context.neisContext?.studentInfo.name || '미상';

    // Create entry for current text
    const currentEntry: GlobalTextEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      studentName,
      section: sectionKey,
      location: `${context.sheet}!${context.cell}`,
      text,
      hash: textHash,
      wordCount: this.countWords(text),
      createdAt: new Date()
    };

    // Find cross-student matches
    const crossMatches = await this.findCrossStudentMatches(currentEntry, context);

    // Generate errors for significant matches
    for (const match of crossMatches) {
      const severity = this.determineCrossStudentSeverity(match, sectionKey);
      const error = this.createCrossStudentError(match, currentEntry, context, severity);
      errors.push(error);
    }

    // Add current entry to corpus
    this.addToCorpus(currentEntry);
    this.processedTexts.add(textHash);

    // Periodic cleanup to manage memory
    if (this.processedTexts.size > this.CROSS_STUDENT_THRESHOLDS.MAX_CORPUS_SIZE) {
      this.performCorpusCleanup();
    }

    return errors;
  }

  /**
   * Check if text should be checked for cross-student duplicates
   */
  private shouldCheckCrossStudent(text: string, context: ValidationContext): boolean {
    // Skip short text
    if (!text || text.length < this.CROSS_STUDENT_THRESHOLDS.MINIMUM_LENGTH) {
      return false;
    }

    // Skip non-Korean text
    if (!this.isKoreanText(text)) {
      return false;
    }

    // Skip excluded sections
    const sectionKey = this.getSectionKey(context);
    if (this.SECTION_RULES.EXCLUDED.some(excluded => sectionKey.includes(excluded))) {
      return false;
    }

    // Skip if it looks like structured data (numbers, dates, etc.)
    if (this.isOnlyNumbers(text) || this.isDateTime(text)) {
      return false;
    }

    // Skip if it's mostly punctuation or formatting
    const meaningfulChars = text.replace(/[^\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/g, '').length;
    if (meaningfulChars < text.length * 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Find cross-student matches for the current text
   */
  private async findCrossStudentMatches(
    currentEntry: GlobalTextEntry,
    context: ValidationContext
  ): Promise<CrossStudentMatch[]> {
    const matches: CrossStudentMatch[] = [];
    const sectionKey = this.getSectionKey(context);

    // Get relevant corpus entries
    const corpusEntries = this.getRelevantCorpusEntries(sectionKey, currentEntry.studentName);

    for (const entry of corpusEntries) {
      // Skip same student
      if (entry.studentName === currentEntry.studentName) {
        continue;
      }

      // Calculate similarity
      const similarity = await this.calculateDetailedSimilarity(currentEntry.text, entry.text);

      // Only create match if above minimum threshold
      if (similarity.weightedScore >= this.CROSS_STUDENT_THRESHOLDS.TEMPLATE_USAGE) {
        const matchType = this.determineMatchType(similarity);
        const affectedStudents = this.findAffectedStudents(entry, similarity);

        matches.push({
          similarity,
          sourceEntry: entry,
          matchType,
          affectedStudents: [currentEntry.studentName, entry.studentName, ...affectedStudents]
        });
      }
    }

    // Sort by similarity score (highest first)
    return matches.sort((a, b) => b.similarity.weightedScore - a.similarity.weightedScore);
  }

  /**
   * Calculate detailed similarity using the duplicate detector
   */
  private async calculateDetailedSimilarity(text1: string, text2: string): Promise<SimilarityResult> {
    // Use the DuplicateDetectionValidator's similarity calculation
    return (this.duplicateDetector as any).calculateWeightedSimilarity(text1, text2);
  }

  /**
   * Get relevant corpus entries for comparison
   */
  private getRelevantCorpusEntries(sectionKey: string, currentStudentName: string): GlobalTextEntry[] {
    let entries: GlobalTextEntry[] = [];

    // Primary: Same section
    if (this.globalTextCorpus.has(sectionKey)) {
      entries = [...this.globalTextCorpus.get(sectionKey)!];
    }

    // Secondary: Related sections (for comprehensive checking)
    for (const [corpusSectionKey, corpusEntries] of this.globalTextCorpus.entries()) {
      if (corpusSectionKey !== sectionKey && this.areSectionsRelated(sectionKey, corpusSectionKey)) {
        entries.push(...corpusEntries);
      }
    }

    // Filter out same student and sort by recency
    return entries
      .filter(entry => entry.studentName !== currentStudentName)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 1000); // Limit for performance
  }

  /**
   * Check if two sections are related for cross-section duplicate detection
   */
  private areSectionsRelated(section1: string, section2: string): boolean {
    const relatedGroups = [
      ['창의적체험활동상황', '봉사활동', '동아리활동', '자율활동', '진로활동'],
      ['행동특성및종합의견', '종합의견', '특기사항'],
      ['독서활동상황', '교과학습발달상황']
    ];

    for (const group of relatedGroups) {
      if (group.some(s => section1.includes(s)) && group.some(s => section2.includes(s))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine match type based on similarity score
   */
  private determineMatchType(similarity: SimilarityResult): CrossStudentMatch['matchType'] {
    if (similarity.weightedScore >= this.CROSS_STUDENT_THRESHOLDS.EXACT_MATCH) {
      return 'exact';
    } else if (similarity.weightedScore >= this.CROSS_STUDENT_THRESHOLDS.HIGH_SIMILARITY) {
      return 'high_similarity';
    } else if (similarity.weightedScore >= this.CROSS_STUDENT_THRESHOLDS.TEMPLATE_USAGE) {
      return 'template';
    } else {
      return 'partial';
    }
  }

  /**
   * Find other students affected by similar text patterns
   */
  private findAffectedStudents(sourceEntry: GlobalTextEntry, similarity: SimilarityResult): string[] {
    const affected: string[] = [];
    const sectionEntries = this.globalTextCorpus.get(sourceEntry.section) || [];

    // Look for additional students with similar text patterns
    for (const entry of sectionEntries) {
      if (entry.studentName !== sourceEntry.studentName) {
        // Use a simpler check for performance
        const hasSharedWords = similarity.matchedWords.some(word => 
          entry.text.includes(word) && word.length > 3
        );
        if (hasSharedWords && !affected.includes(entry.studentName)) {
          affected.push(entry.studentName);
        }
      }
    }

    return affected.slice(0, 5); // Limit to 5 additional students
  }

  /**
   * Determine error severity for cross-student duplicates
   */
  private determineCrossStudentSeverity(match: CrossStudentMatch, sectionKey: string): ValidationError['severity'] {
    // Higher severity for high-risk sections
    const isHighRisk = this.SECTION_RULES.HIGH_RISK.some(section => sectionKey.includes(section));
    const isMediumRisk = this.SECTION_RULES.MEDIUM_RISK.some(section => sectionKey.includes(section));

    switch (match.matchType) {
      case 'exact':
        return 'error';
      case 'high_similarity':
        return isHighRisk ? 'error' : 'warning';
      case 'template':
        return (isHighRisk || isMediumRisk) ? 'warning' : 'info';
      default:
        return 'info';
    }
  }

  /**
   * Create cross-student duplicate error
   */
  private createCrossStudentError(
    match: CrossStudentMatch,
    currentEntry: GlobalTextEntry,
    context: ValidationContext,
    severity: ValidationError['severity']
  ): ValidationError {
    const percentage = Math.round(match.similarity.weightedScore * 100);
    const matchTypeText = this.getMatchTypeText(match.matchType);
    const studentList = match.affectedStudents.slice(0, 3).join(', ');
    const additionalCount = Math.max(0, match.affectedStudents.length - 3);

    let message = `${matchTypeText}: ${match.sourceEntry.studentName}의 ${match.sourceEntry.section}과 ${percentage}% 유사`;
    if (additionalCount > 0) {
      message += ` (추가 ${additionalCount}명의 학생과도 유사)`;
    }

    const error = this.createError(
      message,
      `cross-student-${match.matchType}`,
      severity,
      currentEntry.text,
      this.getCrossStudentSuggestion(match.matchType, percentage),
      match.similarity.weightedScore
    );

    // Add cross-student specific information
    (error as any).duplicateWith = {
      location: match.sourceEntry.location,
      studentName: match.sourceEntry.studentName,
      section: match.sourceEntry.section,
      similarity: match.similarity.weightedScore,
      matchedText: match.similarity.longestCommonSubstring,
      matchedWords: match.similarity.matchedWords
    };

    (error as any).crossStudentInfo = {
      matchType: match.matchType,
      affectedStudents: match.affectedStudents,
      totalMatches: match.affectedStudents.length
    };

    return error;
  }

  /**
   * Get human-readable match type text
   */
  private getMatchTypeText(matchType: CrossStudentMatch['matchType']): string {
    switch (matchType) {
      case 'exact': return '거의 동일한 내용';
      case 'high_similarity': return '높은 유사도';
      case 'template': return '템플릿 사용';
      default: return '유사한 내용';
    }
  }

  /**
   * Get suggestion for cross-student duplicates
   */
  private getCrossStudentSuggestion(matchType: CrossStudentMatch['matchType'], percentage: number): string {
    switch (matchType) {
      case 'exact':
        return '내용을 완전히 다시 작성하여 학생 개별 특성을 반영하세요';
      case 'high_similarity':
        return '유사한 부분을 수정하여 학생만의 고유한 내용으로 작성하세요';
      case 'template':
        return '공통 템플릿 사용이 의심됩니다. 학생별 개별 특성을 더 구체적으로 기술하세요';
      default:
        return `일부 표현이 다른 학생과 유사합니다 (${percentage}%). 더 구체적이고 개별적인 표현을 사용하세요`;
    }
  }

  /**
   * Add entry to global corpus
   */
  private addToCorpus(entry: GlobalTextEntry): void {
    if (!this.globalTextCorpus.has(entry.section)) {
      this.globalTextCorpus.set(entry.section, []);
    }
    this.globalTextCorpus.get(entry.section)!.push(entry);
  }

  /**
   * Get section key for corpus organization
   */
  private getSectionKey(context: ValidationContext): string {
    return context.section || 
           context.neisContext?.sectionName || 
           context.sheet || 
           'general';
  }

  /**
   * Generate hash for text deduplication
   */
  private generateTextHash(text: string): string {
    // Simple hash for duplicate detection
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Perform corpus cleanup to manage memory
   */
  private performCorpusCleanup(): void {
    const maxEntriesPerSection = 500;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [sectionKey, entries] of this.globalTextCorpus.entries()) {
      // Remove old entries
      const recentEntries = entries.filter(entry => 
        now - entry.createdAt.getTime() < maxAge
      );

      // Limit entries per section
      const limitedEntries = recentEntries
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, maxEntriesPerSection);

      this.globalTextCorpus.set(sectionKey, limitedEntries);
    }

    // Clear processed texts cache
    this.processedTexts.clear();
    
    console.log(`🧹 Corpus cleanup completed. Sections: ${this.globalTextCorpus.size}`);
  }

  /**
   * Get comprehensive statistics
   */
  public getCorpusStatistics(): {
    totalEntries: number;
    sectionsCount: number;
    studentsCount: number;
    avgEntriesPerSection: number;
    avgEntriesPerStudent: number;
    sectionDistribution: Record<string, number>;
    riskLevelDistribution: Record<string, number>;
  } {
    let totalEntries = 0;
    const studentSet = new Set<string>();
    const sectionDistribution: Record<string, number> = {};
    const riskLevelDistribution = { high: 0, medium: 0, low: 0, excluded: 0 };

    for (const [sectionKey, entries] of this.globalTextCorpus.entries()) {
      totalEntries += entries.length;
      sectionDistribution[sectionKey] = entries.length;
      
      entries.forEach(entry => studentSet.add(entry.studentName));

      // Classify risk level
      if (this.SECTION_RULES.HIGH_RISK.some(s => sectionKey.includes(s))) {
        riskLevelDistribution.high += entries.length;
      } else if (this.SECTION_RULES.MEDIUM_RISK.some(s => sectionKey.includes(s))) {
        riskLevelDistribution.medium += entries.length;
      } else if (this.SECTION_RULES.LOW_RISK.some(s => sectionKey.includes(s))) {
        riskLevelDistribution.low += entries.length;
      } else {
        riskLevelDistribution.excluded += entries.length;
      }
    }

    const sectionsCount = this.globalTextCorpus.size;
    const studentsCount = studentSet.size;

    return {
      totalEntries,
      sectionsCount,
      studentsCount,
      avgEntriesPerSection: sectionsCount > 0 ? totalEntries / sectionsCount : 0,
      avgEntriesPerStudent: studentsCount > 0 ? totalEntries / studentsCount : 0,
      sectionDistribution,
      riskLevelDistribution
    };
  }

  /**
   * Clear all corpus data
   */
  public clearCorpus(): void {
    this.globalTextCorpus.clear();
    this.processedTexts.clear();
  }
}
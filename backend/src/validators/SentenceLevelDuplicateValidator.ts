import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

/**
 * SentenceLevelDuplicateValidator - Implements VBA sentence-level duplicate detection
 * Based on VBA Module5.bas logic (창체복붙, 세특복붙, 행특복붙, 개별복붙)
 * 
 * Key VBA Logic:
 * - Replace double line breaks with single line breaks
 * - Replace ". " with ".\" and ".\n" with ".\" 
 * - Remove all line breaks
 * - Split text by "\" (backslash) into sentences
 * - Check for duplicates using conditional formatting
 * - Apply to specific ranges for different sections
 */
export class SentenceLevelDuplicateValidator extends BaseValidator {
  
  // Session-level sentence registry for cross-validation
  private static sentenceRegistry = new Map<string, SentenceEntry[]>();
  private static sessionSentences = new Map<string, Set<string>>();

  // Minimum sentence length for duplicate checking (VBA-derived)
  private readonly minimumSentenceLength = 10;
  
  // Similarity threshold for fuzzy sentence matching
  private readonly sentenceSimilarityThreshold = 0.9;

  constructor() {
    super('sentence_duplicate', 'Sentence Level Duplicate Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells or very short text
    if (!text || text.trim().length < this.minimumSentenceLength) {
      return errors;
    }

    const normalizedText = text.trim();

    // Apply VBA text processing logic
    const processedText = this.applyVBATextProcessing(normalizedText);
    
    // Split into sentences using VBA logic
    const sentences = this.splitIntoSentences(processedText);
    
    if (sentences.length < 2) {
      return errors; // No point checking duplicates with less than 2 sentences
    }

    // Check for sentence-level duplicates within the same text
    const internalDuplicates = this.findInternalSentenceDuplicates(sentences, normalizedText, context);
    errors.push(...internalDuplicates);

    // Check against other texts in the session/batch
    const externalDuplicates = this.findExternalSentenceDuplicates(sentences, normalizedText, context);
    errors.push(...externalDuplicates);

    // Register sentences for future cross-validation
    this.registerSentences(sentences, normalizedText, context);

    return errors;
  }

  /**
   * Apply VBA text processing logic from Module5.bas
   */
  private applyVBATextProcessing(text: string): string {
    let processed = text;
    
    // Step 1: Replace double line breaks with single (VBA: Chr(10) & Chr(10) -> Chr(10))
    processed = processed.replace(/\n\n/g, '\n');
    
    // Step 2: Replace ". " with ".\" (VBA: ". " -> ".\")
    processed = processed.replace(/\. /g, '.\\');
    
    // Step 3: Replace "." + line break with ".\" (VBA: "." & Chr(10) -> ".\")
    processed = processed.replace(/\.\n/g, '.\\');
    
    // Step 4: Remove all line breaks (VBA: Chr(10) -> "")
    processed = processed.replace(/\n/g, '');
    
    // Step 5: Clean up double backslashes (VBA equivalent)
    processed = processed.replace(/\\\\/g, '\\');
    
    return processed;
  }

  /**
   * Split text into sentences using VBA backslash delimiter
   */
  private splitIntoSentences(processedText: string): string[] {
    // Split by backslash (VBA TextToColumns with "\" as delimiter)
    const sentences = processedText.split('\\')
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length >= this.minimumSentenceLength)
      .filter(sentence => this.isValidSentence(sentence));
    
    return sentences;
  }

  /**
   * Check if a sentence is valid for duplicate checking
   */
  private isValidSentence(sentence: string): boolean {
    // Skip sentences that are mostly punctuation or numbers
    if (sentence.replace(/[^가-힣a-zA-Z]/g, '').length < 5) {
      return false;
    }
    
    // Skip common filler sentences
    const fillerSentences = [
      '참여함', '활동함', '학습함', '수행함', '완성함',
      '노력함', '발표함', '토론함', '협력함'
    ];
    
    if (fillerSentences.some(filler => sentence === filler)) {
      return false;
    }
    
    return true;
  }

  /**
   * Find duplicate sentences within the same text
   */
  private findInternalSentenceDuplicates(
    sentences: string[], 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const seenSentences = new Map<string, number>();
    
    sentences.forEach((sentence, index) => {
      const normalizedSentence = this.normalizeSentence(sentence);
      
      if (seenSentences.has(normalizedSentence)) {
        const firstOccurrence = seenSentences.get(normalizedSentence)!;
        const error = this.createSentenceDuplicateError(
          sentence,
          originalText,
          context,
          'internal',
          `문장 ${index + 1}이 문장 ${firstOccurrence + 1}과 중복됩니다`
        );
        errors.push(error);
      } else {
        seenSentences.set(normalizedSentence, index);
      }
    });
    
    return errors;
  }

  /**
   * Find duplicate sentences across different texts
   */
  private findExternalSentenceDuplicates(
    sentences: string[], 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const sessionId = this.getSessionId(context);
    
    for (const sentence of sentences) {
      const normalizedSentence = this.normalizeSentence(sentence);
      
      // Check against registry
      if (SentenceLevelDuplicateValidator.sentenceRegistry.has(normalizedSentence)) {
        const existingEntries = SentenceLevelDuplicateValidator.sentenceRegistry.get(normalizedSentence)!;
        const externalEntries = existingEntries.filter(entry => 
          entry.sessionId !== sessionId || entry.location !== context.cell
        );
        
        if (externalEntries.length > 0) {
          const error = this.createCrossSentenceDuplicateError(
            sentence,
            originalText,
            context,
            externalEntries
          );
          errors.push(error);
        }
      }
      
      // Check for similar sentences using fuzzy matching
      const similarErrors = this.findSimilarSentences(sentence, originalText, context);
      errors.push(...similarErrors);
    }
    
    return errors;
  }

  /**
   * Find similar sentences using fuzzy matching
   */
  private findSimilarSentences(
    sentence: string, 
    originalText: string, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const normalizedSentence = this.normalizeSentence(sentence);
    const sessionId = this.getSessionId(context);
    
    // Get session sentences for comparison
    const sessionSentences = SentenceLevelDuplicateValidator.sessionSentences.get(sessionId);
    if (!sessionSentences) return errors;
    
    for (const existingSentence of sessionSentences) {
      if (existingSentence !== normalizedSentence) {
        const similarity = this.calculateSentenceSimilarity(normalizedSentence, existingSentence);
        
        if (similarity >= this.sentenceSimilarityThreshold) {
          const error = this.createSentenceDuplicateError(
            sentence,
            originalText,
            context,
            'similar',
            `유사한 문장 발견 (유사도: ${Math.round(similarity * 100)}%): "${this.truncateSentence(existingSentence)}"`
          );
          errors.push(error);
        }
      }
    }
    
    return errors;
  }

  /**
   * Calculate sentence similarity
   */
  private calculateSentenceSimilarity(sentence1: string, sentence2: string): number {
    // Simple Jaccard similarity for Korean sentences
    const words1 = new Set(sentence1.split(/\s+/));
    const words2 = new Set(sentence2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Normalize sentence for comparison
   */
  private normalizeSentence(sentence: string): string {
    return sentence
      .toLowerCase()
      .replace(/[.!?。]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Register sentences for cross-validation
   */
  private registerSentences(sentences: string[], originalText: string, context: ValidationContext): void {
    const sessionId = this.getSessionId(context);
    
    // Initialize session sentences set
    if (!SentenceLevelDuplicateValidator.sessionSentences.has(sessionId)) {
      SentenceLevelDuplicateValidator.sessionSentences.set(sessionId, new Set());
    }
    
    const sessionSentences = SentenceLevelDuplicateValidator.sessionSentences.get(sessionId)!;
    
    sentences.forEach(sentence => {
      const normalizedSentence = this.normalizeSentence(sentence);
      
      // Add to session sentences
      sessionSentences.add(normalizedSentence);
      
      // Add to global registry
      const entry: SentenceEntry = {
        sentence: sentence,
        normalizedSentence: normalizedSentence,
        sessionId: sessionId,
        studentName: context.neisContext?.studentInfo?.name || 'unknown',
        section: context.neisContext?.sectionName || 'unknown',
        location: `${context.sheet}:${context.cell}`,
        timestamp: new Date()
      };
      
      if (!SentenceLevelDuplicateValidator.sentenceRegistry.has(normalizedSentence)) {
        SentenceLevelDuplicateValidator.sentenceRegistry.set(normalizedSentence, []);
      }
      
      SentenceLevelDuplicateValidator.sentenceRegistry.get(normalizedSentence)!.push(entry);
    });
  }

  /**
   * Create sentence duplicate error
   */
  private createSentenceDuplicateError(
    sentence: string,
    originalText: string,
    context: ValidationContext,
    type: 'internal' | 'external' | 'similar',
    message: string
  ): ValidationError {
    
    const severity = type === 'internal' ? 'error' : 'warning';
    const confidence = type === 'internal' ? 0.95 : 0.8;
    
    // Find sentence position in original text for highlighting
    const sentenceStart = originalText.indexOf(sentence);
    const highlightRange = sentenceStart !== -1 ? 
      { start: sentenceStart, end: sentenceStart + sentence.length } : 
      undefined;
    
    return this.createErrorWithHighlight(
      `문장 중복 검출: ${message}`,
      `sentence-duplicate-${type}`,
      severity,
      originalText,
      '중복된 문장을 다른 표현으로 수정하거나 삭제하세요',
      confidence,
      highlightRange
    );
  }

  /**
   * Create cross-sentence duplicate error
   */
  private createCrossSentenceDuplicateError(
    sentence: string,
    originalText: string,
    context: ValidationContext,
    existingEntries: SentenceEntry[]
  ): ValidationError {
    
    const locations = existingEntries.map(entry => entry.location).join(', ');
    const students = [...new Set(existingEntries.map(entry => entry.studentName))].join(', ');
    
    return this.createSentenceDuplicateError(
      sentence,
      originalText,
      context,
      'external',
      `다른 위치와 문장 중복: ${students} (${locations})`
    );
  }

  /**
   * Get session ID for tracking
   */
  private getSessionId(context: ValidationContext): string {
    return context.neisContext?.studentInfo?.name || 'session';
  }

  /**
   * Truncate sentence for display
   */
  private truncateSentence(sentence: string): string {
    return sentence.length > 50 ? sentence.substring(0, 47) + '...' : sentence;
  }

  /**
   * Clear session data (for new validation sessions)
   */
  static clearSessionData(sessionId?: string): void {
    if (sessionId) {
      SentenceLevelDuplicateValidator.sessionSentences.delete(sessionId);
    } else {
      SentenceLevelDuplicateValidator.sessionSentences.clear();
      SentenceLevelDuplicateValidator.sentenceRegistry.clear();
    }
  }

  /**
   * Check if validation should be applied
   */
  shouldValidate(context: ValidationContext): boolean {
    // Apply to content rows that likely contain multiple sentences
    return context.neisContext?.isContentRow === true;
  }
}

/**
 * Types for sentence tracking
 */
interface SentenceEntry {
  sentence: string;
  normalizedSentence: string;
  sessionId: string;
  studentName: string;
  section: string;
  location: string;
  timestamp: Date;
}
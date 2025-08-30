import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';
import OpenAI from 'openai';

export class AIValidator extends BaseValidator {
  private openai: OpenAI | null = null;
  private readonly enabled: boolean;

  constructor() {
    super('ai_validation', 'AI Content Validator');
    
    // Check if AI validation is explicitly disabled
    if (process.env.DISABLE_AI_VALIDATION === 'true') {
      console.log('🚫 AI validation explicitly disabled via DISABLE_AI_VALIDATION=true');
      this.enabled = false;
      return;
    }
    
    this.enabled = !!process.env.UPSTAGE_API_KEY;
    
    if (this.enabled) {
      this.openai = new OpenAI({
        apiKey: process.env.UPSTAGE_API_KEY,
        baseURL: 'https://api.upstage.ai/v1/solar',
      });
    } else {
      console.warn('⚠️ Upstage API key not found. AI validation will be skipped.');
    }
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    if (!this.enabled) {
      return [];
    }

    const errors: ValidationError[] = [];
    
    // Skip validation for empty cells, numbers only, dates, or very short text
    if (!text || this.isOnlyNumbers(text) || this.isDateTime(text) || text.length < 15) {
      return errors;
    }

    // More selective AI validation - only for substantial Korean text content
    if (this.shouldUseAIValidation(text)) {
      try {
        const aiErrors = await this.performAIValidation(text, context);
        errors.push(...aiErrors);
      } catch (error) {
        console.error('AI validation error:', error);
        // Don't add errors for AI failures - just log and continue
      }
    }

    return errors;
  }

  private shouldUseAIValidation(text: string): boolean {
    // Only validate text that is:
    // 1. At least 25 characters long (more substantial content)
    // 2. Contains Korean characters
    // 3. Has some complexity (not just repeated patterns)
    // 4. Likely to contain educational content that needs validation
    
    if (text.length < 25) return false;
    if (!this.isKoreanText(text)) return false;
    
    // Skip overly repetitive text (like "동일 동일 동일...")
    const uniqueChars = new Set(text.replace(/\s/g, '')).size;
    if (uniqueChars < text.length * 0.3) return false;
    
    // Focus on educational content - look for key patterns
    const educationalPatterns = [
      /학습|교육|지도|활동|참여|태도|능력|향상|발전|성취|이해|표현|협력|소통|창의|사고|문제해결/,
      /수업|과제|발표|토론|실험|관찰|체험|프로젝트|계획|실행|평가|반성/,
      /독서|글쓰기|말하기|듣기|읽기|계산|분석|종합|적용|탐구/
    ];
    
    return educationalPatterns.some(pattern => pattern.test(text));
  }

  private async performAIValidation(text: string, context: ValidationContext, retryCount = 0): Promise<ValidationError[]> {
    if (!this.openai) {
      return [];
    }

    try {
      const prompt = this.buildValidationPrompt(text, context);
      
      // Add timeout and retry logic
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      try {
        const response = await this.openai.chat.completions.create({
          model: 'solar-pro',
          messages: [
            {
              role: 'system',
              content: `한국 학교생활기록부 검증 전문가로서 다음 텍스트를 빠르고 정확하게 검증해주세요. JSON 형식으로만 응답하세요.

{
  "issues": [
    {
      "type": "content|grammar|appropriateness|style",
      "severity": "high|medium|low", 
      "message": "문제 설명",
      "suggestion": "개선 제안", 
      "problemText": "문제 부분",
      "confidence": 0.8
    }
  ]
}

검증 기준: 학교생활기록부 작성 규정, 교육적 적절성, 한국어 문법, 객관성, 개인정보 보호`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 600, // Reduced for faster response
          temperature: 0.2, // More deterministic
        }, {
          signal: controller.signal // Add timeout signal
        });

        clearTimeout(timeout);
        
        const content = response.choices[0]?.message?.content;
        if (!content) {
          return [];
        }

        return this.parseAIResponse(content, text);

      } catch (error: any) {
        clearTimeout(timeout);
        
        // Handle timeout and rate limiting with retry
        if (error.name === 'AbortError' || error?.response?.status === 429 || error?.response?.status === 503) {
          if (retryCount < 2) { // Max 2 retries
            const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`AI validation retry ${retryCount + 1} after ${backoffDelay}ms for ${context.cell}`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            return this.performAIValidation(text, context, retryCount + 1);
          }
        }
        
        throw error;
      }

    } catch (error: any) {
      console.error(`AI validation failed for ${context.cell}:`, error?.message || error);
      return []; // Return empty array instead of throwing
    }
  }

  private buildValidationPrompt(text: string, context: ValidationContext): string {
    return `다음 텍스트를 학교생활기록부 작성 기준에 따라 검증해주세요:

텍스트: "${text}"

위치 정보:
- 시트: ${context.sheet}
- 셀: ${context.cell}

다음 관점에서 검증해주세요:
1. 학교생활기록부 작성 규정 준수 여부
2. 교육적으로 적절한 표현 사용 여부
3. 한국어 문법 및 어법의 정확성
4. 내용의 객관성과 구체성
5. 개인정보 보호 관련 이슈

응답 시 문제가 있는 정확한 텍스트 부분을 "problemText" 필드에 포함해주세요.
문제가 없으면 빈 배열로 응답해주세요.`;
  }

  private parseAIResponse(content: string, originalText: string): ValidationError[] {
    try {
      // More robust JSON extraction from AI response
      const cleanedContent = this.extractJSONFromAIResponse(content);
      
      if (!cleanedContent) {
        console.warn('No valid JSON found in AI response');
        return [];
      }
      
      const response = JSON.parse(cleanedContent);
      const errors: ValidationError[] = [];

      if (response.issues && Array.isArray(response.issues)) {
        for (const issue of response.issues) {
          const severity = this.mapSeverity(issue.severity);
          
          // Calculate highlight range if problemText is provided
          let highlightRange: { start: number; end: number } | undefined = undefined;
          let contextBefore: string | undefined = undefined;
          let contextAfter: string | undefined = undefined;
          
          if (issue.problemText && originalText) {
            const problemText = issue.problemText.toString().trim();
            const startIndex = originalText.indexOf(problemText);
            
            if (startIndex !== -1) {
              highlightRange = {
                start: startIndex,
                end: startIndex + problemText.length
              };
              
              // Extract context (30 characters before and after)
              const contextLength = 30;
              const contextStart = Math.max(0, startIndex - contextLength);
              const contextEnd = Math.min(originalText.length, startIndex + problemText.length + contextLength);
              
              contextBefore = startIndex > contextLength ? 
                '...' + originalText.substring(contextStart, startIndex) :
                originalText.substring(0, startIndex);
                
              contextAfter = startIndex + problemText.length + contextLength < originalText.length ?
                originalText.substring(startIndex + problemText.length, contextEnd) + '...' :
                originalText.substring(startIndex + problemText.length);
            }
          }
          
          const error = this.createErrorWithHighlight(
            issue.message || 'AI 검증에서 문제가 발견되었습니다',
            `ai-validation-${issue.type || 'content'}`,
            severity,
            originalText,
            issue.suggestion,
            issue.confidence || 0.7,
            highlightRange,
            contextBefore,
            contextAfter
          );
          errors.push(error);
        }
      }

      return errors;

    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw AI response (first 500 chars):', content.substring(0, 500));
      return [];
    }
  }

  private extractJSONFromAIResponse(content: string): string | null {
    try {
      let cleanedContent = content.trim();
      
      // Method 1: Remove markdown code blocks
      if (cleanedContent.includes('```json')) {
        const jsonMatch = cleanedContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          cleanedContent = jsonMatch[1].trim();
        }
      } else if (cleanedContent.includes('```')) {
        const codeMatch = cleanedContent.match(/```\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          cleanedContent = codeMatch[1].trim();
        }
      }
      
      // Method 2: Find JSON object boundaries
      const jsonStart = cleanedContent.indexOf('{');
      const jsonEnd = cleanedContent.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
      }
      
      // Method 3: Remove common non-JSON text patterns
      cleanedContent = cleanedContent
        .replace(/^[^{]*/, '') // Remove text before first {
        .replace(/[^}]*$/, '') // Remove text after last }
        .trim();
      
      // Validate that we have something that looks like JSON
      if (!cleanedContent.startsWith('{') || !cleanedContent.endsWith('}')) {
        console.warn('Extracted content does not look like JSON:', cleanedContent.substring(0, 100));
        return null;
      }
      
      // Test parse to ensure it's valid JSON
      JSON.parse(cleanedContent);
      return cleanedContent;
      
    } catch (error) {
      console.error('JSON extraction failed:', error);
      return null;
    }
  }

  private mapSeverity(aiSeverity: string): 'error' | 'warning' | 'info' {
    switch (aiSeverity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
      default:
        return 'info';
    }
  }
}
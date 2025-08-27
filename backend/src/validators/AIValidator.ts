import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';
import OpenAI from 'openai';

export class AIValidator extends BaseValidator {
  private openai: OpenAI | null = null;
  private readonly enabled: boolean;

  constructor() {
    super('ai_validation', 'AI Content Validator');
    
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
    if (!text || this.isOnlyNumbers(text) || this.isDateTime(text) || text.length < 10) {
      return errors;
    }

    try {
      // Use AI validation for longer, complex text that might have contextual issues
      if (text.length > 20 && this.isKoreanText(text)) {
        const aiErrors = await this.performAIValidation(text, context);
        errors.push(...aiErrors);
      }
    } catch (error) {
      console.error('AI validation error:', error);
      // Don't add errors for AI failures - just log and continue
    }

    return errors;
  }

  private async performAIValidation(text: string, context: ValidationContext): Promise<ValidationError[]> {
    if (!this.openai) {
      return [];
    }

    try {
      const prompt = this.buildValidationPrompt(text, context);
      
      const response = await this.openai.chat.completions.create({
        model: 'solar-pro',
        messages: [
          {
            role: 'system',
            content: `당신은 한국의 학교생활기록부 검증 전문가입니다. 학교생활기록부 작성 규정에 따라 텍스트를 검증하고, 문제가 있는 부분을 찾아 JSON 형식으로 응답해주세요.

응답 형식:
{
  "issues": [
    {
      "type": "content|grammar|appropriateness|style",
      "severity": "high|medium|low",
      "message": "문제 설명",
      "suggestion": "개선 제안",
      "confidence": 0.8
    }
  ]
}

검증 기준:
1. 교육적 맥락에서의 적절성
2. 학교생활기록부 작성 규정 준수
3. 한국어 문법 및 표현의 자연스러움
4. 내용의 구체성과 객관성
5. 학생 개인정보 보호 관련 사항`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return [];
      }

      return this.parseAIResponse(content, text);

    } catch (error) {
      console.error('Upstage API error:', error);
      return [];
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

문제가 없으면 빈 배열로 응답해주세요.`;
  }

  private parseAIResponse(content: string, originalText: string): ValidationError[] {
    try {
      const response = JSON.parse(content);
      const errors: ValidationError[] = [];

      if (response.issues && Array.isArray(response.issues)) {
        for (const issue of response.issues) {
          const severity = this.mapSeverity(issue.severity);
          const error = this.createError(
            issue.message || 'AI 검증에서 문제가 발견되었습니다',
            `ai-validation-${issue.type || 'content'}`,
            severity,
            originalText,
            issue.suggestion,
            issue.confidence || 0.7
          );
          errors.push(error);
        }
      }

      return errors;

    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return [];
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
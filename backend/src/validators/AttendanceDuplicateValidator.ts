import { BaseValidator } from './BaseValidator';
import { ValidationError, ValidationContext } from '../types/validation';

export interface AttendanceRecord {
  date: string;
  type: '지각' | '조퇴' | '결과' | '결석' | '출석';
  reason?: string;
  location?: string;
  originalText: string;
}

export interface AttendanceSummary {
  totalSchoolDays: number;
  attendanceDays: number;
  absenceDays: number;
  tardyDays: number;
  earlyLeaveDays: number;
  approvedAbsenceDays: number;
}

export class AttendanceDuplicateValidator extends BaseValidator {
  private attendanceRecords: Map<string, AttendanceRecord[]> = new Map(); // studentId -> records
  private attendanceSummaries: Map<string, AttendanceSummary> = new Map(); // studentId -> summary

  private readonly ATTENDANCE_PATTERNS = {
    DATE_PATTERNS: [
      /(\d{4})[-./년](\d{1,2})[-./월](\d{1,2})일?/,    // 2024-03-15, 2024.03.15, 2024년 3월 15일
      /(\d{1,2})[-./월](\d{1,2})일?/,                 // 3-15, 3.15, 3월 15일
      /(\d{1,2})\/(\d{1,2})/                          // 3/15
    ],
    ATTENDANCE_TYPES: {
      '결석': ['결석', '무단결석', '병결', '사고결석', '기타결석'],
      '지각': ['지각', '무단지각', '병지각', '사고지각', '기타지각'],
      '조퇴': ['조퇴', '무단조퇴', '병조퇴', '사고조퇴', '기타조퇴'],
      '결과': ['결과', '무단결과', '병결과', '사고결과', '기타결과'],
      '출석': ['출석', '정상출석']
    },
    SUMMARY_KEYWORDS: [
      '수업일수', '출석일수', '결석일수', '지각일수', '조퇴일수', '결과일수',
      '총', '계', '합계', '누계'
    ]
  };

  constructor() {
    super('attendance_duplicate', 'Attendance Duplicate Validator');
  }

  async validate(text: string, context: ValidationContext): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Skip validation for empty or very short text
    if (!text || text.length < 3) {
      return errors;
    }

    // Only validate attendance sections
    if (!this.isAttendanceSection(context)) {
      return errors;
    }

    const studentId = context.studentName || 'unknown';

    // Initialize student records if not exists
    if (!this.attendanceRecords.has(studentId)) {
      this.attendanceRecords.set(studentId, []);
    }

    // Parse attendance record from text
    const attendanceRecord = this.parseAttendanceRecord(text, context);
    if (attendanceRecord) {
      // Check for duplicate attendance records
      const duplicateErrors = this.checkAttendanceDuplicates(studentId, attendanceRecord, context);
      errors.push(...duplicateErrors);

      // Store the record
      this.attendanceRecords.get(studentId)!.push(attendanceRecord);
    }

    // Parse attendance summary
    const summaryData = this.parseAttendanceSummary(text);
    if (summaryData) {
      this.attendanceSummaries.set(studentId, summaryData);

      // Validate summary consistency
      const summaryErrors = this.validateAttendanceSummary(studentId, summaryData, context);
      errors.push(...summaryErrors);
    }

    return errors;
  }

  /**
   * Check if current context is attendance section
   */
  private isAttendanceSection(context: ValidationContext): boolean {
    const sectionIndicators = ['출결상황', '출결', '결석', '지각', '조퇴', '출석'];
    const contextText = `${context.section} ${context.sheet}`.toLowerCase();
    
    return sectionIndicators.some(indicator => contextText.includes(indicator));
  }

  /**
   * Parse attendance record from text
   */
  private parseAttendanceRecord(text: string, context: ValidationContext): AttendanceRecord | null {
    const dateMatch = this.extractDate(text);
    const typeMatch = this.extractAttendanceType(text);

    if (!dateMatch && !typeMatch) {
      return null;
    }

    return {
      date: dateMatch || '',
      type: typeMatch || '출석',
      reason: this.extractReason(text),
      location: `${context.sheet}!${context.cell}`,
      originalText: text
    };
  }

  /**
   * Extract date from text
   */
  private extractDate(text: string): string | null {
    for (const pattern of this.ATTENDANCE_PATTERNS.DATE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        if (match[1] && match[2] && match[3]) {
          // Full date with year
          const year = match[1].length === 4 ? match[1] : `20${match[1]}`;
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          return `${year}-${month}-${day}`;
        } else if (match[1] && match[2]) {
          // Month and day only, assume current year
          const year = new Date().getFullYear();
          const month = match[1].padStart(2, '0');
          const day = match[2].padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    }
    return null;
  }

  /**
   * Extract attendance type from text
   */
  private extractAttendanceType(text: string): AttendanceRecord['type'] | null {
    for (const [mainType, variants] of Object.entries(this.ATTENDANCE_PATTERNS.ATTENDANCE_TYPES)) {
      for (const variant of variants) {
        if (text.includes(variant)) {
          return mainType as AttendanceRecord['type'];
        }
      }
    }
    return null;
  }

  /**
   * Extract reason from text
   */
  private extractReason(text: string): string {
    // Remove date and attendance type, keep the rest as reason
    let reason = text;
    
    // Remove date patterns
    for (const pattern of this.ATTENDANCE_PATTERNS.DATE_PATTERNS) {
      reason = reason.replace(pattern, '').trim();
    }

    // Remove attendance type words
    for (const variants of Object.values(this.ATTENDANCE_PATTERNS.ATTENDANCE_TYPES)) {
      for (const variant of variants) {
        reason = reason.replace(new RegExp(variant, 'g'), '').trim();
      }
    }

    return reason.replace(/\s+/g, ' ').trim();
  }

  /**
   * Check for duplicate attendance records
   */
  private checkAttendanceDuplicates(
    studentId: string, 
    newRecord: AttendanceRecord, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const existingRecords = this.attendanceRecords.get(studentId) || [];

    for (const existing of existingRecords) {
      // Check for same date duplicates
      if (newRecord.date && existing.date === newRecord.date) {
        // Allow different types on same date (e.g., 지각 and 조퇴 on same day)
        if (existing.type === newRecord.type) {
          const error = this.createError(
            `동일 날짜(${newRecord.date})에 같은 유형(${newRecord.type})의 출결 기록이 중복됨`,
            'duplicate-attendance-date',
            'error',
            newRecord.originalText,
            '중복된 출결 기록을 확인하고 하나만 남기세요'
          );
          errors.push(error);
        } else {
          // Different types on same date - warning only
          const error = this.createError(
            `동일 날짜(${newRecord.date})에 여러 출결 기록이 있음: ${existing.type}, ${newRecord.type}`,
            'multiple-attendance-same-date',
            'warning',
            newRecord.originalText,
            '같은 날짜의 여러 출결 기록이 올바른지 확인하세요'
          );
          errors.push(error);
        }
      }

      // Check for identical content (regardless of date)
      if (existing.originalText.trim() === newRecord.originalText.trim()) {
        const error = this.createError(
          '동일한 출결 기록이 중복 입력됨',
          'duplicate-attendance-content',
          'error',
          newRecord.originalText,
          '중복된 내용을 삭제하세요'
        );
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Parse attendance summary data
   */
  private parseAttendanceSummary(text: string): AttendanceSummary | null {
    if (!this.ATTENDANCE_PATTERNS.SUMMARY_KEYWORDS.some(keyword => text.includes(keyword))) {
      return null;
    }

    const numbers = text.match(/\d+/g);
    if (!numbers || numbers.length < 2) {
      return null;
    }

    // Extract numbers and try to match them to summary fields
    const extractedNumbers = numbers.map(n => parseInt(n, 10));
    
    // Basic heuristic for common summary patterns
    return {
      totalSchoolDays: extractedNumbers[0] || 0,
      attendanceDays: extractedNumbers[1] || 0,
      absenceDays: extractedNumbers[2] || 0,
      tardyDays: extractedNumbers[3] || 0,
      earlyLeaveDays: extractedNumbers[4] || 0,
      approvedAbsenceDays: extractedNumbers[5] || 0
    };
  }

  /**
   * Validate attendance summary for logical consistency
   */
  private validateAttendanceSummary(
    studentId: string, 
    summary: AttendanceSummary, 
    context: ValidationContext
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if attendance days + absence days = total school days
    const totalAccounted = summary.attendanceDays + summary.absenceDays;
    if (summary.totalSchoolDays > 0 && totalAccounted > 0) {
      if (Math.abs(totalAccounted - summary.totalSchoolDays) > 1) { // Allow 1 day tolerance
        const error = this.createError(
          `출석일수(${summary.attendanceDays}) + 결석일수(${summary.absenceDays}) = ${totalAccounted}일이 수업일수(${summary.totalSchoolDays})와 일치하지 않음`,
          'attendance-summary-mismatch',
          'error',
          `수업일수: ${summary.totalSchoolDays}, 출석일수: ${summary.attendanceDays}, 결석일수: ${summary.absenceDays}`,
          '출결 누계를 다시 계산하여 확인하세요'
        );
        errors.push(error);
      }
    }

    // Validate against individual records
    const individualRecords = this.attendanceRecords.get(studentId) || [];
    if (individualRecords.length > 0) {
      const recordCounts = this.countRecordsByType(individualRecords);
      
      // Check if summary matches individual record counts
      if (summary.absenceDays > 0 && recordCounts.결석 > 0) {
        if (Math.abs(summary.absenceDays - recordCounts.결석) > 1) {
          const error = this.createError(
            `결석일수 요약(${summary.absenceDays}일)이 개별 결석 기록 수(${recordCounts.결석}일)와 일치하지 않음`,
            'absence-count-mismatch',
            'warning',
            `요약: ${summary.absenceDays}일, 기록: ${recordCounts.결석}일`,
            '결석일수 계산을 확인하세요'
          );
          errors.push(error);
        }
      }

      if (summary.tardyDays > 0 && recordCounts.지각 > 0) {
        if (Math.abs(summary.tardyDays - recordCounts.지각) > 1) {
          const error = this.createError(
            `지각일수 요약(${summary.tardyDays}일)이 개별 지각 기록 수(${recordCounts.지각}일)와 일치하지 않음`,
            'tardy-count-mismatch',
            'warning',
            `요약: ${summary.tardyDays}일, 기록: ${recordCounts.지각}일`,
            '지각일수 계산을 확인하세요'
          );
          errors.push(error);
        }
      }
    }

    // Check for reasonable ranges
    if (summary.totalSchoolDays > 300) {
      const error = this.createError(
        `수업일수(${summary.totalSchoolDays}일)가 비정상적으로 높음`,
        'unrealistic-school-days',
        'warning',
        `${summary.totalSchoolDays}일`,
        '수업일수를 확인하세요 (일반적으로 190-220일)'
      );
      errors.push(error);
    }

    return errors;
  }

  /**
   * Count records by attendance type
   */
  private countRecordsByType(records: AttendanceRecord[]): Record<string, number> {
    const counts: Record<string, number> = {
      '출석': 0, '결석': 0, '지각': 0, '조퇴': 0, '결과': 0
    };

    for (const record of records) {
      if (record.type && record.date) { // Only count records with valid date
        counts[record.type] = (counts[record.type] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Get attendance statistics for a student
   */
  public getAttendanceStats(studentId: string): {
    recordCount: number;
    uniqueDates: number;
    typeDistribution: Record<string, number>;
    summary?: AttendanceSummary;
  } {
    const records = this.attendanceRecords.get(studentId) || [];
    const uniqueDates = new Set(records.filter(r => r.date).map(r => r.date)).size;
    const typeDistribution = this.countRecordsByType(records);
    const summary = this.attendanceSummaries.get(studentId);

    return {
      recordCount: records.length,
      uniqueDates,
      typeDistribution,
      summary
    };
  }

  /**
   * Clear attendance data to free memory
   */
  public clearAttendanceData(): void {
    this.attendanceRecords.clear();
    this.attendanceSummaries.clear();
  }

  /**
   * Get overall attendance statistics
   */
  public getOverallStats(): {
    totalStudents: number;
    totalRecords: number;
    avgRecordsPerStudent: number;
    mostCommonIssues: string[];
  } {
    const totalStudents = this.attendanceRecords.size;
    const totalRecords = Array.from(this.attendanceRecords.values())
      .reduce((sum, records) => sum + records.length, 0);
    const avgRecordsPerStudent = totalStudents > 0 ? totalRecords / totalStudents : 0;

    return {
      totalStudents,
      totalRecords,
      avgRecordsPerStudent: Math.round(avgRecordsPerStudent * 100) / 100,
      mostCommonIssues: [
        'duplicate-attendance-date',
        'attendance-summary-mismatch',
        'multiple-attendance-same-date'
      ]
    };
  }
}
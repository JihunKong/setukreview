#!/usr/bin/env node

// Simple local test of validation improvements
const { GrammarValidator } = require('./backend/src/validators/GrammarValidator');

async function testValidationImprovements() {
  console.log('🧪 Testing Validation Improvements Locally');
  console.log('==========================================');
  
  const validator = new GrammarValidator();
  
  // Test cases that were previously causing excessive warnings
  const testCases = [
    {
      name: '연속된 공백 (이전: 3개 감지, 현재: 5개 이상만 감지)',
      text: '학생은   잘   참여했습니다.',  // 3개 공백 - 이제 감지 안됨
      shouldHaveError: false
    },
    {
      name: '과도한 연속 공백 (5개 이상)',
      text: '학생은     매우     잘     참여했습니다.',  // 5개 이상 공백 - 감지됨
      shouldHaveError: true
    },
    {
      name: '구조화된 데이터 (날짜)',
      text: '2024-03-15 수업 참여',
      shouldHaveError: false
    },
    {
      name: '구조화된 데이터 (시간)',
      text: '3시 30분 도서관',
      shouldHaveError: false
    },
    {
      name: '구조화된 데이터 (학년반)',
      text: '3학년 2반',
      shouldHaveError: false
    },
    {
      name: '서술형 텍스트 (마침표 필요)',
      text: '학생은 수업에 적극적으로 참여하며 다른 학생들과 협력하여 과제를 완성했습니다',
      shouldHaveError: true
    },
    {
      name: '제목/헤더 형태 (마침표 불필요)',
      text: '국어 성취도',
      shouldHaveError: false
    },
    {
      name: '짧은 텍스트 (마침표 불필요)',
      text: '우수함',
      shouldHaveError: false
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`   Input: "${testCase.text}"`);
    
    try {
      const context = {
        sheet: 'Test',
        row: 1,
        column: 'A',
        cell: 'A1'
      };
      
      const errors = await validator.validate(testCase.text, context);
      const hasError = errors && errors.length > 0;
      
      console.log(`   Expected error: ${testCase.shouldHaveError}`);
      console.log(`   Actual errors: ${errors.length}`);
      
      if (errors.length > 0) {
        errors.forEach(error => {
          console.log(`   -> ${error.message} (${error.severity})`);
        });
      }
      
      const testPassed = (hasError === testCase.shouldHaveError);
      console.log(`   Result: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (testPassed) {
        passedTests++;
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }

  console.log(`\n📊 Test Summary:`);
  console.log(`   Passed: ${passedTests}/${totalTests}`);
  console.log(`   Success Rate: ${Math.round((passedTests/totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('✅ All validation improvements working correctly!');
  } else {
    console.log('❌ Some validation improvements need adjustment');
  }
}

// Run the test
testValidationImprovements().catch(console.error);
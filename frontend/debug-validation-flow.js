/**
 * Debug script to test validation flow and identify issues
 * Run this with: node debug-validation-flow.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function debugValidationFlow() {
  console.log('🔍 Starting validation flow debug...\n');

  try {
    // 1. Test API connectivity
    console.log('1️⃣ Testing API connectivity...');
    const healthCheck = await axios.get(`${API_BASE}/api/health`);
    console.log('✅ API is responsive:', healthCheck.status);

    // 2. Test session creation
    console.log('\n2️⃣ Testing session creation...');
    const sessionResponse = await axios.post(`${API_BASE}/api/upload/session`);
    const sessionId = sessionResponse.data.sessionId;
    console.log('✅ Session created:', sessionId);

    // 3. Simulate file uploads
    console.log('\n3️⃣ Testing file uploads...');
    // We'll simulate this by checking if we have any existing sessions with files
    const sessionData = await axios.get(`${API_BASE}/api/upload/session/${sessionId}`);
    console.log('📋 Session data:', {
      sessionId: sessionData.data.sessionId,
      fileCount: sessionData.data.files?.length || 0
    });

    if (sessionData.data.files?.length === 0) {
      console.log('⚠️ No files in session - upload some files first to test validation');
      return;
    }

    // 4. Test batch validation start
    console.log('\n4️⃣ Testing batch validation start...');
    const batchOptions = {
      validateAll: true,
      priority: 'balanced',
      maxConcurrency: 3
    };

    const batchStart = await axios.post(
      `${API_BASE}/api/validation/batch/${sessionId}/all`,
      { options: batchOptions }
    );
    
    const batchId = batchStart.data.batchId;
    console.log('✅ Batch validation started:', batchId);

    // 5. Poll batch validation
    console.log('\n5️⃣ Polling batch validation...');
    let attempts = 0;
    const maxAttempts = 30; // 1 minute max
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const batchResult = await axios.get(`${API_BASE}/api/validation/batch/${batchId}`);
        
        console.log(`📊 Poll ${attempts}/${maxAttempts}:`, {
          status: batchResult.data.status,
          progress: batchResult.data.progress,
          resultCount: Object.keys(batchResult.data.results || {}).length,
          resultKeys: Object.keys(batchResult.data.results || {})
        });

        if (batchResult.data.status === 'completed') {
          console.log('\n✅ Batch validation completed!');
          
          // Detailed result analysis
          const results = batchResult.data.results || {};
          console.log('\n📋 Final Results Analysis:');
          console.log('Total results:', Object.keys(results).length);
          
          Object.entries(results).forEach(([fileId, result], index) => {
            console.log(`  ${index + 1}. ${fileId}:`, {
              fileName: result?.fileName || 'N/A',
              status: result?.status || 'N/A',
              errors: result?.errors?.length || 0,
              warnings: result?.warnings?.length || 0,
              isValid: result && typeof result === 'object'
            });
          });
          
          break;
        } else if (batchResult.data.status === 'failed') {
          console.log('❌ Batch validation failed');
          break;
        }
        
        // Wait 2 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (pollError) {
        console.error(`❌ Poll attempt ${attempts} failed:`, pollError.message);
      }
    }

    if (attempts >= maxAttempts) {
      console.log('⏰ Polling timeout - validation may still be running');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

// Run the debug
debugValidationFlow().catch(console.error);
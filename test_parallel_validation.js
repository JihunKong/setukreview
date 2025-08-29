const fs = require('fs');
const FormData = require('form-data');

// Use dynamic import for fetch
let fetch;

async function initFetch() {
  if (!fetch) {
    const module = await import('node-fetch');
    fetch = module.default;
  }
  return fetch;
}

// Test parallel file processing
async function testParallelValidation() {
  try {
    console.log('🧪 Starting parallel validation test...');
    
    // Initialize fetch
    await initFetch();
    
    const baseUrl = 'http://localhost:3001';
    
    // Step 1: Create session
    console.log('1️⃣ Creating session...');
    const sessionResponse = await fetch(`${baseUrl}/upload/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test-user' })
    });
    
    if (!sessionResponse.ok) {
      throw new Error(`Failed to create session: ${sessionResponse.status}`);
    }
    
    const sessionData = await sessionResponse.json();
    const sessionId = sessionData.sessionId;
    console.log(`✅ Session created: ${sessionId}`);
    
    // Step 2: Upload multiple test files
    console.log('2️⃣ Uploading test files...');
    
    const testFiles = [
      'download-6349867291413099.xlsx',
      'download-6349872405051951.xlsx', 
      'download-6349877815723677.xlsx',
      'download-6349893212281767.xlsx'
    ];
    
    const formData = new FormData();
    
    for (const fileName of testFiles) {
      const filePath = `/Users/jihunkong/setukreview/testfiles/${fileName}`;
      if (fs.existsSync(filePath)) {
        console.log(`📎 Adding ${fileName}`);
        formData.append('files', fs.createReadStream(filePath));
      } else {
        console.warn(`⚠️  File not found: ${fileName}`);
      }
    }
    
    const uploadResponse = await fetch(`${baseUrl}/upload/multiple/${sessionId}`, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload files: ${uploadResponse.status}`);
    }
    
    const uploadData = await uploadResponse.json();
    console.log(`✅ Uploaded ${uploadData.totalFiles} files`);
    
    // Step 3: Start batch validation for all files
    console.log('3️⃣ Starting batch validation...');
    
    const validationResponse = await fetch(`${baseUrl}/validation/batch/${sessionId}/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        options: {
          maxConcurrency: 3,
          priority: 'balanced'
        }
      })
    });
    
    if (!validationResponse.ok) {
      throw new Error(`Failed to start validation: ${validationResponse.status}`);
    }
    
    const validationData = await validationResponse.json();
    const batchId = validationData.batchId;
    console.log(`✅ Batch validation started: ${batchId}`);
    
    // Step 4: Monitor validation progress
    console.log('4️⃣ Monitoring validation progress...');
    
    let completed = false;
    let attempts = 0;
    const maxAttempts = 30; // 1 minute timeout
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;
      
      const progressResponse = await fetch(`${baseUrl}/validation/batch/${batchId}`);
      if (!progressResponse.ok) {
        console.warn(`⚠️  Failed to get progress: ${progressResponse.status}`);
        continue;
      }
      
      const progressData = await progressResponse.json();
      
      console.log(`📊 Progress: ${progressData.progress}% (${progressData.summary.completedFiles}/${progressData.summary.totalFiles} files)`);
      console.log(`   Completed: ${progressData.summary.completedFiles}, Failed: ${progressData.summary.failedFiles}`);
      console.log(`   Total Errors: ${progressData.summary.totalErrors}, Warnings: ${progressData.summary.totalWarnings}`);
      
      if (progressData.status === 'completed' || progressData.status === 'failed') {
        completed = true;
        
        console.log('\\n🎯 Final Results:');
        console.log(`Status: ${progressData.status}`);
        console.log(`Total Files: ${progressData.summary.totalFiles}`);
        console.log(`Completed Files: ${progressData.summary.completedFiles}`);
        console.log(`Failed Files: ${progressData.summary.failedFiles}`);
        console.log(`Processing Time: ${progressData.summary.processingTimeSeconds}s`);
        
        // Check individual file results
        const results = progressData.results || {};
        console.log('\\n📋 Individual File Results:');
        Object.entries(results).forEach(([fileId, result]) => {
          console.log(`  📄 ${result.fileName}: ${result.status} (${result.errors?.length || 0} errors, ${result.warnings?.length || 0} warnings)`);
        });
        
        // Verify all files were processed
        if (progressData.summary.completedFiles + progressData.summary.failedFiles === progressData.summary.totalFiles) {
          console.log('\\n✅ SUCCESS: All files were processed!');
          
          // Check if NEIS headers were filtered
          let neisHeadersFound = false;
          Object.values(results).forEach(result => {
            if (result.errors) {
              result.errors.forEach(error => {
                if (error.originalText && error.originalText.match(/행.*동.*특.*성.*및.*종.*합.*의.*견/)) {
                  neisHeadersFound = true;
                }
              });
            }
          });
          
          if (!neisHeadersFound) {
            console.log('✅ NEIS header filtering is working correctly!');
          } else {
            console.log('⚠️  NEIS headers were found in validation results - filtering may need adjustment');
          }
          
        } else {
          console.log('❌ ERROR: Not all files were processed!');
        }
      }
    }
    
    if (!completed) {
      console.log('⏰ Validation timed out - check server logs for details');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testParallelValidation();
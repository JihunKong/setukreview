const fs = require('fs');
const FormData = require('form-data');
const { default: fetch } = require('node-fetch');

async function testMultiFileUpload() {
  try {
    // Create session first
    console.log('Creating session...');
    const sessionResponse = await fetch('http://localhost:3001/api/upload/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test-user' })
    });
    
    const sessionData = await sessionResponse.json();
    console.log('Session created:', sessionData);
    
    if (!sessionData.success) {
      throw new Error('Failed to create session');
    }
    
    // Prepare files for upload
    const form = new FormData();
    
    // Add test files
    const testFiles = [
      './testfiles/download-6349867291413099.xlsx',
      './testfiles/download-6349872405051951.xlsx',
      './testfiles/download-6349877815723677.xlsx'
    ];
    
    for (const filePath of testFiles) {
      if (fs.existsSync(filePath)) {
        console.log(`Adding file: ${filePath}`);
        form.append('files', fs.createReadStream(filePath));
      } else {
        console.log(`File not found: ${filePath}`);
      }
    }
    
    // Upload files
    console.log('Uploading files...');
    const uploadResponse = await fetch(`http://localhost:3001/api/upload/multiple/${sessionData.sessionId}`, {
      method: 'POST',
      body: form
    });
    
    const uploadData = await uploadResponse.json();
    console.log('Upload result:', JSON.stringify(uploadData, null, 2));
    
    // Get session info
    const sessionInfoResponse = await fetch(`http://localhost:3001/api/upload/session/${sessionData.sessionId}`);
    const sessionInfo = await sessionInfoResponse.json();
    console.log('Session info:', JSON.stringify(sessionInfo, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMultiFileUpload();
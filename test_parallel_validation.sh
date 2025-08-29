#!/bin/bash

echo "🧪 Starting parallel validation test..."

BASE_URL="http://localhost:3001"

# Step 1: Create session
echo "1️⃣ Creating session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/session" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}')

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to create session"
  exit 1
fi

SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$SESSION_ID" ]]; then
  echo "❌ Could not extract session ID"
  echo "Response: $SESSION_RESPONSE"
  exit 1
fi

echo "✅ Session created: $SESSION_ID"

# Step 2: Upload multiple test files
echo "2️⃣ Uploading test files..."

UPLOAD_CMD="curl -s -X POST \"$BASE_URL/api/upload/multiple/$SESSION_ID\""

# Add test files if they exist
TEST_FILES=(
  "download-6349867291413099.xlsx"
  "download-6349872405051951.xlsx"
  "download-6349877815723677.xlsx"
  "download-6349893212281767.xlsx"
)

UPLOAD_FORM=""
FILE_COUNT=0

for file in "${TEST_FILES[@]}"; do
  FILE_PATH="/Users/jihunkong/setukreview/testfiles/$file"
  if [[ -f "$FILE_PATH" ]]; then
    UPLOAD_FORM="$UPLOAD_FORM -F \"files=@$FILE_PATH\""
    echo "📎 Adding $file"
    ((FILE_COUNT++))
  else
    echo "⚠️  File not found: $file"
  fi
done

if [[ $FILE_COUNT -eq 0 ]]; then
  echo "❌ No test files found"
  exit 1
fi

echo "Uploading $FILE_COUNT files..."
UPLOAD_RESPONSE=$(eval $UPLOAD_CMD $UPLOAD_FORM)

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to upload files"
  echo "Response: $UPLOAD_RESPONSE"
  exit 1
fi

echo "✅ Files uploaded"
echo "Response: $UPLOAD_RESPONSE"

# Step 3: Start batch validation
echo "3️⃣ Starting batch validation..."

VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/validation/batch/$SESSION_ID/all" \
  -H "Content-Type: application/json" \
  -d '{"options": {"maxConcurrency": 3, "priority": "balanced"}}')

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to start validation"
  exit 1
fi

BATCH_ID=$(echo $VALIDATION_RESPONSE | grep -o '"batchId":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$BATCH_ID" ]]; then
  echo "❌ Could not extract batch ID"
  echo "Response: $VALIDATION_RESPONSE"
  exit 1
fi

echo "✅ Batch validation started: $BATCH_ID"

# Step 4: Monitor progress
echo "4️⃣ Monitoring validation progress..."

ATTEMPTS=0
MAX_ATTEMPTS=30
COMPLETED=false

while [[ $ATTEMPTS -lt $MAX_ATTEMPTS && "$COMPLETED" == "false" ]]; do
  sleep 2
  ((ATTEMPTS++))
  
  PROGRESS_RESPONSE=$(curl -s "$BASE_URL/api/validation/batch/$BATCH_ID")
  
  if [[ $? -ne 0 ]]; then
    echo "⚠️  Failed to get progress (attempt $ATTEMPTS)"
    continue
  fi
  
  # Extract progress information using grep
  STATUS=$(echo $PROGRESS_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  PROGRESS=$(echo $PROGRESS_RESPONSE | grep -o '"progress":[0-9]*' | cut -d':' -f2)
  TOTAL_FILES=$(echo $PROGRESS_RESPONSE | grep -o '"totalFiles":[0-9]*' | cut -d':' -f2)
  COMPLETED_FILES=$(echo $PROGRESS_RESPONSE | grep -o '"completedFiles":[0-9]*' | cut -d':' -f2)
  FAILED_FILES=$(echo $PROGRESS_RESPONSE | grep -o '"failedFiles":[0-9]*' | cut -d':' -f2)
  TOTAL_ERRORS=$(echo $PROGRESS_RESPONSE | grep -o '"totalErrors":[0-9]*' | cut -d':' -f2)
  
  echo "📊 Progress: ${PROGRESS:-0}% ($COMPLETED_FILES/$TOTAL_FILES files)"
  echo "   Status: $STATUS, Failed: $FAILED_FILES, Errors: $TOTAL_ERRORS"
  
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then
    COMPLETED=true
    
    echo ""
    echo "🎯 Final Results:"
    echo "Status: $STATUS"
    echo "Total Files: $TOTAL_FILES"
    echo "Completed Files: $COMPLETED_FILES"
    echo "Failed Files: $FAILED_FILES"
    echo "Total Errors: $TOTAL_ERRORS"
    
    # Check if all files were processed
    PROCESSED_FILES=$((COMPLETED_FILES + FAILED_FILES))
    if [[ $PROCESSED_FILES -eq $TOTAL_FILES ]]; then
      echo "✅ SUCCESS: All files were processed!"
      
      # Check for real validation content (not mock data)
      if echo $PROGRESS_RESPONSE | grep -q '"originalText"'; then
        echo "✅ Real Excel content is being validated (not mock data)!"
      else
        echo "⚠️  May still be using mock validation data"
      fi
      
    else
      echo "❌ ERROR: Not all files were processed!"
      echo "Processed: $PROCESSED_FILES, Expected: $TOTAL_FILES"
    fi
  fi
done

if [[ "$COMPLETED" == "false" ]]; then
  echo "⏰ Validation timed out - check server logs for details"
fi

echo ""
echo "📋 Full response (last 500 chars):"
echo $PROGRESS_RESPONSE | tail -c 500
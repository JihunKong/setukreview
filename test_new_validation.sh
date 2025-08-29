#!/bin/bash

echo "🧪 Testing NEW synchronous validation endpoint..."

BASE_URL="http://43.201.9.224"

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

# Step 2: Upload multiple test files (use all available test files)
echo "2️⃣ Uploading test files..."

TEST_FILES=(
  "download-6349867291413099.xlsx"
  "download-6349872405051951.xlsx"
  "download-6349877815723677.xlsx"
  "download-6349893212281767.xlsx"
  "download-6349896114294009.xlsx"
)

UPLOAD_FORM=""
FILE_COUNT=0

for file in "${TEST_FILES[@]}"; do
  FILE_PATH="/home/ubuntu/testfiles/$file"
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
UPLOAD_CMD="curl -s -X POST \"$BASE_URL/api/upload/multiple/$SESSION_ID\""
UPLOAD_RESPONSE=$(eval $UPLOAD_CMD $UPLOAD_FORM)

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to upload files"
  echo "Response: $UPLOAD_RESPONSE"
  exit 1
fi

echo "✅ Files uploaded"
echo "Response summary: $(echo $UPLOAD_RESPONSE | grep -o '"totalFiles":[0-9]*' | cut -d':' -f2) files uploaded"

# Step 3: Use NEW direct session validation endpoint
echo "3️⃣ Starting synchronous session validation (NEW ENDPOINT)..."

VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/validation/session/$SESSION_ID" \
  -H "Content-Type: application/json")

if [[ $? -ne 0 ]]; then
  echo "❌ Failed to start validation"
  exit 1
fi

echo "✅ Session validation completed!"

# Extract and display results
SUCCESS=$(echo $VALIDATION_RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)
RESULTS_COUNT=$(echo $VALIDATION_RESPONSE | grep -o '"results":\[.*\]' | grep -o '{"id":' | wc -l)

echo ""
echo "🎯 Final Results:"
echo "Success: $SUCCESS"
echo "Results received: $RESULTS_COUNT files"

if [[ $RESULTS_COUNT -eq $FILE_COUNT ]]; then
  echo "✅ SUCCESS: All $FILE_COUNT files were validated!"
  
  # Show validation summary for each file
  echo ""
  echo "📋 Validation Summary:"
  
  # Extract file names and error/warning counts
  FILES_INFO=$(echo $VALIDATION_RESPONSE | grep -o '"fileName":"[^"]*","status":"[^"]*"')
  echo "$FILES_INFO" | while read -r line; do
    FILE_NAME=$(echo "$line" | grep -o '"fileName":"[^"]*"' | cut -d'"' -f4)
    STATUS=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "   📄 $FILE_NAME: $STATUS"
  done
  
else
  echo "❌ ERROR: Expected $FILE_COUNT files, but got $RESULTS_COUNT results!"
fi

echo ""
echo "📋 Raw response sample (first 500 chars):"
echo $VALIDATION_RESPONSE | head -c 500
echo ""
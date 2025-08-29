#!/bin/bash

echo "🧪 Testing COMPLETE multi-file validation flow (FIXED)..."

BASE_URL="http://43.201.9.224"

# Test with 3 files this time for thorough validation
TEST_FILES=(
  "download-6349867291413099.xlsx"
  "download-6349872405051951.xlsx" 
  "download-6349877815723677.xlsx"
)

echo "1️⃣ Creating session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/session" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}')

SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$SESSION_ID" ]]; then
  echo "❌ Could not extract session ID"
  exit 1
fi

echo "✅ Session created: $SESSION_ID"

echo "2️⃣ Uploading files..."
UPLOAD_FORM=""
for file in "${TEST_FILES[@]}"; do
  UPLOAD_FORM="$UPLOAD_FORM -F \"files=@/home/ubuntu/testfiles/$file\""
done

UPLOAD_CMD="curl -s -X POST \"$BASE_URL/api/upload/multiple/$SESSION_ID\""
UPLOAD_RESPONSE=$(eval $UPLOAD_CMD $UPLOAD_FORM)

echo "✅ Files uploaded"

echo "3️⃣ Starting validation (NO POLLING - immediate results)..."

VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/validation/session/$SESSION_ID" \
  -H "Content-Type: application/json")

SUCCESS=$(echo $VALIDATION_RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)
RESULTS_COUNT=$(echo $VALIDATION_RESPONSE | grep -o '"fileName"' | wc -l)

echo ""
echo "🎯 Final Results:"
echo "Success: $SUCCESS"
echo "Files validated: $RESULTS_COUNT"

if [[ $SUCCESS == "true" && $RESULTS_COUNT -eq ${#TEST_FILES[@]} ]]; then
  echo "✅ SUCCESS: All ${#TEST_FILES[@]} files validated successfully!"
  echo "✅ NO polling needed - results returned immediately!"
  echo "✅ Frontend should now display all validation results!"
else
  echo "❌ Validation issue detected"
fi

echo ""
echo "📊 Validation details (first 300 chars):"
echo $VALIDATION_RESPONSE | head -c 300
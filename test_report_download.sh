#!/bin/bash

echo "🧪 Testing validation and immediate report download..."

BASE_URL="http://43.201.9.224"

# Step 1: Create session
echo "1️⃣ Creating session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/session" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}')

SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)

if [[ -z "$SESSION_ID" ]]; then
  echo "❌ Failed to create session"
  exit 1
fi

echo "✅ Session created: $SESSION_ID"

# Step 2: Upload a single test file
echo "2️⃣ Uploading test file..."
TEST_FILE="download-6349867291413099.xlsx"
FILE_PATH="/home/ubuntu/testfiles/$TEST_FILE"

UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload/session/$SESSION_ID/file" \
  -F "file=@$FILE_PATH")

echo "✅ File uploaded"

# Step 3: Run validation
echo "3️⃣ Starting validation..."
VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/validation/session/$SESSION_ID")

# Extract validation ID from the response
VALIDATION_ID=$(echo $VALIDATION_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -z "$VALIDATION_ID" ]]; then
  echo "❌ No validation ID found in response"
  echo "Response: $VALIDATION_RESPONSE"
  exit 1
fi

echo "✅ Validation completed! ID: $VALIDATION_ID"

# Step 4: Immediately test validation lookup
echo "4️⃣ Testing validation lookup..."
LOOKUP_RESPONSE=$(curl -s "$BASE_URL/api/validation/$VALIDATION_ID" -w '\nSTATUS:%{http_code}')
echo "Validation lookup response: $LOOKUP_RESPONSE"

# Step 5: Try report download
echo "5️⃣ Testing report download..."
DOWNLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/report/batch/download?format=excel" \
  -H "Content-Type: application/json" \
  -d "{\"validationIds\":[\"$VALIDATION_ID\"],\"mergeResults\":true}" \
  -w '\nSTATUS:%{http_code}\nSIZE:%{size_download}')
  
echo "Download response: $DOWNLOAD_RESPONSE"
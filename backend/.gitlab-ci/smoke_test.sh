#!/bin/sh
# CI/CD Smoke Test Script
# Last Updated: 2026-06-27
set -e

URL=$1
ENV=$2

# Configure standard timeouts for curl
CURL_TIMEOUTS="--connect-timeout 5 --max-time 15"

echo "========================================================="
echo "STARTING SMOKE TEST FOR ENV: $ENV ON URL: $URL"
echo "========================================================="

# 1. Health check
echo "Step 1: Checking health endpoint..."
HEALTH_RESP=$(curl -s $CURL_TIMEOUTS "${URL}/api/v1/health")
echo "Health Response: $HEALTH_RESP"
STATUS=$(echo "$HEALTH_RESP" | jq -r '.status' 2>/dev/null || true)
DATABASE=$(echo "$HEALTH_RESP" | jq -r '.database' 2>/dev/null || true)

if [ "$STATUS" != "ok" ] || [ "$DATABASE" != "connected" ]; then
    echo "Health check failed!"
    exit 1
fi
echo "Health check passed!"

# 2. Get Public Core Endpoint (Categories)
echo "Step 2: Checking public categories endpoint..."
CATEGORIES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/categories")
if [ "$CATEGORIES_STATUS" -ne 200 ]; then
    echo "Failed to fetch categories. Status code: $CATEGORIES_STATUS"
    exit 1
fi
echo "Public categories endpoint passed!"

# 3. Read Query Tests (Posts & Parameters)
echo "Step 3: Running read query tests on posts..."
POSTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/posts")
if [ "$POSTS_STATUS" -ne 200 ]; then
    echo "Failed to fetch posts. Status code: $POSTS_STATUS"
    exit 1
fi

POSTS_QUERY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/posts?q=smoke&limit=5&page=1&sort=createdAt:desc")
if [ "$POSTS_QUERY_STATUS" -ne 200 ]; then
    echo "Failed to fetch posts with query parameters. Status code: $POSTS_QUERY_STATUS"
    exit 1
fi
echo "Public posts read queries passed!"

# 4. Check Authenticated Endpoint without Token (should be 401)
echo "Step 4: Checking profile endpoint without authorization header..."
PROFILE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/auth/profile")
if [ "$PROFILE_STATUS" -ne 401 ]; then
    echo "Expected 401 Unauthorized for unauthenticated profile access, but got: $PROFILE_STATUS"
    exit 1
fi
echo "Unauthenticated access check passed!"

# 5. Staging-only Login, Write, and Cleanup Flow (to prevent database pollution in production)
if [ "$ENV" = "staging" ]; then
    RANDOM_ID=$(date +%s)
    TEST_USER="smoke_${RANDOM_ID}"
    TEST_EMAIL="smoke_${RANDOM_ID}@example.com"
    TEST_PASS="TestPass123"

    echo "Step 5: [Staging-only] Registering test user: $TEST_USER"
    REG_RESP=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      $CURL_TIMEOUTS \
      -d "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" \
      "${URL}/api/v1/auth/register")
      
    REG_USER=$(echo "$REG_RESP" | jq -r '.username' 2>/dev/null || true)
    REG_USER_ID=$(echo "$REG_RESP" | jq -r '.id' 2>/dev/null || true)
    
    if [ "$REG_USER" != "$TEST_USER" ] || [ -z "$REG_USER_ID" ] || [ "$REG_USER_ID" = "null" ]; then
        echo "Registration failed! Response: $REG_RESP"
        exit 1
    fi
    echo "Registration successful! User ID: $REG_USER_ID"

    echo "Step 6: [Staging-only] Logging in test user..."
    LOGIN_RESP=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      $CURL_TIMEOUTS \
      -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" \
      "${URL}/api/v1/auth/login")
      
    TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token' 2>/dev/null || true)
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo "Login failed! Response: $LOGIN_RESP"
        exit 1
    fi
    echo "Login successful! Token acquired."

    echo "Step 7: [Staging-only] Fetching profile with token..."
    PROFILE_RESP=$(curl -s -X GET \
      -H "Authorization: Bearer $TOKEN" \
      $CURL_TIMEOUTS \
      "${URL}/api/v1/auth/profile")
      
    PROFILE_SUCCESS=$(echo "$PROFILE_RESP" | jq -r '.success' 2>/dev/null || true)
    PROFILE_USERNAME=$(echo "$PROFILE_RESP" | jq -r '.user.username' 2>/dev/null || true)
    
    if [ "$PROFILE_SUCCESS" != "true" ] || [ "$PROFILE_USERNAME" != "$TEST_USER" ]; then
        echo "Authenticated profile fetch failed! Response: $PROFILE_RESP"
        exit 1
    fi
    echo "Authenticated profile check passed!"

    # Cleanup test user
    if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
        echo "Step 8: [Staging-only] Logging in as Admin to clean up test user..."
        ADMIN_LOGIN_RESP=$(curl -s -X POST \
          -H "Content-Type: application/json" \
          $CURL_TIMEOUTS \
          -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
          "${URL}/api/v1/auth/login")
        
        ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESP" | jq -r '.token' 2>/dev/null || true)
        if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
            echo "Step 9: [Staging-only] Deleting test user with ID: $REG_USER_ID..."
            DELETE_RESP=$(curl -s -X DELETE \
              -H "Authorization: Bearer $ADMIN_TOKEN" \
              $CURL_TIMEOUTS \
              "${URL}/api/v1/users/$REG_USER_ID")
            DELETE_SUCCESS=$(echo "$DELETE_RESP" | jq -r '.success' 2>/dev/null || true)
            if [ "$DELETE_SUCCESS" = "true" ]; then
                echo "Test user deleted successfully!"
            else
                echo "Failed to delete test user. Response: $DELETE_RESP"
            fi
        else
            echo "Could not log in as Admin for cleanup (Token: $ADMIN_TOKEN)."
        fi
    else
        echo "ADMIN_USERNAME or ADMIN_PASSWORD environment variable is not set. Skipping test user cleanup to prevent credential exposure."
    fi
fi

echo "========================================================="
echo "ALL SMOKE TESTS PASSED SUCCESSFULLY!"
echo "========================================================="

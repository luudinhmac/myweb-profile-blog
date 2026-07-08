#!/bin/sh
# CI/CD Smoke Test Script
# Last Updated: 2026-07-08
set -e

URL=$1
ENV=$2
EXPECTED_VERSION=$3

# Configure standard timeouts for curl
CURL_TIMEOUTS="--connect-timeout 5 --max-time 15"

echo "========================================================="
echo "STARTING SMOKE TEST FOR ENV: $ENV ON URL: $URL"
if [ -n "$EXPECTED_VERSION" ]; then
    echo "EXPECTED VERSION/COMMIT: $EXPECTED_VERSION"
fi
echo "========================================================="

# 1. Health check (with dynamic polling & version check)
echo "Step 1: Checking health endpoint (waiting for readiness)..."
TIMEOUT_SECONDS=300
WAIT_INTERVAL=5
MAX_ATTEMPTS=$((TIMEOUT_SECONDS / WAIT_INTERVAL))
ATTEMPT=1
READY=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS: Fetching health status..."
    HEALTH_RESP=$(curl -s $CURL_TIMEOUTS "${URL}/api/v1/health" || true)
    
    if [ -n "$HEALTH_RESP" ]; then
        STATUS=$(echo "$HEALTH_RESP" | jq -r '.status' 2>/dev/null || true)
        DATABASE=$(echo "$HEALTH_RESP" | jq -r '.database' 2>/dev/null || true)
        DEPLOYED_VERSION=$(echo "$HEALTH_RESP" | jq -r '.version' 2>/dev/null || true)
        
        VERSION_MATCHED=1
        if [ -n "$EXPECTED_VERSION" ]; then
            case "$DEPLOYED_VERSION" in
                *"$EXPECTED_VERSION"*) VERSION_MATCHED=1 ;;
                *)
                    VERSION_MATCHED=0
                    echo "Version mismatch: Deployed version is '$DEPLOYED_VERSION', but expected to contain '$EXPECTED_VERSION'"
                    ;;
            esac
        fi
        
        if [ "$STATUS" = "ok" ] && [ "$DATABASE" = "connected" ] && [ $VERSION_MATCHED -eq 1 ]; then
            echo "Health Response: $HEALTH_RESP"
            echo "Service is ready! Health check passed."
            READY=1
            break
        else
            echo "Service response not fully healthy/ready yet (status: $STATUS, database: $DATABASE, version: $DEPLOYED_VERSION)."
        fi
    else
        echo "Service is unreachable or timed out."
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    sleep $WAIT_INTERVAL
done

if [ $READY -ne 1 ]; then
    echo "Error: Service failed to become ready and match expected version within ${TIMEOUT_SECONDS} seconds."
    exit 1
fi

# 2. Get Public Core Endpoint (Categories)
echo "Step 2: Checking public categories endpoint..."
CATEGORIES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/categories" || echo "000")
if [ "$CATEGORIES_STATUS" -ne 200 ]; then
    echo "Failed to fetch categories. Status code: $CATEGORIES_STATUS"
    exit 1
fi
echo "Public categories endpoint passed!"

# 3. Read Query Tests (Posts & Parameters)
echo "Step 3: Running read query tests on posts..."
POSTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/posts" || echo "000")
if [ "$POSTS_STATUS" -ne 200 ]; then
    echo "Failed to fetch posts. Status code: $POSTS_STATUS"
    exit 1
fi

POSTS_QUERY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/posts?q=smoke&limit=5&page=1&sort=createdAt:desc" || echo "000")
if [ "$POSTS_QUERY_STATUS" -ne 200 ]; then
    echo "Failed to fetch posts with query parameters. Status code: $POSTS_QUERY_STATUS"
    exit 1
fi
echo "Public posts read queries passed!"

# 4. Check Authenticated Endpoint without Token (should be 401)
echo "Step 4: Checking profile endpoint without authorization header..."
PROFILE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/auth/profile" || echo "000")
if [ "$PROFILE_STATUS" -ne 401 ]; then
    echo "Expected 401 Unauthorized for unauthenticated profile access, but got: $PROFILE_STATUS"
    exit 1
fi
echo "Unauthenticated access check passed!"

# 5. Staging-only Login, Write, and Cleanup Flow (to prevent database pollution in production)
if [ "$ENV" = "staging" ]; then
    RANDOM_ID="${CI_JOB_ID:-local}_$(date +%s)"
    TEST_USER="smoke_${RANDOM_ID}"
    TEST_EMAIL="smoke_${RANDOM_ID}@example.com"
    TEST_PASS="TestPass123"

    echo "Step 5: [Staging-only] Registering test user: $TEST_USER"
    REG_RESP=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      $CURL_TIMEOUTS \
      -d "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" \
      "${URL}/api/v1/auth/register" || true)
      
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
      "${URL}/api/v1/auth/login" || true)
      
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
      "${URL}/api/v1/auth/profile" || true)
      
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
          "${URL}/api/v1/auth/login" || true)
        
        ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESP" | jq -r '.token' 2>/dev/null || true)
        if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
            echo "Step 9: [Staging-only] Deleting test user with ID: $REG_USER_ID..."
            DELETE_RESP=$(curl -s -X DELETE \
              -H "Authorization: Bearer $ADMIN_TOKEN" \
              $CURL_TIMEOUTS \
              "${URL}/api/v1/users/$REG_USER_ID" || true)
            DELETE_SUCCESS=$(echo "$DELETE_RESP" | jq -r '.success' 2>/dev/null || true)
            if [ "$DELETE_SUCCESS" = "true" ]; then
                echo "Test user deleted successfully!"
            else
                echo "Failed to delete test user. Response: $DELETE_RESP"
                exit 1
            fi
        else
            echo "Could not log in as Admin for cleanup (Token: $ADMIN_TOKEN)."
            exit 1
        fi
    else
        echo "Error: ADMIN_USERNAME or ADMIN_PASSWORD environment variable is not set. Staging cleanup is required to prevent database pollution."
        exit 1
    fi
fi

echo "========================================================="
echo "ALL SMOKE TESTS PASSED SUCCESSFULLY!"
echo "========================================================="

#!/bin/sh
# CI/CD Smoke Test Script
# Last Updated: 2026-07-08
set -e

URL=$1
ENV=$2
EXPECTED_VERSION=$3

# Configure standard timeouts for curl
CURL_TIMEOUTS="--connect-timeout 5 --max-time 15"

# Define cleanup function for trap (Fail-safe database hygiene)
cleanup() {
    EXIT_CODE=$?
    if [ -n "$REG_USER_ID" ] && [ "$REG_USER_ID" != "null" ]; then
        echo "========================================================="
        echo "CLEANUP: Triggering automated test user cleanup for ID: $REG_USER_ID"
        echo "========================================================="
        if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
            ADMIN_LOGIN_RESP=$(curl -s -X POST \
              -H "Content-Type: application/json" \
              $CURL_TIMEOUTS \
              -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
              "${URL}/api/v1/auth/login" || true)
            
            ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESP" | jq -r '.token' 2>/dev/null | tr -d '\r' || true)
            if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
                DELETE_RESP=$(curl -s -X DELETE \
                  -H "Authorization: Bearer $ADMIN_TOKEN" \
                  $CURL_TIMEOUTS \
                  "${URL}/api/v1/users/$REG_USER_ID" || true)
                DELETE_SUCCESS=$(echo "$DELETE_RESP" | jq -r '.success' 2>/dev/null | tr -d '\r' || true)
                if [ "$DELETE_SUCCESS" = "true" ]; then
                    echo "CLEANUP: Test user deleted successfully from database."
                    rm -f test_user_id.txt || true
                else
                    echo "CLEANUP: Failed to delete test user. Response: $DELETE_RESP"
                fi
            else
                echo "CLEANUP: Failed to login as Admin for cleanup (Token: $ADMIN_TOKEN)."
            fi
        else
            echo "CLEANUP: ADMIN_USERNAME or ADMIN_PASSWORD is not set. Cannot clean up."
        fi
    fi
    exit $EXIT_CODE
}

# Register traps
trap cleanup EXIT INT TERM

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
        STATUS=$(echo "$HEALTH_RESP" | jq -r '.status' 2>/dev/null | tr -d '\r' || true)
        DATABASE=$(echo "$HEALTH_RESP" | jq -r '.database' 2>/dev/null | tr -d '\r' || true)
        DEPLOYED_VERSION=$(echo "$HEALTH_RESP" | jq -r '.version' 2>/dev/null | tr -d '\r' || true)
        REDIS_STATUS=$(echo "$HEALTH_RESP" | jq -r '.redis // "n/a"' 2>/dev/null | tr -d '\r' || true)
        REDIS_ERROR=$(echo "$HEALTH_RESP" | jq -r '.redisError // empty' 2>/dev/null | tr -d '\r' || true)
        STORAGE_STATUS=$(echo "$HEALTH_RESP" | jq -r '.storage // "n/a"' 2>/dev/null | tr -d '\r' || true)
        STORAGE_ERROR=$(echo "$HEALTH_RESP" | jq -r '.storageError // empty' 2>/dev/null | tr -d '\r' || true)
        
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
            echo "Service response not fully healthy/ready yet (status: $STATUS, db: $DATABASE, redis: $REDIS_STATUS, storage: $STORAGE_STATUS, version: $DEPLOYED_VERSION)."
            [ -n "$REDIS_ERROR" ] && echo "  Redis error: $REDIS_ERROR"
            [ -n "$STORAGE_ERROR" ] && echo "  Storage error: $STORAGE_ERROR"
        fi
    else
        echo "Service is unreachable or timed out."
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    sleep $WAIT_INTERVAL
done

if [ $READY -ne 1 ]; then
    echo "Error: Service failed to become ready and match expected version within ${TIMEOUT_SECONDS} seconds."
    echo "failed_step=1" > smoke_result.txt
    echo "failed_title=Health Endpoint Check" >> smoke_result.txt
    echo "failed_reason=Service response not fully healthy/ready (status: $STATUS, db: $DATABASE, redis: $REDIS_STATUS, storage: $STORAGE_STATUS, version: $DEPLOYED_VERSION)" >> smoke_result.txt
    exit 1
fi

# 2. Get Public Core Endpoint (Categories)
echo "Step 2: Checking public categories endpoint..."
CATEGORIES_RESP=$(curl -s $CURL_TIMEOUTS -w "\n%{http_code}" "${URL}/api/v1/categories" || echo "000")
CATEGORIES_STATUS=$(echo "$CATEGORIES_RESP" | tail -n1)
CATEGORIES_BODY=$(echo "$CATEGORIES_RESP" | sed '$d')

if [ "$CATEGORIES_STATUS" -ne 200 ]; then
    echo "Failed to fetch categories. Status code: $CATEGORIES_STATUS"
    echo "failed_step=2" > smoke_result.txt
    echo "failed_title=Public Categories Endpoint" >> smoke_result.txt
    echo "failed_reason=HTTP Status: $CATEGORIES_STATUS" >> smoke_result.txt
    exit 1
fi
if ! echo "$CATEGORIES_BODY" | jq -e 'type == "array" or (type == "object" and (has("data") or has("categories")))' >/dev/null 2>&1; then
    echo "Categories response body is not valid JSON or missing expected structure! Response: $CATEGORIES_BODY"
    echo "failed_step=2" > smoke_result.txt
    echo "failed_title=Public Categories Endpoint" >> smoke_result.txt
    echo "failed_reason=Invalid JSON or missing structure" >> smoke_result.txt
    exit 1
fi
echo "Public categories endpoint passed!"

# 3. Read Query Tests (Posts & Parameters)
echo "Step 3: Running read query tests on posts..."
POSTS_RESP=$(curl -s $CURL_TIMEOUTS -w "\n%{http_code}" "${URL}/api/v1/posts" || echo "000")
POSTS_STATUS=$(echo "$POSTS_RESP" | tail -n1)
POSTS_BODY=$(echo "$POSTS_RESP" | sed '$d')

if [ "$POSTS_STATUS" -ne 200 ]; then
    echo "Failed to fetch posts. Status code: $POSTS_STATUS"
    echo "failed_step=3" > smoke_result.txt
    echo "failed_title=Public Posts Endpoint" >> smoke_result.txt
    echo "failed_reason=HTTP Status: $POSTS_STATUS" >> smoke_result.txt
    exit 1
fi
if ! echo "$POSTS_BODY" | jq -e 'type == "array" or (type == "object" and (has("items") or has("data") or has("posts") or (has("total") and has("page") and has("limit") and has("totalPages"))))' >/dev/null 2>&1; then
    echo "Posts response body is not valid JSON or missing expected structure! Response: $POSTS_BODY"
    echo "failed_step=3" > smoke_result.txt
    echo "failed_title=Public Posts Endpoint" >> smoke_result.txt
    echo "failed_reason=Invalid JSON or missing structure" >> smoke_result.txt
    exit 1
fi

POSTS_QUERY_RESP=$(curl -s $CURL_TIMEOUTS -w "\n%{http_code}" "${URL}/api/v1/posts?q=smoke&limit=5&page=1&sort=createdAt:desc" || echo "000")
POSTS_QUERY_STATUS=$(echo "$POSTS_QUERY_RESP" | tail -n1)
POSTS_QUERY_BODY=$(echo "$POSTS_QUERY_RESP" | sed '$d')

if [ "$POSTS_QUERY_STATUS" -ne 200 ]; then
    echo "Failed to fetch posts with query parameters. Status code: $POSTS_QUERY_STATUS"
    echo "failed_step=3" > smoke_result.txt
    echo "failed_title=Public Posts Endpoint (Query)" >> smoke_result.txt
    echo "failed_reason=HTTP Status: $POSTS_QUERY_STATUS" >> smoke_result.txt
    exit 1
fi
if ! echo "$POSTS_QUERY_BODY" | jq -e 'type == "array" or (type == "object" and (has("items") or has("data") or has("posts") or (has("total") and has("page") and has("limit") and has("totalPages"))))' >/dev/null 2>&1; then
    echo "Posts query response body is not valid JSON or missing expected structure! Response: $POSTS_QUERY_BODY"
    echo "failed_step=3" > smoke_result.txt
    echo "failed_title=Public Posts Endpoint (Query)" >> smoke_result.txt
    echo "failed_reason=Invalid JSON or missing structure" >> smoke_result.txt
    exit 1
fi
echo "Public posts read queries passed!"

# 4. Check Authenticated Endpoint without Token (should be 401)
echo "Step 4: Checking profile endpoint without authorization header..."
PROFILE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $CURL_TIMEOUTS "${URL}/api/v1/auth/profile" || echo "000")
if [ "$PROFILE_STATUS" -ne 401 ]; then
    echo "Expected 401 Unauthorized for unauthenticated profile access, but got: $PROFILE_STATUS"
    echo "failed_step=4" > smoke_result.txt
    echo "failed_title=Profile Auth Restriction Check" >> smoke_result.txt
    echo "failed_reason=Expected 401, got HTTP Status: $PROFILE_STATUS" >> smoke_result.txt
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
      
    REG_USER=$(echo "$REG_RESP" | jq -r '.username' 2>/dev/null | tr -d '\r' || true)
    REG_USER_ID=$(echo "$REG_RESP" | jq -r '.id' 2>/dev/null | tr -d '\r' || true)
    
    if [ "$REG_USER" != "$TEST_USER" ] || [ -z "$REG_USER_ID" ] || [ "$REG_USER_ID" = "null" ]; then
        echo "Registration failed! Response: $REG_RESP"
        echo "failed_step=5" > smoke_result.txt
        echo "failed_title=Test User Registration" >> smoke_result.txt
        echo "failed_reason=Response: $REG_RESP" >> smoke_result.txt
        exit 1
    fi
    echo "Registration successful! User ID: $REG_USER_ID"
    echo "$REG_USER_ID" > test_user_id.txt

    echo "Step 6: [Staging-only] Logging in test user..."
    LOGIN_RESP=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      $CURL_TIMEOUTS \
      -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" \
      "${URL}/api/v1/auth/login" || true)
      
    TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token' 2>/dev/null | tr -d '\r' || true)
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo "Login failed! Response: $LOGIN_RESP"
        echo "failed_step=6" > smoke_result.txt
        echo "failed_title=Test User Login" >> smoke_result.txt
        echo "failed_reason=Response: $LOGIN_RESP" >> smoke_result.txt
        exit 1
    fi
    echo "Login successful! Token acquired."

    echo "Step 7: [Staging-only] Fetching profile with token..."
    PROFILE_RESP=$(curl -s -X GET \
      -H "Authorization: Bearer $TOKEN" \
      $CURL_TIMEOUTS \
      "${URL}/api/v1/auth/profile" || true)
      
    PROFILE_SUCCESS=$(echo "$PROFILE_RESP" | jq -r '.success' 2>/dev/null | tr -d '\r' || true)
    PROFILE_USERNAME=$(echo "$PROFILE_RESP" | jq -r '.user.username' 2>/dev/null | tr -d '\r' || true)
    
    if [ "$PROFILE_SUCCESS" != "true" ] || [ "$PROFILE_USERNAME" != "$TEST_USER" ]; then
        echo "Authenticated profile fetch failed! Response: $PROFILE_RESP"
        echo "failed_step=7" > smoke_result.txt
        echo "failed_title=Authenticated Profile Check" >> smoke_result.txt
        echo "failed_reason=Response: $PROFILE_RESP" >> smoke_result.txt
        exit 1
    fi
    echo "Authenticated profile check passed!"

    # Cleanup has been moved to automated trap handler.
    echo "Staging tests completed successfully."
fi

echo "status=success" > smoke_result.txt
echo "========================================================="
echo "ALL SMOKE TESTS PASSED SUCCESSFULLY!"
echo "========================================================="

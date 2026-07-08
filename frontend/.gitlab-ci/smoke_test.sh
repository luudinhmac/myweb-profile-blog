#!/bin/sh
set -e

URL=$1
ENV=$2

echo "========================================================="
echo "STARTING FRONTEND SMOKE TEST FOR ENV: $ENV ON URL: $URL"
echo "========================================================="

# 1. Homepage check (with dynamic polling)
echo "Step 1: Checking frontend homepage (waiting for readiness)..."
TIMEOUT_SECONDS=300
WAIT_INTERVAL=5
MAX_ATTEMPTS=$((TIMEOUT_SECONDS / WAIT_INTERVAL))
ATTEMPT=1
READY=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS: Fetching homepage..."
    HTTP_STATUS=$(curl -s -L -o homepage.html -w "%{http_code}" "$URL" || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        # 2. Verify homepage does not contain server/render errors
        if grep -iq "Internal Server Error" homepage.html || grep -iq "Application error: a client-side exception has occurred" homepage.html; then
            echo "Attempt $ATTEMPT/$MAX_ATTEMPTS: Homepage returned 200 but contains internal server errors or client-side exception."
        else
            echo "Homepage responded with 200 OK and content is verified (no generic crash screens detected)."
            READY=1
            break
        fi
    else
        echo "Attempt $ATTEMPT/$MAX_ATTEMPTS: Homepage failed with status: $HTTP_STATUS"
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    sleep $WAIT_INTERVAL
done

if [ $READY -ne 1 ]; then
    echo "Error: Service failed to become ready within ${TIMEOUT_SECONDS} seconds."
    exit 1
fi

echo "========================================================="
echo "ALL FRONTEND SMOKE TESTS PASSED SUCCESSFULLY!"
echo "========================================================="

#!/bin/sh
set -e

URL=$1
ENV=$2

echo "========================================================="
echo "STARTING FRONTEND SMOKE TEST FOR ENV: $ENV ON URL: $URL"
echo "========================================================="

# 1. Homepage check
echo "Step 1: Checking frontend homepage..."
HTTP_STATUS=$(curl -s -L -o homepage.html -w "%{http_code}" "$URL")
if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "Homepage failed with status: $HTTP_STATUS"
    echo "failed_step=1" > smoke_result.txt
    echo "failed_title=Homepage Check" >> smoke_result.txt
    echo "failed_reason=HTTP Status: $HTTP_STATUS" >> smoke_result.txt
    exit 1
fi
echo "Homepage responded with 200 OK!"

# 2. Verify homepage does not contain server/render errors
if grep -iq "Internal Server Error" homepage.html || grep -iq "Application error: a client-side exception has occurred" homepage.html; then
    echo "Homepage contains server error or client-side exception message!"
    echo "failed_step=2" > smoke_result.txt
    echo "failed_title=Content Verification" >> smoke_result.txt
    echo "failed_reason=Homepage contains server error or exception message" >> smoke_result.txt
    exit 1
fi
echo "Homepage content verified (no generic crash screens detected)."

echo "status=success" > smoke_result.txt
echo "========================================================="
echo "ALL FRONTEND SMOKE TESTS PASSED SUCCESSFULLY!"
echo "========================================================="

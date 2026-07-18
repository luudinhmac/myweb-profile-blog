#!/bin/sh
cd /d/DATA/Portfolio/backend/.gitlab-ci
cat > smoke_result.txt <<"EOF"
status=success
failed_step=
failed_title=
failed_reason=
EOF
export CI_PROJECT_NAME="portfolio-backend"
export CI_JOB_NAME="deploy-job"
export CI_PIPELINE_URL="https://gitlab.example.com/project/pipeline/123"
export CI_JOB_URL="https://gitlab.example.com/project/job/456"
export CI_PROJECT_ID="1"
export CI_PIPELINE_ID="123"
export CI_JOB_ID="456"
export CI_PROJECT_URL="https://gitlab.example.com/project"
export CI_COMMIT_SHORT_SHA="abc123"
export CI_COMMIT_MESSAGE="fix(ci): test payload"
export CI_OPEN_MERGE_REQUESTS="!789"
export CI_COMMIT_TAG=""
export TELEGRAM_BOT_TOKEN=""
export TELEGRAM_CHAT_ID=""
export TEAMS_WEBHOOK_URL=""
export CI_JOB_STARTED_AT="2026-07-09T10:00:00Z"
export CI_PIPELINE_CREATED_AT="2026-07-09T09:55:00Z"
export CI_JOB_TOKEN=""
export GITLAB_USER_NAME="Tester"
. ./notify.sh success post-deploy /dev/null
printf "\n=== PAYLOAD START ===\n%s\n=== PAYLOAD END ===\n" "$PAYLOAD"

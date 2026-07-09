#!/bin/sh
export TZ='ICT-7'

STATUS=$1 
TYPE=$2 
LOG_FILE=$3 

USER_NAME=${GITLAB_USER_NAME:-"Unknown"}
PROJECT_NAME=${CI_PROJECT_NAME:-"Portfolio"}
JOB_NAME=${CI_JOB_NAME:-"Job"}
PIPELINE_URL=${CI_PIPELINE_URL}
JOB_URL=${CI_JOB_URL}
COMMIT_MSG=${CI_COMMIT_MESSAGE:-"No message"}

# Calculate Job and Pipeline Durations
JOB_DURATION_TEXT="N/A"
if [ -n "$CI_JOB_STARTED_AT" ]; then
    CLEANED_DATE=$(echo "$CI_JOB_STARTED_AT" | sed 's/Z//' | sed 's/T/ /')
    START_EPOCH=$(date -u -d "$CLEANED_DATE" +%s 2>/dev/null)
    if [ -z "$START_EPOCH" ]; then
        START_EPOCH=$(TZ=UTC date -d "$CLEANED_DATE" +%s 2>/dev/null)
    fi
    if [ -n "$START_EPOCH" ]; then
        END_EPOCH=$(date +%s)
        DURATION_SECONDS=$((END_EPOCH - START_EPOCH))
        if [ $DURATION_SECONDS -ge 3600 ]; then
            JOB_DURATION_TEXT="$((DURATION_SECONDS / 3600))h $(((DURATION_SECONDS % 3600) / 60))m $((DURATION_SECONDS % 60))s"
        elif [ $DURATION_SECONDS -ge 60 ]; then
            JOB_DURATION_TEXT="$((DURATION_SECONDS / 60))m $((DURATION_SECONDS % 60))s"
        else
            JOB_DURATION_TEXT="${DURATION_SECONDS}s"
        fi
    fi
fi

PIPELINE_DURATION_TEXT="N/A"
if [ -n "$CI_PIPELINE_CREATED_AT" ]; then
    CLEANED_DATE=$(echo "$CI_PIPELINE_CREATED_AT" | sed 's/Z//' | sed 's/T/ /')
    PIPE_START_EPOCH=$(date -u -d "$CLEANED_DATE" +%s 2>/dev/null)
    if [ -z "$PIPE_START_EPOCH" ]; then
        PIPE_START_EPOCH=$(TZ=UTC date -d "$CLEANED_DATE" +%s 2>/dev/null)
    fi
    if [ -n "$PIPE_START_EPOCH" ]; then
        END_EPOCH=$(date +%s)
        DURATION_SECONDS=$((END_EPOCH - PIPE_START_EPOCH))
        if [ $DURATION_SECONDS -ge 3600 ]; then
            PIPELINE_DURATION_TEXT="$((DURATION_SECONDS / 3600))h $(((DURATION_SECONDS % 3600) / 60))m $((DURATION_SECONDS % 60))s"
        elif [ $DURATION_SECONDS -ge 60 ]; then
            PIPELINE_DURATION_TEXT="$((DURATION_SECONDS / 60))m $((DURATION_SECONDS % 60))s"
        else
            PIPELINE_DURATION_TEXT="${DURATION_SECONDS}s"
        fi
    fi
fi

# If successful, only send notification for deployment, post-deployment, or rollback stages
if [ "$STATUS" = "success" ] || [ "$STATUS" = "successful" ]; then
    if [ "$TYPE" != "deploy" ] && [ "$TYPE" != "post-deploy" ] && [ "$TYPE" != "rollback" ]; then
        echo "Job succeeded in stage '$TYPE'. Skipping notification."
        exit 0
    fi
fi

# Fetch job log if failed/canceled and no log file provided or exists
if { [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; } && ( [ -z "$LOG_FILE" ] || [ ! -f "$LOG_FILE" ] ); then
    if [ ! -z "$CI_JOB_TOKEN" ] && [ ! -z "$CI_JOB_ID" ]; then
        echo "Job failed/canceled. Fetching job log from GitLab API..."
        curl -s --header "JOB-TOKEN: ${CI_JOB_TOKEN}" "${CI_API_V4_URL:-https://gitlab.com/api/v4}/projects/${CI_PROJECT_ID}/jobs/${CI_JOB_ID}/trace" -o job.log
        LOG_FILE="job.log"
    fi
fi

# Auto-install curl if missing
if ! command -v curl >/dev/null 2>&1; then
    echo "Installing curl..."
    if command -v apk >/dev/null 2>&1; then apk add --no-cache curl >/dev/null 2>&1;
    elif command -v apt-get >/dev/null 2>&1; then apt-get update >/dev/null 2>&1 && apt-get install -y curl >/dev/null 2>&1;
    fi
fi

# Escape for JSON
ESC_COMMIT_MSG=$(echo "$COMMIT_MSG" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr -d '\n' | tr -d '\r')
ESC_USER_NAME=$(echo "$USER_NAME" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')

# Determine Environment & Badges
ENV_TEXT="staging"
ENV_BADGE="🟡 Staging"
if [ -n "$CI_COMMIT_TAG" ]; then
    ENV_TEXT="production"
    ENV_BADGE="🟢 Production"
fi

# Application URL
APP_URL=""
if [ "$PROJECT_NAME" = "portfolio-backend" ] || [ "$PROJECT_NAME" = "backend" ]; then
    if [ "$ENV_TEXT" = "production" ]; then
        APP_URL="https://api.luumac.io.vn"
    else
        APP_URL="https://api-staging.luumac.io.vn"
    fi
else
    if [ "$ENV_TEXT" = "production" ]; then
        APP_URL="https://blog.luumac.io.vn"
    else
        APP_URL="https://staging.luumac.io.vn"
    fi
fi

# Check for Rollback
IS_ROLLBACK=0
if echo "$JOB_NAME" | grep -iq "rollback" || [ "$TYPE" = "rollback" ]; then
    IS_ROLLBACK=1
fi

FAILED_VERSION="N/A"
ROLLBACK_TO="N/A"
if [ $IS_ROLLBACK -eq 1 ] && [ -f "rollback.env" ]; then
    FAILED_VERSION=$(grep "FAILED_VERSION=" rollback.env | cut -d'=' -f2)
    ROLLBACK_TO=$(grep "ROLLBACK_TO=" rollback.env | cut -d'=' -f2)
fi

# Smoke Test parsing for frontend (simple homepage check)
SMOKE_FAILED_STEP=""
SMOKE_FAILED_TITLE=""
SMOKE_FAILED_REASON=""
SMOKE_SUMMARY=""
if [ -f "smoke_result.txt" ]; then
    SMOKE_STATUS=$(grep "status=" smoke_result.txt | cut -d'=' -f2)
    if [ "$SMOKE_STATUS" != "success" ]; then
        SMOKE_FAILED_STEP=$(grep "failed_step=" smoke_result.txt | cut -d'=' -f2)
        SMOKE_FAILED_TITLE=$(grep "failed_title=" smoke_result.txt | cut -d'=' -f2)
        SMOKE_FAILED_REASON=$(grep "failed_reason=" smoke_result.txt | cut -d'=' -f2)
    fi
fi

if [ -n "$SMOKE_FAILED_STEP" ]; then
    SMOKE_SUMMARY="• Step 1 (Homepage): ❌"
    SMOKE_SUMMARY_TEAMS="• Step 1 (Homepage): ❌"
elif [ "$STATUS" = "success" ] && [ "$TYPE" = "post-deploy" ]; then
    SMOKE_SUMMARY="• Step 1 (Homepage): ✅"
    SMOKE_SUMMARY_TEAMS="• Step 1 (Homepage): ✅"
fi

IMAGE_TAG="dev-${CI_COMMIT_SHORT_SHA}"
if [ -n "$CI_COMMIT_TAG" ]; then
    IMAGE_TAG="${CI_COMMIT_TAG}"
fi

# Completed time
COMPLETED_AT=$(date "+%Y-%m-%d %H:%M:%S ICT")

# Parse Merge Request ID
MR_IID=""
if [ -n "$CI_MERGE_REQUEST_IID" ]; then
    MR_IID=$CI_MERGE_REQUEST_IID
elif [ -n "$CI_OPEN_MERGE_REQUESTS" ]; then
    MR_IID=$(echo "$CI_OPEN_MERGE_REQUESTS" | cut -d'!' -f2 | cut -d',' -f1)
fi

# Build Message Headers & Icons
if [ "$STATUS" = "success" ] || [ "$STATUS" = "successful" ]; then
    if [ $IS_ROLLBACK -eq 1 ]; then
        ICON="⚠️"
        TITLE="AUTO ROLLBACK COMPLETED"
        TEAMS_COLOR="E67E22"
    else
        ICON="🟢"
        TITLE="DEPLOYMENT SUCCESS"
        TEAMS_COLOR="2ECC71"
    fi
else
    ICON="❌"
    if [ $IS_ROLLBACK -eq 1 ]; then
        TITLE="AUTO ROLLBACK FAILED"
    else
        TITLE="DEPLOYMENT FAILED"
    fi
    TEAMS_COLOR="E74C3C"
fi

# Telegram Notification
TELEGRAM_MSG="<b>${ICON} ${TITLE}</b>%0A%0A"
TELEGRAM_MSG="${TELEGRAM_MSG}📦 <b>Dự án:</b> ${PROJECT_NAME}%0A"
TELEGRAM_MSG="${TELEGRAM_MSG}🌍 <b>Môi trường:</b> ${ENV_BADGE}%0A"

if [ $IS_ROLLBACK -eq 1 ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}🔴 <b>Failed Version:</b> <code>${FAILED_VERSION}</code>%0A"
    TELEGRAM_MSG="${TELEGRAM_MSG}🔄 <b>Rollback To:</b> <code>${ROLLBACK_TO}</code>%0A"
    TELEGRAM_MSG="${TELEGRAM_MSG}⏱ <b>Thời gian Rollback:</b> ${JOB_DURATION_TEXT}%0A%0A"
else
    TELEGRAM_MSG="${TELEGRAM_MSG}🔖 <b>Version:</b> <code>${IMAGE_TAG}</code>%0A"
    TELEGRAM_MSG="${TELEGRAM_MSG}📝 <b>Commit:</b> ${ESC_COMMIT_MSG}%0A"
    TELEGRAM_MSG="${TELEGRAM_MSG}⏱ <b>Thời gian Pipeline:</b> ${PIPELINE_DURATION_TEXT}%0A"
    TELEGRAM_MSG="${TELEGRAM_MSG}⚡ <b>Thời gian Job:</b> ${JOB_DURATION_TEXT}%0A"
    if [ "$STATUS" = "success" ]; then
        TELEGRAM_MSG="${TELEGRAM_MSG}💻 <b>Application:</b> <a href='${APP_URL}'>${APP_URL}</a>%0A"
    fi
    TELEGRAM_MSG="${TELEGRAM_MSG}%0A"
fi

if [ -n "$SMOKE_FAILED_STEP" ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}🚫 <b>Failed Step:</b> Step ${SMOKE_FAILED_STEP} - ${SMOKE_FAILED_TITLE}%0A"
    TELEGRAM_MSG="${TELEGRAM_MSG}⚠️ <b>Reason:</b> <code>${SMOKE_FAILED_REASON}</code>%0A%0A"
fi

if [ -n "$SMOKE_SUMMARY" ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}📊 <b>Smoke Test Summary:</b>%0A${SMOKE_SUMMARY}%0A%0A"
fi

TELEGRAM_MSG="${TELEGRAM_MSG}👤 <b>Người thực hiện:</b> ${ESC_USER_NAME}%0A"
TELEGRAM_MSG="${TELEGRAM_MSG}🕒 <b>Hoàn thành lúc:</b> ${COMPLETED_AT}%0A%0A"

if [ -n "$MR_IID" ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}🔗 <b>Merge Request:</b> <a href='${CI_PROJECT_URL}/-/merge_requests/${MR_IID}'>!${MR_IID}</a>%0A"
fi
TELEGRAM_MSG="${TELEGRAM_MSG}🔗 <b>Pipeline:</b> <a href='${PIPELINE_URL}'>#${CI_PIPELINE_ID}</a>%0A"
TELEGRAM_MSG="${TELEGRAM_MSG}🔗 <b>View Job:</b> <a href='${JOB_URL}'>#${CI_JOB_ID}</a>"

if { [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; } && [ -f "$LOG_FILE" ] && [ -z "$SMOKE_FAILED_STEP" ]; then
    LOG_TAIL=$(tail -n 15 "$LOG_FILE" | sed "s/$(printf '\033')\[[0-9;]*[a-zA-Z]//g" | sed 's/<[^>]*>//g' | sed 's/&/\&amp;/g' | sed 's/</\&lt;/g' | sed 's/>/\&gt;/g')
    TELEGRAM_MSG="${TELEGRAM_MSG}%0A%0A📑 <b>Log lỗi:</b>%0A<code>${LOG_TAIL}</code>"
fi

if [ -f "trivy_summary.txt" ]; then
    TRIVY_CONTENT=$(cat trivy_summary.txt)
    ESC_TRIVY_CONTENT=$(echo "$TRIVY_CONTENT" | sed 's/$/%0A/' | tr -d '\n' | tr -d '\r')
    TELEGRAM_MSG="${TELEGRAM_MSG}%0A%0A${ESC_TRIVY_CONTENT}"
fi

if [ ! -z "$TELEGRAM_BOT_TOKEN" ] && [ ! -z "$TELEGRAM_CHAT_ID" ]; then
    echo "Sending to Telegram..."
    curl -i -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "parse_mode=HTML" \
        -d "text=${TELEGRAM_MSG}"
    echo ""
fi

# MS Teams Notification
if [ ! -z "$TEAMS_WEBHOOK_URL" ]; then
    echo "Sending to MS Teams (Adaptive Card)..."
    
    LOG_CONTENT=""
    if { [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; } && [ -f "$LOG_FILE" ] && [ -z "$SMOKE_FAILED_STEP" ]; then
        LOG_TAIL=$(tail -n 15 "$LOG_FILE" | sed "s/$(printf '\033')\[[0-9;]*[a-zA-Z]//g" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr -d '\n' | tr -d '\r')
        LOG_CONTENT="**Log lỗi:**\n\n${LOG_TAIL}"
    fi

    TRIVY_TEAMS_CONTENT=""
    if [ -f "trivy_summary.txt" ]; then
        TRIVY_TEAMS_CONTENT=$(cat trivy_summary.txt | sed 's/<b>/**/g' | sed 's/<\/b>/**/g' | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/$/\\n/' | tr -d '\n' | tr -d '\r')
    fi

    FACTS="{\"title\": \"Dự án:\", \"value\": \"${PROJECT_NAME}\"}, {\"title\": \"Môi trường:\", \"value\": \"${ENV_BADGE}\"}"
    if [ $IS_ROLLBACK -eq 1 ]; then
        FACTS="${FACTS}, {\"title\": \"Failed Version:\", \"value\": \"${FAILED_VERSION}\"}"
        FACTS="${FACTS}, {\"title\": \"Rollback To:\", \"value\": \"${ROLLBACK_TO}\"}"
        FACTS="${FACTS}, {\"title\": \"Thời gian Rollback:\", \"value\": \"${JOB_DURATION_TEXT}\"}"
    else
        FACTS="${FACTS}, {\"title\": \"Version:\", \"value\": \"${IMAGE_TAG}\"}"
        FACTS="${FACTS}, {\"title\": \"Commit:\", \"value\": \"${ESC_COMMIT_MSG}\"}"
        FACTS="${FACTS}, {\"title\": \"Thời gian Pipeline:\", \"value\": \"${PIPELINE_DURATION_TEXT}\"}"
        FACTS="${FACTS}, {\"title\": \"Thời gian Job:\", \"value\": \"${JOB_DURATION_TEXT}\"}"
        if [ "$STATUS" = "success" ]; then
            FACTS="${FACTS}, {\"title\": \"Application:\", \"value\": \"[${APP_URL}](${APP_URL})\"}"
        fi
    fi
    FACTS="${FACTS}, {\"title\": \"Người thực hiện:\", \"value\": \"${ESC_USER_NAME}\"}"
    FACTS="${FACTS}, {\"title\": \"Hoàn thành lúc:\", \"value\": \"${COMPLETED_AT}\"}"
    
    if [ -n "$MR_IID" ]; then
        FACTS="${FACTS}, {\"title\": \"Merge Request:\", \"value\": \"[!${MR_IID}](${CI_PROJECT_URL}/-/merge_requests/${MR_IID})\"}"
    fi

    SMOKE_TEXT_BLOCK=""
    if [ -n "$SMOKE_FAILED_STEP" ]; then
        SMOKE_TEXT_BLOCK=", {\"type\": \"TextBlock\", \"text\": \"**Failed Step:** Step ${SMOKE_FAILED_STEP} - ${SMOKE_FAILED_TITLE}\\n**Reason:** ${SMOKE_FAILED_REASON}\", \"color\": \"Attention\", \"wrap\": true}"
    fi
    
    if [ -n "$SMOKE_SUMMARY_TEAMS" ]; then
        ESC_SMOKE_SUMMARY=$(echo "$SMOKE_SUMMARY_TEAMS" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')
        SMOKE_TEXT_BLOCK="${SMOKE_TEXT_BLOCK}, {\"type\": \"TextBlock\", \"text\": \"**Smoke Test Summary:**\\n${ESC_SMOKE_SUMMARY}\", \"wrap\": true}"
    fi

    ACTIONS="{\"type\": \"Action.OpenUrl\", \"title\": \"Xem Pipeline\", \"url\": \"${PIPELINE_URL}\"}, {\"type\": \"Action.OpenUrl\", \"title\": \"Xem Job\", \"url\": \"${JOB_URL}\"}"
    if [ "$STATUS" = "success" ] && [ $IS_ROLLBACK -ne 1 ]; then
        ACTIONS="{\"type\": \"Action.OpenUrl\", \"title\": \"Mở App\", \"url\": \"${APP_URL}\"}, ${ACTIONS}"
    fi

    PAYLOAD=$(cat <<EOF
{
    "type": "message",
    "attachments": [
        {
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "type": "AdaptiveCard",
                "body": [
                    {
                        "type": "TextBlock",
                        "size": "Medium",
                        "weight": "Bolder",
                        "text": "${ICON} ${TITLE}"
                    },
                    {
                        "type": "TextBlock",
                        "text": "${TRIVY_TEAMS_CONTENT}",
                        "wrap": true
                    },
                    {
                        "type": "FactSet",
                        "facts": [ ${FACTS} ]
                    }
                    ${SMOKE_TEXT_BLOCK},
                    {
                        "type": "TextBlock",
                        "text": "${LOG_CONTENT}",
                        "wrap": true,
                        "fontType": "Monospace",
                        "size": "Small"
                    }
                ],
                "actions": [ ${ACTIONS} ],
                "\$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "version": "1.2"
            }
        }
    ]
}
EOF
)

    curl -i -H "Content-Type: application/json" -d "$PAYLOAD" "$TEAMS_WEBHOOK_URL"
    echo ""
fi

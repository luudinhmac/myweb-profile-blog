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

# Auto-install curl if missing
if ! command -v curl >/dev/null 2>&1; then
    echo "Installing curl..."
    if command -v apk >/dev/null 2>&1; then apk add --no-cache curl >/dev/null 2>&1;
    elif command -v apt-get >/dev/null 2>&1; then apt-get update >/dev/null 2>&1 && apt-get install -y curl >/dev/null 2>&1;
    fi
fi

# Fetch job log if failed/canceled and no log file provided or exists
if { [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; } && ( [ -z "$LOG_FILE" ] || [ ! -f "$LOG_FILE" ] ); then
    if [ ! -z "$CI_JOB_TOKEN" ] && [ ! -z "$CI_JOB_ID" ]; then
        echo "Job failed/canceled. Fetching job log from GitLab API..."
        HTTP_CODE=$(curl -s -o job.log -w "%{http_code}" --header "JOB-TOKEN: ${CI_JOB_TOKEN}" "${CI_API_V4_URL:-https://gitlab.com/api/v4}/projects/${CI_PROJECT_ID}/jobs/${CI_JOB_ID}/trace" || echo "000")
        if [ "$HTTP_CODE" -eq 200 ] && [ -f job.log ] && ! grep -q "{\"message\":" job.log; then
            LOG_FILE="job.log"
        else
            echo "GitLab API returned status $HTTP_CODE or unauthorized JSON payload. Discarding fake job log."
            rm -f job.log
            LOG_FILE=""
        fi
    fi
fi

# Debugging
echo "--- Notification Debug ---"
echo "Project: $PROJECT_NAME, Job: $JOB_NAME, Status: $STATUS"
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then echo "⚠️ TELEGRAM_BOT_TOKEN is missing"; else echo "✅ TELEGRAM_BOT_TOKEN is set"; fi
if [ -z "$TELEGRAM_CHAT_ID" ]; then echo "⚠️ TELEGRAM_CHAT_ID is missing"; else echo "✅ TELEGRAM_CHAT_ID is set"; fi
if [ -z "$TEAMS_WEBHOOK_URL" ]; then echo "⚠️ TEAMS_WEBHOOK_URL is missing"; else echo "✅ TEAMS_WEBHOOK_URL is set"; fi
echo "--------------------------"

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

# Stage label (helps distinguish which job/stage this notification is about)
case "$TYPE" in
    deploy) STAGE_LABEL="🚀 Deploy" ;;
    post-deploy) STAGE_LABEL="🧪 Smoke Test" ;;
    rollback) STAGE_LABEL="🔄 Rollback" ;;
    *) STAGE_LABEL="$TYPE" ;;
esac

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

# Smoke Test parsing
SMOKE_FAILED_STEP=""
SMOKE_FAILED_TITLE=""
SMOKE_FAILED_REASON=""
SMOKE_SUMMARY=""
SMOKE_SUMMARY_TEAMS=""
if [ -f "smoke_result.txt" ]; then
    SMOKE_STATUS=$(grep "status=" smoke_result.txt | cut -d'=' -f2)
    if [ "$SMOKE_STATUS" != "success" ]; then
        SMOKE_FAILED_STEP=$(grep "failed_step=" smoke_result.txt | cut -d'=' -f2)
        SMOKE_FAILED_TITLE=$(grep "failed_title=" smoke_result.txt | cut -d'=' -f2)
        SMOKE_FAILED_REASON=$(grep "failed_reason=" smoke_result.txt | cut -d'=' -f2)
    fi
fi

# Detect project type
IS_FRONTEND=0
if echo "$PROJECT_NAME" | grep -iq "frontend"; then
    IS_FRONTEND=1
fi

if [ $IS_FRONTEND -eq 1 ]; then
    if [ -n "$SMOKE_FAILED_STEP" ]; then
        S1="✅"; S2="✅"
        if [ "$SMOKE_FAILED_STEP" -eq 1 ]; then S1="❌"; S2="➖"; fi
        if [ "$SMOKE_FAILED_STEP" -eq 2 ]; then S2="❌"; fi
        
        SMOKE_SUMMARY="• Step 1 (Homepage Check): ${S1}%0A• Step 2 (Content Verification): ${S2}"
        SMOKE_SUMMARY_TEAMS=$(printf "• Step 1 (Homepage Check): %s\n• Step 2 (Content Verification): %s" "$S1" "$S2")
    elif [ "$STATUS" = "success" ] && [ "$TYPE" = "post-deploy" ]; then
        SMOKE_SUMMARY="• Step 1 (Homepage Check): ✅%0A• Step 2 (Content Verification): ✅"
        SMOKE_SUMMARY_TEAMS=$(printf "• Step 1 (Homepage Check): ✅\n• Step 2 (Content Verification): ✅")
    fi
else
    if [ -n "$SMOKE_FAILED_STEP" ]; then
        S1="✅"; S2="✅"; S3="✅"; S4="✅"; S5="✅"; S6="✅"; S7="✅"
        if [ "$SMOKE_FAILED_STEP" -eq 1 ]; then S1="❌"; S2="➖"; S3="➖"; S4="➖"; S5="➖"; S6="➖"; S7="➖"; fi
        if [ "$SMOKE_FAILED_STEP" -eq 2 ]; then S2="❌"; S3="➖"; S4="➖"; S5="➖"; S6="➖"; S7="➖"; fi
        if [ "$SMOKE_FAILED_STEP" -eq 3 ]; then S3="❌"; S4="➖"; S5="➖"; S6="➖"; S7="➖"; fi
        if [ "$SMOKE_FAILED_STEP" -eq 4 ]; then S4="❌"; S5="➖"; S6="➖"; S7="➖"; fi
        if [ "$SMOKE_FAILED_STEP" -eq 5 ]; then S5="❌"; S6="➖"; S7="➖"; fi
        if [ "$SMOKE_FAILED_STEP" -eq 6 ]; then S6="❌"; S7="➖"; fi
        if [ "$SMOKE_FAILED_STEP" -eq 7 ]; then S7="❌"; fi
        
        SMOKE_SUMMARY="• Step 1 (Health Check): ${S1}%0A• Step 2 (Categories Check): ${S2}%0A• Step 3 (Posts Check): ${S3}%0A• Step 4 (Auth Restriction): ${S4}%0A• Step 5 (Register Check): ${S5}%0A• Step 6 (Login Check): ${S6}%0A• Step 7 (Profile Check): ${S7}"
        SMOKE_SUMMARY_TEAMS=$(printf "• Step 1 (Health Check): %s\n• Step 2 (Categories Check): %s\n• Step 3 (Posts Check): %s\n• Step 4 (Auth Restriction): %s\n• Step 5 (Register Check): %s\n• Step 6 (Login Check): %s\n• Step 7 (Profile Check): %s" "$S1" "$S2" "$S3" "$S4" "$S5" "$S6" "$S7")
    elif [ "$STATUS" = "success" ] && [ "$TYPE" = "post-deploy" ]; then
        SMOKE_SUMMARY="• Step 1 (Health Check): ✅%0A• Step 2 (Categories Check): ✅%0A• Step 3 (Posts Check): ✅%0A• Step 4 (Auth Restriction): ✅%0A• Step 5 (Register Check): ✅%0A• Step 6 (Login Check): ✅%0A• Step 7 (Profile Check): ✅"
        SMOKE_SUMMARY_TEAMS=$(printf "• Step 1 (Health Check): ✅\n• Step 2 (Categories Check): ✅\n• Step 3 (Posts Check): ✅\n• Step 4 (Auth Restriction): ✅\n• Step 5 (Register Check): ✅\n• Step 6 (Login Check): ✅\n• Step 7 (Profile Check): ✅")
    fi
fi

# Define App URLs for successful Deployment / Post-Deployment stages
APP_URL=""
if [ "$STATUS" = "success" ] || [ "$STATUS" = "successful" ]; then
    if [ "$PROJECT_NAME" = "portfolio-frontend" ]; then
        if [ "$ENV_TEXT" = "production" ]; then
            APP_URL="https://luumac.io.vn"
        else
            APP_URL="https://staging.luumac.io.vn"
        fi
    elif [ "$PROJECT_NAME" = "portfolio-backend" ]; then
        if [ "$ENV_TEXT" = "production" ]; then
            APP_URL="https://api.luumac.io.vn"
        else
            APP_URL="https://staging-api.luumac.io.vn"
        fi
    fi
fi

# Completed time
COMPLETED_AT=$(date "+%Y-%m-%d %H:%M:%S")

# Parse Merge Request ID
MR_IID=""
if [ -n "$CI_MERGE_REQUEST_IID" ]; then
    MR_IID=$CI_MERGE_REQUEST_IID
elif [ -n "$CI_OPEN_MERGE_REQUESTS" ]; then
    MR_IID=$(echo "$CI_OPEN_MERGE_REQUESTS" | cut -d'!' -f2 | cut -d',' -f1)
fi

# Branch or Tag info
BRANCH_OR_VERSION_TITLE="Branch"
BRANCH_OR_VERSION_VALUE="${CI_COMMIT_BRANCH}"
if [ -n "$CI_COMMIT_TAG" ]; then
    BRANCH_OR_VERSION_TITLE="Version"
    BRANCH_OR_VERSION_VALUE="${CI_COMMIT_TAG}"
fi

TEAMS_MR_FACT=""
if [ -n "$MR_IID" ]; then
    TEAMS_MR_FACT=", { \"title\": \"Merge Request:\", \"value\": \"[!${MR_IID}](${CI_PROJECT_URL}/-/merge_requests/${MR_IID})\" }"
fi

# Build Message Headers & Icons
if [ "$STATUS" = "success" ] || [ "$STATUS" = "successful" ]; then
    if [ $IS_ROLLBACK -eq 1 ]; then
        ICON="⚠️"
        TITLE="AUTO ROLLBACK COMPLETED"
        TEAMS_COLOR="E67E22" # Orange
    elif [ "$TYPE" = "post-deploy" ]; then
        ICON="🟢"
        TITLE="SMOKE TEST PASSED"
        TEAMS_COLOR="2ECC71" # Green
    elif [ "$TYPE" = "deploy" ]; then
        ICON="🟢"
        TITLE="DEPLOYMENT SUCCESSFUL"
        TEAMS_COLOR="2ECC71" # Green
    else
        ICON="🟢"
        TITLE="CI/CD PIPELINE SUCCESSFUL"
        TEAMS_COLOR="2ECC71" # Green
    fi
else
    ICON="❌"
    if [ $IS_ROLLBACK -eq 1 ]; then
        TITLE="AUTO ROLLBACK FAILED"
        TEAMS_COLOR="E74C3C" # Red
    elif [ "$TYPE" = "post-deploy" ]; then
        TITLE="SMOKE TEST FAILED"
        TEAMS_COLOR="E74C3C" # Red
    elif [ "$TYPE" = "deploy" ]; then
        TITLE="DEPLOYMENT FAILED"
        TEAMS_COLOR="E74C3C" # Red
    else
        TITLE="CI/CD PIPELINE FAILED"
        TEAMS_COLOR="E74C3C" # Red
    fi
fi
STATUS_TEXT="CANCELED"
if [ "$STATUS" = "failed" ]; then
    STATUS_TEXT="FAILED"
elif [ "$STATUS" = "success" ] || [ "$STATUS" = "successful" ]; then
    STATUS_TEXT="SUCCESSFUL"
fi

# 1. Check and parse Gitleaks JSON report if it exists (using Node.js)
if [ -f "gitleaks-report.json" ]; then
    node -e '
        const fs = require("fs");
        const path = require("path");
        if (fs.existsSync("gitleaks-report.json")) {
            try {
                const data = JSON.parse(fs.readFileSync("gitleaks-report.json", "utf8"));
                if (Array.isArray(data) && data.length > 0) {
                    const projectUrl = process.env.CI_PROJECT_URL || "";
                    const commitSha = process.env.CI_COMMIT_SHA || "";

                    function findCurrentPath(oldPath) {
                        if (fs.existsSync(oldPath)) return oldPath;
                        const basename = path.basename(oldPath);
                        function searchDir(dir) {
                            const entries = fs.readdirSync(dir, { withFileTypes: true });
                            for (const entry of entries) {
                                const fullPath = path.join(dir, entry.name);
                                if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".pnpm-store" || entry.name === ".trivycache") {
                                    continue;
                                }
                                if (entry.isDirectory()) {
                                    const found = searchDir(fullPath);
                                    if (found) return found;
                                } else if (entry.isFile() && entry.name === basename) {
                                    return fullPath.replace(/\\/g, "/");
                                }
                            }
                            return null;
                        }
                        const foundPath = searchDir(".");
                        return foundPath ? foundPath.replace(/^\.\//, "") : oldPath;
                    }

                    // Generate Telegram content (No raw secrets!)
                    let tg = "<b>Reason:</b> Secret detected in repository\n\n<b>Findings:</b>\n• " + data.length + " secret" + (data.length > 1 ? "s" : "") + " found\n";
                    const details = data.slice(0, 3);
                    details.forEach((leak) => {
                        const currentPath = findCurrentPath(leak.File);
                        const fileExists = fs.existsSync(currentPath);
                        const targetCommit = fileExists ? commitSha : (leak.Commit || commitSha);
                        const targetPath = fileExists ? currentPath : leak.File;

                        const fileLink = projectUrl && targetCommit 
                            ? projectUrl + "/-/blob/" + targetCommit + "/" + targetPath + "#L" + leak.StartLine 
                            : "";
                        const commitLink = projectUrl && (leak.Commit || commitSha)
                            ? "<a href=\"" + projectUrl + "/-/commit/" + (leak.Commit || commitSha) + "\">" + (leak.Commit || commitSha).slice(0, 8) + "</a>"
                            : "<code>" + (leak.Commit || commitSha).slice(0, 8) + "</code>";
                        const fileStr = fileLink 
                            ? "<a href=\"" + fileLink + "\">" + targetPath + "</a>" 
                            : "<code>" + targetPath + "</code>";
                        tg += "• File: " + fileStr + "\n  Rule: " + leak.Description + "\n  Line: " + leak.StartLine + "\n  Commit: " + commitLink + "\n\n";
                    });
                    if (data.length > 3) {
                        tg += "• <i>... and " + (data.length - 3) + " more leaks</i>\n";
                    }
                    fs.writeFileSync("gitleaks_telegram.txt", tg);

                    // Generate Teams content (No raw secrets!)
                    const teamsItems = [
                        {
                            "type": "TextBlock",
                            "text": "🚨 **SECURITY FAILURE: Secret Detected**",
                            "weight": "Bolder",
                            "color": "Attention",
                            "spacing": "Medium"
                        },
                        {
                            "type": "TextBlock",
                            "text": "**Reason:** Secret detected in repository",
                            "wrap": true
                        },
                        {
                            "type": "TextBlock",
                            "text": "**Findings:**\n• " + data.length + " secret" + (data.length > 1 ? "s" : "") + " found",
                            "wrap": true
                        }
                    ];
                    details.forEach(leak => {
                        const currentPath = findCurrentPath(leak.File);
                        const fileExists = fs.existsSync(currentPath);
                        const targetCommit = fileExists ? commitSha : (leak.Commit || commitSha);
                        const targetPath = fileExists ? currentPath : leak.File;

                        const fileLink = projectUrl && targetCommit 
                            ? projectUrl + "/-/blob/" + targetCommit + "/" + targetPath + "#L" + leak.StartLine 
                            : "";
                        const commitValue = projectUrl && (leak.Commit || commitSha)
                            ? "[" + (leak.Commit || commitSha).slice(0, 8) + "](" + projectUrl + "/-/commit/" + (leak.Commit || commitSha) + ")"
                            : (leak.Commit || commitSha).slice(0, 8);
                        const fileValue = fileLink 
                            ? "[" + targetPath + "](" + fileLink + ")" 
                            : targetPath;
                        teamsItems.push({
                            "type": "FactSet",
                            "facts": [
                                { "title": "• File:", "value": fileValue },
                                { "title": "• Rule:", "value": leak.Description },
                                { "title": "• Line:", "value": String(leak.StartLine) },
                                { "title": "• Commit:", "value": commitValue }
                            ],
                            "spacing": "Small"
                        });
                    });
                    if (data.length > 3) {
                        teamsItems.push({
                            "type": "TextBlock",
                            "text": "*... and " + (data.length - 3) + " more leaks*",
                            "isSubtle": true,
                            "size": "Small"
                        });
                    }
                    fs.writeFileSync("gitleaks_teams.json", JSON.stringify(teamsItems));
                }
            } catch (e) {
                console.error("Error parsing Gitleaks:", e);
            }
        }
    '
fi

# 2. Next Steps / Actionable Recommendations based on Job
RECOMMENDATION=""
TEAMS_RECOMMENDATION=""
if [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; then
    case "$JOB_NAME" in
        "gitleaks_scan")
            RECOMMENDATION="👉 <b>Next Steps:</b> Revoke and rotate the exposed secrets immediately, then remove them from Git history before pushing again."
            TEAMS_RECOMMENDATION="**Next Steps:**\n\nRevoke and rotate the exposed secrets immediately, then remove them from Git history before pushing again."
            ;;
        "lint")
            RECOMMENDATION="👉 <b>Next Steps:</b> Run <code>pnpm run lint</code> locally to fix code formatting and linting rules."
            TEAMS_RECOMMENDATION="**Next Steps:**\n\nRun `pnpm run lint` locally to fix code formatting and linting rules."
            ;;
        "typecheck")
            RECOMMENDATION="👉 <b>Next Steps:</b> Run <code>pnpm exec tsc --noEmit</code> locally to check and resolve TypeScript compilation errors."
            TEAMS_RECOMMENDATION="**Next Steps:**\n\nRun `pnpm exec tsc --noEmit` locally to check and resolve TypeScript compilation errors."
            ;;
        "unit_test")
            RECOMMENDATION="👉 <b>Next Steps:</b> Run <code>pnpm test</code> locally to identify and fix failing unit tests."
            TEAMS_RECOMMENDATION="**Next Steps:**\n\nRun `pnpm test` locally to identify and fix failing unit tests."
            ;;
        "build_test")
            RECOMMENDATION="👉 <b>Next Steps:</b> Run <code>pnpm run build</code> locally to check for build compilation errors."
            TEAMS_RECOMMENDATION="**Next Steps:**\n\nRun `pnpm run build` locally to check for build compilation errors."
            ;;
        *)
            RECOMMENDATION="👉 <b>Next Steps:</b> View the detailed job log in GitLab to debug the failure."
            TEAMS_RECOMMENDATION="**Next Steps:**\n\nView the detailed job log in GitLab to debug the failure."
            ;;
    esac
fi

# Telegram Notification
TELEGRAM_MSG="<b>${ICON} ${TITLE}</b>

📦 <b>Project:</b> ${PROJECT_NAME}
🏷 <b>Stage:</b> ${STAGE_LABEL}
🌍 <b>Environment:</b> ${ENV_BADGE}
"

if [ $IS_ROLLBACK -eq 1 ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}🔴 <b>Failed Version:</b> <code>${FAILED_VERSION}</code>
🔄 <b>Rollback To:</b> <code>${ROLLBACK_TO}</code>
⏱ <b>Rollback Duration:</b> ${JOB_DURATION_TEXT}
"
else
    if [ -n "$CI_COMMIT_TAG" ]; then
        TELEGRAM_MSG="${TELEGRAM_MSG}🔖 <b>Version:</b> <code>${CI_COMMIT_TAG}</code>
"
    else
        TELEGRAM_MSG="${TELEGRAM_MSG}🌿 <b>Branch:</b> <code>${CI_COMMIT_BRANCH}</code>
"
    fi
    TELEGRAM_MSG="${TELEGRAM_MSG}🔗 <b>Commit SHA:</b> <code>${CI_COMMIT_SHORT_SHA}</code>
📝 <b>Commit:</b> ${ESC_COMMIT_MSG}
⏱ <b>Pipeline Duration:</b> ${PIPELINE_DURATION_TEXT}
⚡ <b>Job Duration:</b> ${JOB_DURATION_TEXT}
"
fi

if [ -n "$MR_IID" ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}🔗 <b>Merge Request:</b> <a href='${CI_PROJECT_URL}/-/merge_requests/${MR_IID}'>!${MR_IID}</a>
"
fi

TELEGRAM_MSG="${TELEGRAM_MSG}🔗 <b>Pipeline:</b> <a href='${PIPELINE_URL}'>#${CI_PIPELINE_ID}</a>"

if [ -n "$SMOKE_FAILED_STEP" ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}

🚫 <b>Failed Step:</b> Step ${SMOKE_FAILED_STEP} - ${SMOKE_FAILED_TITLE}
⚠️ <b>Reason:</b> <code>${SMOKE_FAILED_REASON}</code>"
fi

if [ -n "$SMOKE_SUMMARY" ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}

📊 <b>Smoke Test Summary:</b>
${SMOKE_SUMMARY}"
fi

if { [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; } && [ -f "$LOG_FILE" ]; then
    if [ ! -f "gitleaks-report.json" ]; then
        LOG_TAIL=$(tail -n 15 "$LOG_FILE" | sed "s/$(printf '\033')\[[0-9;]*[a-zA-Z]//g" | sed 's/<[^>]*>//g' | sed 's/&/\&amp;/g' | sed 's/</\&lt;/g' | sed 's/>/\&gt;/g')
        TELEGRAM_MSG="${TELEGRAM_MSG}

📑 <b>Error Log:</b>
<code>${LOG_TAIL}</code>"
    fi
fi

if [ -f "trivy_summary_telegram.txt" ]; then
    TRIVY_TELEGRAM_CONTENT=$(cat trivy_summary_telegram.txt)
    if [ -f "trivy-report.html" ] && [ -n "$CI_JOB_URL" ]; then
        REPORT_URL="${CI_JOB_URL}/artifacts/file/trivy-report.html"
        TRIVY_TELEGRAM_CONTENT="${TRIVY_TELEGRAM_CONTENT}

📊 <a href='${REPORT_URL}'><b>View Detailed Report</b></a>"
    fi
    TELEGRAM_MSG="${TELEGRAM_MSG}

${TRIVY_TELEGRAM_CONTENT}"
elif [ -f "gitleaks_telegram.txt" ]; then
    GITLEAKS_TELEGRAM_CONTENT=$(cat gitleaks_telegram.txt)
    TELEGRAM_MSG="${TELEGRAM_MSG}

${GITLEAKS_TELEGRAM_CONTENT}"
fi

if [ -n "$APP_URL" ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}

🚀 <a href='${APP_URL}'><b>Open Application</b></a>"
fi

TELEGRAM_MSG="${TELEGRAM_MSG}

👤 <b>Triggered by:</b> ${ESC_USER_NAME}
🕒 <b>Completed at:</b> ${COMPLETED_AT}"

if [ -n "$RECOMMENDATION" ]; then
    TELEGRAM_MSG="${TELEGRAM_MSG}

${RECOMMENDATION}"
fi

if [ ! -z "$TELEGRAM_BOT_TOKEN" ] && [ ! -z "$TELEGRAM_CHAT_ID" ]; then
    echo "Sending to Telegram..."
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "parse_mode=HTML" \
        --data-urlencode "text=${TELEGRAM_MSG}" > /dev/null
    echo ""
fi

# MS Teams Notification
if [ ! -z "$TEAMS_WEBHOOK_URL" ]; then
    echo "Sending to MS Teams (Adaptive Card)..."
    
    LOG_CONTENT=""
    if { [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; } && [ -f "$LOG_FILE" ]; then
        if [ ! -f "gitleaks-report.json" ]; then
            LOG_TAIL=$(tail -n 15 "$LOG_FILE" | sed "s/$(printf '\033')\[[0-9;]*[a-zA-Z]//g" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr -d '\n' | tr -d '\r')
            LOG_CONTENT="**Error Log:**\n\n${LOG_TAIL}"
        fi
    fi

    TRIVY_TEAMS_BLOCK=""
    if [ -f "trivy_teams_block.json" ]; then
        # Read the JSON array, strip outer brackets [ and ], and append trailing comma for flat body injection
        TRIVY_TEAMS_BLOCK="$(cat trivy_teams_block.json | sed '1s/^\[//' | sed '$s/]$//'),"
    elif [ -f "gitleaks_teams.json" ]; then
        # Read Gitleaks array block
        TRIVY_TEAMS_BLOCK="$(cat gitleaks_teams.json | sed '1s/^\[//' | sed '$s/]$//'),"
    fi

    TRIVY_TEAMS_ACTION=""
    if [ -f "trivy-report.html" ] && [ -n "$CI_JOB_URL" ]; then
        REPORT_URL="${CI_JOB_URL}/artifacts/file/trivy-report.html"
        TRIVY_TEAMS_ACTION=", { \"type\": \"Action.OpenUrl\", \"title\": \"View Report\", \"url\": \"${REPORT_URL}\" }"
    fi

    APP_TEAMS_ACTION=""
    if [ -n "$APP_URL" ]; then
        APP_TEAMS_ACTION=", { \"type\": \"Action.OpenUrl\", \"title\": \"Open App\", \"url\": \"${APP_URL}\" }"
    fi

    LOG_BLOCK=""
    if [ -n "$LOG_CONTENT" ]; then
        LOG_BLOCK=", { \"type\": \"TextBlock\", \"text\": \"${LOG_CONTENT}\", \"wrap\": true, \"fontType\": \"Monospace\", \"size\": \"Small\" }"
    fi

    TEAMS_REC_BLOCK=""
    if [ -n "$TEAMS_RECOMMENDATION" ]; then
        TEAMS_REC_BLOCK=", { \"type\": \"TextBlock\", \"text\": \"${TEAMS_RECOMMENDATION}\", \"wrap\": true, \"spacing\": \"Medium\" }"
    fi

    # Build adaptive card facts dynamically in English
    FACTS="{\"title\": \"Project:\", \"value\": \"${PROJECT_NAME}\"}, {\"title\": \"Stage:\", \"value\": \"${STAGE_LABEL}\"}, {\"title\": \"Environment:\", \"value\": \"${ENV_BADGE}\"}"
    if [ $IS_ROLLBACK -eq 1 ]; then
        FACTS="${FACTS}, {\"title\": \"Failed Version:\", \"value\": \"${FAILED_VERSION}\"}"
        FACTS="${FACTS}, {\"title\": \"Rollback To:\", \"value\": \"${ROLLBACK_TO}\"}"
        FACTS="${FACTS}, {\"title\": \"Rollback Duration:\", \"value\": \"${JOB_DURATION_TEXT}\"}"
    else
        FACTS="${FACTS}, {\"title\": \"${BRANCH_OR_VERSION_TITLE}:\", \"value\": \"${BRANCH_OR_VERSION_VALUE}\"}"
        FACTS="${FACTS}, {\"title\": \"Commit SHA:\", \"value\": \"${CI_COMMIT_SHORT_SHA}\"}"
        FACTS="${FACTS}, {\"title\": \"Commit:\", \"value\": \"${ESC_COMMIT_MSG}\"}"
        FACTS="${FACTS}, {\"title\": \"Pipeline Duration:\", \"value\": \"${PIPELINE_DURATION_TEXT}\"}"
        FACTS="${FACTS}, {\"title\": \"Job Duration:\", \"value\": \"${JOB_DURATION_TEXT}\"}"
        if [ -n "$APP_URL" ]; then
            FACTS="${FACTS}, {\"title\": \"Application:\", \"value\": \"[${APP_URL}](${APP_URL})\"}"
        fi
    fi
    FACTS="${FACTS}, {\"title\": \"Triggered by:\", \"value\": \"${ESC_USER_NAME}\"}"
    FACTS="${FACTS}, {\"title\": \"Completed at:\", \"value\": \"${COMPLETED_AT}\"}"

    SMOKE_TEXT_BLOCK=""
    if [ -n "$SMOKE_FAILED_STEP" ]; then
        SMOKE_TEXT_BLOCK=", {\"type\": \"TextBlock\", \"text\": \"**Failed Step:** Step ${SMOKE_FAILED_STEP} - ${SMOKE_FAILED_TITLE}\\n**Reason:** ${SMOKE_FAILED_REASON}\", \"color\": \"Attention\", \"wrap\": true}"
    fi
    if [ -n "$SMOKE_SUMMARY_TEAMS" ]; then
        ESC_SMOKE_SUMMARY=$(echo "$SMOKE_SUMMARY_TEAMS" \
            | sed 's/\\/\\\\/g' \
            | sed 's/"/\\"/g' \
            | sed 's/$/\\n/' \
            | tr -d '\n')
        SMOKE_TEXT_BLOCK="${SMOKE_TEXT_BLOCK}, {\"type\": \"TextBlock\", \"text\": \"**Smoke Test Summary:**\\n${ESC_SMOKE_SUMMARY}\", \"wrap\": true}"
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
                        "type": "FactSet",
                        "facts": [
                            ${FACTS}
                            ${TEAMS_MR_FACT}
                        ]
                    }
                    ${SMOKE_TEXT_BLOCK}
                    ,
                    ${TRIVY_TEAMS_BLOCK}
                    {
                        "type": "TextBlock",
                        "text": "Execution Details",
                        "isSubtle": true,
                        "size": "Small",
                        "spacing": "Medium"
                    }
                    ${LOG_BLOCK}
                    ${TEAMS_REC_BLOCK}
                ],
                "actions": [
                    {
                        "type": "Action.OpenUrl",
                        "title": "View Pipeline",
                        "url": "${PIPELINE_URL}"
                    }
                    ${TRIVY_TEAMS_ACTION}
                    ${APP_TEAMS_ACTION}
                ],
                "\$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "version": "1.2"
            }
        }
    ]
}
EOF
)

    curl -s -H "Content-Type: application/json" -d "$PAYLOAD" "$TEAMS_WEBHOOK_URL" > /dev/null
    echo ""
fi

#!/bin/bash
set -e

ENV=$1
COMPONENT="frontend"

if [ -z "$ENV" ]; then
  echo "Error: Environment (staging/production) is required."
  exit 1
fi

echo "========================================================="
echo "STARTING ROLLBACK FOR COMPONENT: $COMPONENT ON ENV: $ENV"
echo "========================================================="

# 1. Setup Git Config
git config --global user.email "ci-bot@luumac.io.vn"
git config --global user.name "CI Bot"

# 2. Clone Infrastructure Repository
git clone \
  https://oauth2:${GITLAB_API_TOKEN}@gitlab.com/portfolio-macld/portfolio-infratructure.git \
  infra-repo-rollback

cd infra-repo-rollback

# 3. Locate Target File
TARGET_FILE="environments/${ENV}/${COMPONENT}-values.yaml"

if [ ! -f "$TARGET_FILE" ]; then
  echo "Error: Target values file $TARGET_FILE not found."
  exit 1
fi

# 4. Get Previous Tag from Git History
PREV_TAG=$(git show HEAD~1:"$TARGET_FILE" | yq '.image.tag')

if [ -z "$PREV_TAG" ] || [ "$PREV_TAG" = "null" ]; then
  echo "Error: Could not retrieve the previous tag from Git history."
  exit 1
fi

echo "Reverting $COMPONENT image tag from $(yq '.image.tag' "$TARGET_FILE") back to: $PREV_TAG"

# 5. Apply the Reversion
yq -i ".image.tag = \"$PREV_TAG\"" "$TARGET_FILE"

# 6. Commit and Push
git add "$TARGET_FILE"
git commit -m "chore($ENV): rollback $COMPONENT to $PREV_TAG [skip ci]" || echo "No changes to commit"

for i in {1..5}; do
  echo "Pushing rollback changes (attempt $i)..."
  git pull --rebase origin main && git push origin main && break
  echo "Conflict detected, retrying in 5 seconds..."
  sleep 5
  [ $i -eq 5 ] && exit 1
done

# 7. Trigger ArgoCD Sync
if [ -n "$ARGOCD_SERVER" ] && [ -n "$ARGOCD_TOKEN" ]; then
  echo "Installing ArgoCD CLI..."
  wget -qO /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
  chmod +x /usr/local/bin/argocd
  
  APP_NAME="portfolio-${COMPONENT}-${ENV}"
  echo "Triggering ArgoCD Sync for $APP_NAME..."
  export ARGOCD_AUTH_TOKEN="$ARGOCD_TOKEN"
  argocd app sync "$APP_NAME" --insecure --grpc-web \
    -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
    -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
  argocd app wait "$APP_NAME" --sync --health --timeout 300 --insecure --grpc-web \
    -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
    -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
else
  echo "WARNING: ARGOCD_SERVER or ARGOCD_TOKEN is not set. Skipping ArgoCD Wait."
fi

echo "========================================================="
echo "ROLLBACK COMPLETE!"
echo "========================================================="

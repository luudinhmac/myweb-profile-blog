#!/bin/bash
ssh -p 2222 -i ~/.ssh/id_ed25519_ansible macld@103.6.235.15 'kubectl patch app platform-velero -n argocd --type merge -p "{\"status\":{\"operationState\":{\"phase\":\"Failed\"}}}"'

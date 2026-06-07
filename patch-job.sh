#!/bin/bash
ssh -p 2222 -i ~/.ssh/id_ed25519_ansible macld@103.6.235.15 'kubectl patch job velero-upgrade-crds -n velero --type=merge -p "{\"metadata\":{\"finalizers\":null}}"'

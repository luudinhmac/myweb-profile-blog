import json
import sys
import os

critical_count = 0
high_count = 0
vulnerabilities = []

# 1. Define and verify expected scan files (Fail-closed)
EXPECTED_FILES = ["trivy-image.json", "trivy-fs.json", "trivy-secret.json", "trivy-config.json"]
missing_files = []

for file_name in EXPECTED_FILES:
    if not os.path.exists(file_name):
        missing_files.append(file_name)

if missing_files:
    print(f"[ERROR] Required Trivy scan output files are missing: {', '.join(missing_files)}")
    print("This indicates the Trivy scan job failed to produce results. Failing pipeline (Fail-closed).")
    sys.exit(1)

# 2. Parse scan files
for file_path in EXPECTED_FILES:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            results = data.get("Results", [])
            if not results:
                continue
                
            for result in results:
                # 1. Parse Vulnerabilities
                vulns = result.get("Vulnerabilities", [])
                for vuln in vulns:
                    severity = vuln.get("Severity", "")
                    vuln_id = vuln.get("VulnerabilityID", "")
                    pkg_name = vuln.get("PkgName", "")
                    
                    if severity in ["CRITICAL", "HIGH"]:
                        if severity == "CRITICAL":
                            critical_count += 1
                        else:
                            high_count += 1
                        vulnerabilities.append((severity, vuln_id, pkg_name))
                        
                # 2. Parse Secrets
                secrets = result.get("Secrets", [])
                for secret in secrets:
                    severity = secret.get("Severity", "")
                    rule_id = secret.get("RuleID", "Secret Detected")
                    title = secret.get("Title", "Secret")
                    if severity in ["CRITICAL", "HIGH"]:
                        if severity == "CRITICAL":
                            critical_count += 1
                        else:
                            high_count += 1
                        vulnerabilities.append((severity, rule_id, f"{title} in {result.get('Target', '')}"))
                        
                # 3. Parse Misconfigurations
                misconfigs = result.get("Misconfigurations", [])
                for misconfig in misconfigs:
                    severity = misconfig.get("Severity", "")
                    id_ = misconfig.get("ID", "Config ID")
                    type_ = misconfig.get("Type", "Config Type")
                    if severity in ["CRITICAL", "HIGH"]:
                        if severity == "CRITICAL":
                            critical_count += 1
                        else:
                            high_count += 1
                        vulnerabilities.append((severity, id_, f"{type_} in {result.get('Target', '')}"))
    except Exception as e:
        print(f"[ERROR] Error parsing {file_path}: {e}. Failing pipeline to prevent bypass (Fail-closed).")
        sys.exit(1)

# 3. Handle scan results
if critical_count > 0 or high_count > 0:
    vulnerabilities.sort(key=lambda x: 0 if x[0] == "CRITICAL" else 1)
    
    with open("trivy_summary.txt", "w", encoding="utf-8") as f:
        f.write("🚨 <b>Security Scan</b>\n")
        f.write(f"CRITICAL: {critical_count}\n")
        f.write(f"HIGH: {high_count}\n\n")
        
        f.write("🔥 <b>Top Issue</b>\n")
        if vulnerabilities:
            severity, vuln_id, pkg_name = vulnerabilities[0]
            f.write(f"{vuln_id}\n")
            f.write(f"Package: {pkg_name}\n")
            
    print(f"[ERROR] Security gate failed: Found {critical_count} CRITICAL and {high_count} HIGH vulnerabilities.")
    sys.exit(1)
else:
    print("[SUCCESS] Security gate passed: No CRITICAL or HIGH issues found.")
    sys.exit(0)

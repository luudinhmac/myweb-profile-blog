import json
import glob
import os
import sys
import html

# 1. Read package.json to classify Direct vs Transitive dependencies
direct_deps = set()
direct_dev_deps = set()
existing_overrides = {}

if os.path.exists("package.json"):
    try:
        with open("package.json", "r", encoding="utf-8") as f:
            pkg_data = json.load(f)
            direct_deps = set(pkg_data.get("dependencies", {}).keys())
            direct_dev_deps = set(pkg_data.get("devDependencies", {}).keys())
            
            # Check npm overrides
            npm_overrides = pkg_data.get("overrides", {})
            if isinstance(npm_overrides, dict):
                for k, v in npm_overrides.items():
                    if isinstance(v, str):
                        existing_overrides[k] = v
                        
            # Check yarn resolutions
            yarn_resolutions = pkg_data.get("resolutions", {})
            if isinstance(yarn_resolutions, dict):
                for k, v in yarn_resolutions.items():
                    if isinstance(v, str):
                        existing_overrides[k] = v
                        
            # Check pnpm overrides
            pnpm_overrides = pkg_data.get("pnpm", {}).get("overrides", {})
            if isinstance(pnpm_overrides, dict):
                for k, v in pnpm_overrides.items():
                    if isinstance(v, str):
                        existing_overrides[k] = v
    except Exception as e:
        print(f"Error reading package.json: {e}")

# Keep counts
critical_count = 0
high_count = 0

all_vulns = []
all_secrets = []
all_configs = []

# Deduplication sets
seen_vulns = set()
seen_secrets = set()
seen_configs = set()

# Look for all trivy json files
json_files = glob.glob("trivy-*.json")
targets = []

for file_path in json_files:
    if not os.path.exists(file_path):
        continue
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:
                continue
            data = json.loads(content)
            
            results = data.get("Results", [])
            if not results:
                continue
                
            for result in results:
                target = result.get("Target", "N/A")
                targets.append(target)
                res_class = result.get("Class", "")
                res_type = result.get("Type", "")
                
                # 1. Parse Vulnerabilities
                vulns = result.get("Vulnerabilities", [])
                for vuln in vulns:
                    severity = vuln.get("Severity", "")
                    if severity not in ["CRITICAL", "HIGH"]:
                        continue
                    
                    vuln_id = vuln.get("VulnerabilityID", "N/A")
                    pkg_name = vuln.get("PkgName", "N/A")
                    
                    vuln_key = (vuln_id, pkg_name)
                    if vuln_key in seen_vulns:
                        continue
                    seen_vulns.add(vuln_key)
                    
                    if severity == "CRITICAL":
                        critical_count += 1
                    elif severity == "HIGH":
                        high_count += 1
                        
                    # Classify vulnerability
                    classification = "unknown"
                    if res_class == "lang-pkgs" or res_type in ["npm", "pnpm", "yarn", "node-pkg", "poetry", "pip", "cargo", "go-module", "gemspec", "bundler", "composer"]:
                        classification = "app"
                    elif res_class == "os-pkgs" or res_type in ["alpine", "debian", "ubuntu", "redhat", "centos", "amazon", "oracle", "apk", "dpkg", "rpm"]:
                        classification = "os"
                    else:
                        target_lower = target.lower()
                        if "node_modules" in target_lower or "package.json" in target_lower or "pnpm-lock" in target_lower:
                            classification = "app"
                        elif "alpine" in target_lower or "apk" in target_lower or "lib" in target_lower:
                            classification = "os"
                        else:
                            classification = "app" # Default fallback
                            
                    all_vulns.append({
                        "id": vuln_id,
                        "package": pkg_name,
                        "installed_version": vuln.get("InstalledVersion", "N/A"),
                        "fixed_version": vuln.get("FixedVersion", "N/A"),
                        "severity": severity,
                        "title": vuln.get("Title", "N/A"),
                        "description": vuln.get("Description", "N/A"),
                        "url": vuln.get("PrimaryURL", ""),
                        "target": target,
                        "classification": classification
                    })
                    
                # 2. Parse Secrets
                secrets = result.get("Secrets", [])
                for secret in secrets:
                    severity = secret.get("Severity", "")
                    if severity not in ["CRITICAL", "HIGH"]:
                        continue
                        
                    rule_id = secret.get("RuleID", "Secret Detected")
                    title = secret.get("Title", "Secret")
                    match = secret.get("Match", "N/A")
                    start_line = secret.get("StartLine", "N/A")
                    
                    secret_key = (rule_id, target, start_line)
                    if secret_key in seen_secrets:
                        continue
                    seen_secrets.add(secret_key)
                    
                    if severity == "CRITICAL":
                        critical_count += 1
                    elif severity == "HIGH":
                        high_count += 1
                        
                    all_secrets.append({
                        "id": rule_id,
                        "title": title,
                        "severity": severity,
                        "match": match,
                        "target": target,
                        "line": start_line
                    })
                    
                # 3. Parse Misconfigurations
                misconfigs = result.get("Misconfigurations", [])
                for misconfig in misconfigs:
                    severity = misconfig.get("Severity", "")
                    if severity not in ["CRITICAL", "HIGH"]:
                        continue
                        
                    id_ = misconfig.get("ID", "Config ID")
                    title = misconfig.get("Title", "Config Issue")
                    message = misconfig.get("Message", "N/A")
                    resolution = misconfig.get("Resolution", "N/A")
                    
                    config_key = (id_, target)
                    if config_key in seen_configs:
                        continue
                    seen_configs.add(config_key)
                    
                    if severity == "CRITICAL":
                        critical_count += 1
                    elif severity == "HIGH":
                        high_count += 1
                        
                    all_configs.append({
                        "id": id_,
                        "title": title,
                        "severity": severity,
                        "message": message,
                        "resolution": resolution,
                        "target": target
                    })
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")

# 1.5. Parse Gitleaks Report if it exists
if os.path.exists("gitleaks-report.json"):
    try:
        with open("gitleaks-report.json", "r", encoding="utf-8") as f:
            content = f.read().strip()
            if content:
                leaks = json.loads(content)
                for leak in leaks:
                    rule_id = leak.get("RuleID", "Secret Detected")
                    title = leak.get("Description", "Secret")
                    match = leak.get("Match", "N/A")
                    target = leak.get("File", "N/A")
                    start_line = leak.get("StartLine", 0)
                    severity = "CRITICAL"
                    
                    secret_key = (rule_id, target, start_line)
                    if secret_key in seen_secrets:
                        continue
                    seen_secrets.add(secret_key)
                    
                    critical_count += 1
                    
                    all_secrets.append({
                        "id": rule_id,
                        "title": title,
                        "severity": severity,
                        "match": match,
                        "target": target,
                        "line": start_line
                    })
    except Exception as e:
        print(f"Error parsing gitleaks-report.json: {e}")

# Package manager detection
def detect_package_manager(targets_list):
    for t in targets_list:
        if "pnpm-lock.yaml" in t:
            return "pnpm"
        if "yarn.lock" in t:
            return "yarn"
        if "package-lock.json" in t:
            return "npm"
    # Fallback to local files
    if os.path.exists("pnpm-lock.yaml"):
        return "pnpm"
    if os.path.exists("yarn.lock"):
        return "yarn"
    if os.path.exists("package-lock.json"):
        return "npm"
    return "npm"

pkg_mgr = detect_package_manager(targets)

# Version selection logic
def pick_fixed_version(installed: str, raw_fixed_list: list[str]) -> str:
    fixed_versions = []
    for raw in raw_fixed_list:
        if not raw or raw == "N/A":
            continue
        for v in raw.split(","):
            v_clean = v.strip()
            if v_clean and v_clean not in fixed_versions:
                fixed_versions.append(v_clean)
                
    if not fixed_versions:
        return "N/A"
        
    installed_major = installed.split('.')[0] if (installed and installed != "N/A") else ""
    if installed_major:
        same_line = [v for v in fixed_versions if v.split('.')[0] == installed_major]
        if same_line:
            try:
                same_line.sort(key=lambda s: [int(x) if x.isdigit() else x for x in s.split('.')])
                return same_line[-1]
            except:
                same_line.sort()
                return same_line[-1]
                
    try:
        fixed_versions.sort(key=lambda s: [int(x) if x.isdigit() else x for x in s.split('.')])
        return fixed_versions[-1]
    except:
        fixed_versions.sort()
        return fixed_versions[-1]

# Group vulnerabilities by package name
grouped_vulns = {}
for v in all_vulns:
    pkg = v["package"]
    severity = v["severity"]
    vuln_id = v["id"]
    
    if pkg not in grouped_vulns:
        dep_type = "Transitive"
        if v["classification"] == "app":
            if pkg in direct_deps:
                dep_type = "Direct"
            elif pkg in direct_dev_deps:
                dep_type = "Direct (Dev)"
        else:
            dep_type = "System"
            
        grouped_vulns[pkg] = {
            "package": pkg,
            "installed_version": v["installed_version"],
            "raw_fixed_versions": [v["fixed_version"]],
            "max_severity": severity,
            "cves": [vuln_id],
            "classification": v["classification"],
            "target": v["target"],
            "url": v["url"],
            "dep_type": dep_type,
            "titles": [v["title"]]
        }
    else:
        if v["fixed_version"] not in grouped_vulns[pkg]["raw_fixed_versions"]:
            grouped_vulns[pkg]["raw_fixed_versions"].append(v["fixed_version"])
        if vuln_id not in grouped_vulns[pkg]["cves"]:
            grouped_vulns[pkg]["cves"].append(vuln_id)
        if v["title"] not in grouped_vulns[pkg]["titles"]:
            grouped_vulns[pkg]["titles"].append(v["title"])
            
        if severity == "CRITICAL" and grouped_vulns[pkg]["max_severity"] != "CRITICAL":
            grouped_vulns[pkg]["max_severity"] = "CRITICAL"
            grouped_vulns[pkg]["url"] = v["url"]

# Finalize fixed versions for grouped packages
for pkg, pkg_info in grouped_vulns.items():
    pkg_info["fixed_version"] = pick_fixed_version(pkg_info["installed_version"], pkg_info["raw_fixed_versions"])

app_deps = [pkg_info["package"] for pkg_info in grouped_vulns.values() if pkg_info["classification"] == "app"]
os_pkgs = [pkg_info["package"] for pkg_info in grouped_vulns.values() if pkg_info["classification"] == "os"]

has_app_issue = len(app_deps) > 0
has_infra_issue = len(os_pkgs) > 0 or len(all_secrets) > 0 or len(all_configs) > 0

if has_app_issue and has_infra_issue:
    owner = "Application Team & Platform/DevOps Team"
elif has_app_issue:
    owner = "Application Team"
elif has_infra_issue:
    owner = "Platform/DevOps Team"
else:
    owner = "Unknown"

# Sort grouped vulnerabilities: CRITICAL first, then HIGH, then by package name
sorted_grouped = sorted(grouped_vulns.values(), key=lambda x: (0 if x["max_severity"] == "CRITICAL" else 1, x["package"]))

# Interleave App and OS packages for diverse top affected packages display
app_bucket = [p for p in sorted_grouped if p["classification"] == "app"]
os_bucket = [p for p in sorted_grouped if p["classification"] == "os"]

interleaved_grouped = []
app_idx = 0
os_idx = 0
while app_idx < len(app_bucket) or os_idx < len(os_bucket):
    if app_idx < len(app_bucket):
        interleaved_grouped.append(app_bucket[app_idx])
        app_idx += 1
    if os_idx < len(os_bucket):
        interleaved_grouped.append(os_bucket[os_idx])
        os_idx += 1

# Recommended Actions
actions = []
app_actions = []

for pkg_info in sorted_grouped:
    if pkg_info["classification"] == "app":
        pkg_name = pkg_info["package"]
        fixed = pkg_info["fixed_version"]
        if fixed and fixed != "N/A":
            dep_type = pkg_info["dep_type"]
            if dep_type == "Direct":
                if pkg_mgr == "pnpm":
                    cmd = f"pnpm add {pkg_name}@{fixed}"
                elif pkg_mgr == "yarn":
                    cmd = f"yarn add {pkg_name}@{fixed}"
                else:
                    cmd = f"npm install {pkg_name}@{fixed}"
                app_actions.append(f"Upgrade direct dependency: `{cmd}`")
            elif dep_type == "Direct (Dev)":
                if pkg_mgr == "pnpm":
                    cmd = f"pnpm add -D {pkg_name}@{fixed}"
                elif pkg_mgr == "yarn":
                    cmd = f"yarn add -D {pkg_name}@{fixed}"
                else:
                    cmd = f"npm install --save-dev {pkg_name}@{fixed}"
                app_actions.append(f"Upgrade direct devDependency: `{cmd}`")
            else: # Transitive
                if pkg_name in existing_overrides:
                    existing_ver = existing_overrides[pkg_name]
                    if pkg_mgr == "pnpm":
                        rec = f"Transitive '{pkg_name}': existing override '{existing_ver}' is outdated -> update pnpm.overrides.{pkg_name} to '^{fixed}' in package.json."
                    elif pkg_mgr == "yarn":
                        rec = f"Transitive '{pkg_name}': existing override '{existing_ver}' is outdated -> update resolutions.{pkg_name} to '^{fixed}' in package.json."
                    else:
                        rec = f"Transitive '{pkg_name}': existing override '{existing_ver}' is outdated -> update overrides.{pkg_name} to '^{fixed}' in package.json."
                else:
                    if pkg_mgr == "pnpm":
                        rec = f"Transitive '{pkg_name}': no override yet -> add pnpm.overrides.{pkg_name} = '^{fixed}' in package.json."
                    elif pkg_mgr == "yarn":
                        rec = f"Transitive '{pkg_name}': no override yet -> add resolutions.{pkg_name} = '^{fixed}' in package.json."
                    else:
                        rec = f"Transitive '{pkg_name}': no override yet -> add overrides.{pkg_name} = '^{fixed}' in package.json."
                app_actions.append(rec)

if len(app_actions) > 5:
    actions.extend(app_actions[:5])
    actions.append(f"Upgrade other {len(app_actions) - 5} application dependencies (see full report).")
else:
    actions.extend(app_actions)

os_details = {}
for pkg_info in sorted_grouped:
    if pkg_info["classification"] == "os":
        pkg_name = pkg_info["package"]
        fixed = pkg_info["fixed_version"]
        target = pkg_info["target"]
        os_name = "OS"
        if "(" in target and ")" in target:
            os_name = target.split("(")[1].split(")")[0]
        elif ":" in target:
            os_name = target.split(":")[-1]
            
        if os_name not in os_details:
            os_details[os_name] = []
        os_details[os_name].append(f"{pkg_name} -> {fixed}")

if os_details:
    for os_name, items in sorted(os_details.items()):
        items_str = ", ".join(items[:4])
        if len(items) > 4:
            items_str += f" (+{len(items) - 4} more)"
        actions.append(f"OS packages ({os_name}): {items_str}. Run `apk update && apk upgrade --no-cache` in Dockerfile, or rebuild with newer base tag.")

if all_configs:
    unique_resolutions = sorted(list(set(c["resolution"] for c in all_configs if c["resolution"] != "N/A")))
    for res in unique_resolutions[:2]:
        actions.append(res)

if all_secrets:
    actions.append("Revoke and rotate the exposed secrets detected in source code immediately.")

# If no critical/high issues, exit successfully
if critical_count == 0 and high_count == 0:
    sys.exit(0)

# Sort all_vulns for the HTML detailed table: CRITICAL first, then HIGH
all_vulns.sort(key=lambda x: (0 if x["severity"] == "CRITICAL" else 1, x["package"]))

# Update dependency type details in detailed vulnerabilities for HTML
for v in all_vulns:
    pkg = v["package"]
    if v["classification"] == "app":
        if pkg in direct_deps:
            v["dep_type"] = "Direct"
        elif pkg in direct_dev_deps:
            v["dep_type"] = "Direct (Dev)"
        else:
            v["dep_type"] = "Transitive"
        v["owner"] = "App Team"
        v["owner_color"] = "#a78bfa"
    else:
        v["dep_type"] = "System"
        v["owner"] = "DevOps Team"
        v["owner_color"] = "#38bdf8"

# 1. Output Teams container block JSON
teams_items = [
    {
        "type": "TextBlock",
        "text": "🚨 **SECURITY SCAN FAILED**",
        "weight": "Bolder",
        "color": "Attention",
        "size": "Medium"
    },
    {
        "type": "FactSet",
        "facts": [
            { "title": "Critical Count:", "value": str(critical_count) },
            { "title": "High Count:", "value": str(high_count) },
            { "title": "Suggested Owner:", "value": f"**{owner}**" }
        ],
        "spacing": "Medium"
    }
]

class_facts = []
if app_deps:
    uniq_app = sorted(list(set(app_deps)))
    app_val = ", ".join(uniq_app[:5])
    if len(uniq_app) > 5:
        app_val += f" (+{len(uniq_app) - 5} more)"
    class_facts.append({ "title": "App Deps:", "value": app_val })

if os_pkgs:
    uniq_os = sorted(list(set(os_pkgs)))
    os_val = ", ".join(uniq_os[:5])
    if len(uniq_os) > 5:
        os_val += f" (+{len(uniq_os) - 5} more)"
    class_facts.append({ "title": "OS Packages:", "value": os_val })

config_titles = [c["title"] for c in all_configs] + [s["title"] for s in all_secrets]
if config_titles:
    uniq_cfg = sorted(list(set(config_titles)))
    cfg_val = ", ".join(uniq_cfg[:3])
    if len(uniq_cfg) > 3:
        cfg_val += f" (+{len(uniq_cfg) - 3} more)"
    class_facts.append({ "title": "Base Image/Config:", "value": cfg_val })

if class_facts:
    teams_items.append({
        "type": "TextBlock",
        "text": "**Root Cause & Classification**",
        "weight": "Bolder",
        "spacing": "Medium"
    })
    teams_items.append({
        "type": "FactSet",
        "facts": class_facts
    })

if interleaved_grouped:
    teams_items.append({
        "type": "TextBlock",
        "text": f"**Top Affected Packages ({min(5, len(interleaved_grouped))}/{len(interleaved_grouped)})**",
        "weight": "Bolder",
        "spacing": "Medium"
    })
    
    vuln_facts = []
    for idx, pkg_info in enumerate(interleaved_grouped[:5]):
        pkg = pkg_info["package"]
        curr = pkg_info["installed_version"]
        fix = pkg_info["fixed_version"]
        sev = pkg_info["max_severity"]
        cve_count = len(pkg_info["cves"])
        dep_type = pkg_info["dep_type"]
        
        title = f"{idx+1}. {pkg} ({dep_type})"
        value = f"{curr} → **{fix}** ({cve_count} CVE{'s' if cve_count > 1 else ''}) [{sev}]"
        vuln_facts.append({ "title": title, "value": value })
        
    teams_items.append({
        "type": "FactSet",
        "facts": vuln_facts
    })
    
    if len(interleaved_grouped) > 5:
        teams_items.append({
            "type": "TextBlock",
            "text": f"*... and {len(interleaved_grouped) - 5} more affected packages (see full report ↓)*",
            "isSubtle": True,
            "size": "Small"
        })

if actions:
    teams_items.append({
        "type": "TextBlock",
        "text": "**Recommended Actions**",
        "weight": "Bolder",
        "spacing": "Medium"
    })
    action_text = "\n".join([f"- {a}" for a in actions])
    teams_items.append({
        "type": "TextBlock",
        "text": action_text,
        "wrap": True
    })

# Output the Teams items as a valid JSON array (flat layout)
with open("trivy_teams_block.json", "w", encoding="utf-8") as f:
    json.dump(teams_items, f, indent=2)

# 2. Output Telegram pre-formatted HTML file
tg_lines = [
    "❌ <b>Security Scan Failed</b>\n",
    f"<b>Severity:</b> CRITICAL: {critical_count} | HIGH: {high_count}",
    f"<b>Suggested Owner:</b> {owner}\n"
]

has_root_cause = len(app_deps) > 0 or len(os_pkgs) > 0 or len(config_titles) > 0
if has_root_cause:
    tg_lines.append("<b>Root Cause & Classification:</b>")
    if app_deps:
        uniq_app = sorted(list(set(app_deps)))
        app_str = ", ".join(uniq_app[:5])
        if len(uniq_app) > 5:
            app_str += f" (+{len(uniq_app) - 5} more)"
        tg_lines.append(f"• <b>App Deps:</b> {app_str}")
        
    if os_pkgs:
        uniq_os = sorted(list(set(os_pkgs)))
        os_str = ", ".join(uniq_os[:5])
        if len(uniq_os) > 5:
            os_str += f" (+{len(uniq_os) - 5} more)"
        tg_lines.append(f"• <b>OS Packages:</b> {os_str}")
        
    if config_titles:
        uniq_cfg = sorted(list(set(config_titles)))
        cfg_str = ", ".join(uniq_cfg[:3])
        if len(uniq_cfg) > 3:
            cfg_str += f" (+{len(uniq_cfg) - 3} more)"
        tg_lines.append(f"• <b>Base Image/Config:</b> {cfg_str}")
        
    tg_lines.append("") # Extra spacing newline

if interleaved_grouped:
    tg_lines.append(f"<b>Top Affected Packages ({min(5, len(interleaved_grouped))}/{len(interleaved_grouped)}):</b>")
    for idx, pkg_info in enumerate(interleaved_grouped[:5]):
        pkg = pkg_info["package"]
        curr = pkg_info["installed_version"]
        fix = pkg_info["fixed_version"]
        sev = pkg_info["max_severity"]
        cve_count = len(pkg_info["cves"])
        dep_type = pkg_info["dep_type"]
        tg_lines.append(f"{idx+1}. <code>{pkg}</code> ({dep_type}) - {curr} → {fix} ({cve_count} CVEs) [{sev}]")
        
    if len(interleaved_grouped) > 5:
        tg_lines.append(f"<i>... and {len(interleaved_grouped) - 5} more affected packages (see full report ↓)</i>")
    tg_lines.append("")

if actions:
    tg_lines.append("<b>Recommended Actions:</b>")
    for a in actions:
        tg_lines.append(f"• {a}")

with open("trivy_summary_telegram.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(tg_lines))

# Write default fallback trivy_summary.txt as well
with open("trivy_summary.txt", "w", encoding="utf-8") as f:
    f.write(f"🚨 <b>Security Scan</b>\nCRITICAL: {critical_count}\nHIGH: {high_count}\n")

# 3. Output beautiful HTML report
html_template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trivy Security Report</title>
    <style>
        :root {{
            --bg-color: #0b0f19;
            --card-bg: rgba(17, 24, 39, 0.7);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-color: #f3f4f6;
            --text-muted: #9ca3af;
            --critical: #ef4444;
            --high: #f97316;
            --success: #10b981;
            --info: #3b82f6;
        }}
        body {{
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 2.5rem;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        header {{
            margin-bottom: 2.5rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
        }}
        h1 {{
            margin: 0 0 0.5rem 0;
            font-size: 2.4rem;
            font-weight: 800;
            letter-spacing: -0.025em;
        }}
        .subtitle {{
            color: var(--text-muted);
            margin: 0;
            font-size: 1.1rem;
        }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }}
        .card {{
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 1.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }}
        .card-title {{
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            margin-top: 0;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }}
        .card-value {{
            font-size: 2.2rem;
            font-weight: 800;
            margin: 0;
        }}
        .card-value.critical {{ color: var(--critical); }}
        .card-value.high {{ color: var(--high); }}
        
        .section-title {{
            font-size: 1.5rem;
            font-weight: 700;
            margin-top: 2.5rem;
            margin-bottom: 1.25rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--border-color);
        }}
        
        .actions-list {{
            background: rgba(59, 130, 246, 0.05);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 12px;
            padding: 1.25rem 1.5rem;
            margin-bottom: 2.5rem;
        }}
        .actions-list ul {{
            margin: 0;
            padding-left: 1.25rem;
        }}
        .actions-list li {{
            margin-bottom: 0.5rem;
        }}
        .actions-list li:last-child {{
            margin-bottom: 0;
        }}
        
        table {{
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-bottom: 3rem;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        }}
        th, td {{
            padding: 1rem 1.25rem;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }}
        th {{
            background-color: rgba(17, 24, 39, 0.9);
            font-weight: 600;
            color: var(--text-muted);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        tr:last-child td {{
            border-bottom: none;
        }}
        tr:hover td {{
            background-color: rgba(255, 255, 255, 0.02);
        }}
        .badge {{
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            border: 1px solid transparent;
        }}
        .badge.critical {{ background-color: rgba(239, 68, 68, 0.15); color: var(--critical); border-color: rgba(239, 68, 68, 0.3); }}
        .badge.high {{ background-color: rgba(249, 115, 22, 0.15); color: var(--high); border-color: rgba(249, 115, 22, 0.3); }}
        .badge.secret {{ background-color: rgba(236, 72, 153, 0.15); color: #ec4899; border-color: rgba(236, 72, 153, 0.3); }}
        .badge.config {{ background-color: rgba(59, 130, 246, 0.15); color: var(--info); border-color: rgba(59, 130, 246, 0.3); }}
        .badge.dep-direct {{ background-color: rgba(16, 185, 129, 0.15); color: var(--success); border-color: rgba(16, 185, 129, 0.3); }}
        .badge.dep-transitive {{ background-color: rgba(156, 163, 175, 0.15); color: var(--text-muted); border-color: rgba(156, 163, 175, 0.3); }}
        .badge.dep-system {{ background-color: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); }}
        
        code {{
            background-color: rgba(0, 0, 0, 0.4);
            padding: 0.2rem 0.4rem;
            border-radius: 6px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.85em;
            color: #f43f5e;
        }}
        a {{
            color: var(--info);
            text-decoration: none;
            font-weight: 500;
        }}
        a:hover {{
            text-decoration: underline;
        }}
        .empty-state {{
            padding: 3rem;
            text-align: center;
            color: var(--text-muted);
            font-style: italic;
        }}
        .text-bold {{
            font-weight: 600;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Trivy Security Report</h1>
            <p class="subtitle">Consolidated vulnerability scan and compliance analysis.</p>
        </header>
        
        <div class="grid">
            <div class="card">
                <p class="card-title">Critical Severity</p>
                <p class="card-value critical">{critical_count}</p>
            </div>
            <div class="card">
                <p class="card-title">High Severity</p>
                <p class="card-value high">{high_count}</p>
            </div>
            <div class="card">
                <p class="card-title">Suggested Owner</p>
                <p class="card-value" style="font-size: 1.3rem; margin-top: 0.5rem; font-weight: 700; color: #a78bfa;">{owner}</p>
            </div>
        </div>
"""

# Add actions list
if actions:
    html_template += """
        <div class="section-title">Recommended Actions</div>
        <div class="actions-list">
            <ul>
    """
    for a in actions:
        html_template += f"            <li>{html.escape(a)}</li>\n"
    html_template += """
            </ul>
        </div>
    """

# Add vulnerabilities table
html_template += """
        <div class="section-title">Vulnerabilities (CRITICAL & HIGH)</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 8%">Severity</th>
                    <th style="width: 10%">Type</th>
                    <th style="width: 12%">Owner</th>
                    <th style="width: 15%">Vulnerability ID</th>
                    <th style="width: 15%">Package</th>
                    <th style="width: 15%">Versions</th>
                    <th style="width: 15%">Target / Path</th>
                    <th style="width: 10%">Description</th>
                </tr>
            </thead>
            <tbody>
"""

if all_vulns:
    for v in all_vulns:
        badge_class = v["severity"].lower()
        if "Direct" in v["dep_type"]:
            dep_type_badge = "dep-direct"
        elif "Transitive" in v["dep_type"]:
            dep_type_badge = "dep-transitive"
        else:
            dep_type_badge = "dep-system"
        vuln_id_link = f'<a href="{v["url"]}" target="_blank">{html.escape(v["id"])}</a>' if v["url"] else html.escape(v["id"])
        html_template += f"""                <tr>
                    <td><span class="badge {badge_class}">{v["severity"]}</span></td>
                    <td><span class="badge {dep_type_badge}">{v["dep_type"]}</span></td>
                    <td class="text-bold" style="color: {v["owner_color"]};">{html.escape(v["owner"])}</td>
                    <td class="text-bold">{vuln_id_link}</td>
                    <td class="text-bold">{html.escape(v["package"])}</td>
                    <td><code>{html.escape(v["installed_version"])}</code> &rarr; <code>{html.escape(v["fixed_version"])}</code></td>
                    <td style="font-size: 0.85rem; color: var(--text-muted); word-break: break-all;">{html.escape(v["target"])}</td>
                    <td style="font-size: 0.85rem;">{html.escape(v["title"])}</td>
                </tr>\n"""
else:
    html_template += '                <tr><td colspan="8" class="empty-state">No vulnerabilities detected.</td></tr>\n'

html_template += """            </tbody>
        </table>
"""

# Add Secrets table
html_template += """
        <div class="section-title">Secrets Detected</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 10%">Severity</th>
                    <th style="width: 15%">Owner</th>
                    <th style="width: 15%">Rule ID</th>
                    <th style="width: 20%">Title</th>
                    <th style="width: 25%">Target / Path</th>
                    <th style="width: 15%">Line Number</th>
                </tr>
            </thead>
            <tbody>
"""

if all_secrets:
    for s in all_secrets:
        html_template += f"""                <tr>
                    <td><span class="badge secret">SECRET</span></td>
                    <td class="text-bold" style="color: #38bdf8;">DevOps Team</td>
                    <td class="text-bold">{html.escape(s["id"])}</td>
                    <td>{html.escape(s["title"])}</td>
                    <td style="font-size: 0.85rem; color: var(--text-muted); word-break: break-all;">{html.escape(s["target"])}</td>
                    <td>Line {html.escape(str(s["line"]))}</td>
                </tr>\n"""
else:
    html_template += '                <tr><td colspan="6" class="empty-state">No secrets exposed.</td></tr>\n'

html_template += """            </tbody>
        </table>
"""

# Add configurations table
html_template += """
        <div class="section-title">Configuration Misconfigurations</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 10%">Severity</th>
                    <th style="width: 15%">Owner</th>
                    <th style="width: 15%">ID</th>
                    <th style="width: 20%">Title</th>
                    <th style="width: 15%">Target</th>
                    <th style="width: 25%">Message / Resolution</th>
                </tr>
            </thead>
            <tbody>
"""

if all_configs:
    for c in all_configs:
        html_template += f"""                <tr>
                    <td><span class="badge config">CONFIG</span></td>
                    <td class="text-bold" style="color: #38bdf8;">DevOps Team</td>
                    <td class="text-bold">{html.escape(c["id"])}</td>
                    <td>{html.escape(c["title"])}</td>
                    <td style="font-size: 0.85rem; color: var(--text-muted); word-break: break-all;">{html.escape(c["target"])}</td>
                    <td style="font-size: 0.85rem;"><span style="color: var(--critical); font-weight: 500;">{html.escape(c["message"])}</span><br><span style="color: var(--success); font-weight: 500; margin-top: 0.25rem; display: inline-block;">&rarr; Resolution: {html.escape(c["resolution"])}</span></td>
                </tr>\n"""
else:
    html_template += '                <tr><td colspan="6" class="empty-state">No configuration issues found.</td></tr>\n'

html_template += """            </tbody>
        </table>
    </div>
</body>
</html>
"""

# Format HTML report output
formatted_html = html_template.format(
    critical_count=critical_count,
    high_count=high_count,
    owner=owner
)

with open("trivy-report.html", "w", encoding="utf-8") as f:
    f.write(formatted_html)

print(f"[SUCCESS] Parsed security scan files. Critical: {critical_count}, High: {high_count}")
sys.exit(1)

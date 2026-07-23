# =========================================================================
# RESOURCES: CLOUDFLARE TUNNEL
# =========================================================================

# 1. Cloudflare Tunnel
resource "cloudflare_zero_trust_tunnel_cloudflared" "k8s_tunnel" {
  account_id = var.cloudflare_account_id
  name       = "k8s-prod"
  secret     = var.cloudflare_tunnel_secret

  lifecycle {
    ignore_changes = [secret]
  }
}

# =========================================================================
# RESOURCES: ZERO TRUST ACCESS APPLICATION
# =========================================================================

# 2. Access Application (Bảo vệ đồng thời cả 3 subdomain)
resource "cloudflare_zero_trust_access_application" "argocd_grafana_dashboard" {
  account_id       = var.cloudflare_account_id
  name             = "argocd-grafana-dashboard"
  domain           = "argocd.luumac.io.vn"
  type             = "self_hosted"
  session_duration = "24h"

  destinations {
    type = "public"
    uri  = "argocd.luumac.io.vn"
  }

  destinations {
    type = "public"
    uri  = "grafana.luumac.io.vn"
  }

  destinations {
    type = "public"
    uri  = "k8s.luumac.io.vn"
  }

  lifecycle {
    ignore_changes = [destinations]
  }
}

# =========================================================================
# RESOURCES: ACCESS POLICY
# =========================================================================

# 3. Access Policy cho ứng dụng (Allow Email Access)
resource "cloudflare_zero_trust_access_policy" "admin_policy" {
  application_id = cloudflare_zero_trust_access_application.argocd_grafana_dashboard.id
  account_id     = var.cloudflare_account_id
  name           = "Access ArgoCD-Grafana-Dashboardk8s"
  precedence     = 1
  decision       = "allow"

  include {
    email = var.admin_emails
  }

  lifecycle {
    ignore_changes = all
  }
}

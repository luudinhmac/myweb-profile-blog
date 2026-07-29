# =========================================================================
# RESOURCES: CLOUDFLARE TUNNEL
# =========================================================================

# 1. Cloudflare Tunnel
resource "cloudflare_zero_trust_tunnel_cloudflared" "k8s_tunnel" {
  account_id = var.cloudflare_account_id
  name       = "k8s-prod-tunnel"
  secret     = var.cloudflare_tunnel_secret

  lifecycle {
    ignore_changes = [secret, name]
  }
}

# =========================================================================
# RESOURCES: TUNNEL INGRESS CONFIGURATION (Published Application Routes)
# =========================================================================

# 2. Ingress Configuration cho các Published Application Routes
resource "cloudflare_zero_trust_tunnel_cloudflared_config" "k8s_tunnel_config" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.k8s_tunnel.id

  config {
    # Route cho ArgoCD (HTTPS 443 + No TLS Verify)
    ingress_rule {
      hostname = "argocd.luumac.io.vn"
      service  = "https://127.0.0.1:443"
      origin_request {
        no_tls_verify = true
      }
    }

    # Route cho Grafana (HTTPS 443 + No TLS Verify)
    ingress_rule {
      hostname = "grafana.luumac.io.vn"
      service  = "https://127.0.0.1:443"
      origin_request {
        no_tls_verify = true
      }
    }

    # Route cho Kubernetes Dashboard (HTTPS 443 + No TLS Verify)
    ingress_rule {
      hostname = "k8s.luumac.io.vn"
      service  = "https://127.0.0.1:443"
      origin_request {
        no_tls_verify = true
      }
    }

    # Route cho Uptime Kuma (HTTP 80)
    ingress_rule {
      hostname = "uptime.luumac.io.vn"
      service  = "http://127.0.0.1:80"
    }

    # Catch-all Rule (Bắt buộc theo quy định Cloudflare)
    ingress_rule {
      service = "http_status:404"
    }
  }
}

# =========================================================================
# RESOURCES: ZERO TRUST ACCESS APPLICATION
# =========================================================================

# 3. Access Application (Bảo vệ đồng thời cả 3 subdomain)
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

# 4. Access Policy cho ứng dụng (Allow Email Access)
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

# 5. Service Token cho GitLab CI/CD
resource "cloudflare_zero_trust_access_service_token" "gitlab_ci" {
  account_id = var.cloudflare_account_id
  name       = "gitlab-ci-token"

  lifecycle {
    ignore_changes = all
  }
}

# 6. Access Policy cho GitLab CI/CD (Bypass qua Service Token)
resource "cloudflare_zero_trust_access_policy" "gitlab_ci_policy" {
  application_id = cloudflare_zero_trust_access_application.argocd_grafana_dashboard.id
  account_id     = var.cloudflare_account_id
  name           = "bypass-for-argocd-gitlab-ci"
  precedence     = 2
  decision       = "bypass"

  include {
    service_token = [cloudflare_zero_trust_access_service_token.gitlab_ci.id]
  }

  lifecycle {
    ignore_changes = all
  }
}

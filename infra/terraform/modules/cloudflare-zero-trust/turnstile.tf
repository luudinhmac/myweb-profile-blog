# =========================================================================
# RESOURCES: CLOUDFLARE TURNSTILE WIDGET
# =========================================================================

resource "cloudflare_turnstile_widget" "portfolio_widget" {
  account_id     = var.cloudflare_account_id
  name           = "portfolio-turnstile-widget"
  domains        = ["luumac.io.vn", "staging.luumac.io.vn"]
  mode           = "managed"
}

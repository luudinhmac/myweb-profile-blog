module "cloudflare_r2" {
  source = "../../modules/cloudflare-r2"
  
  cloudflare_account_id = var.cloudflare_account_id
}

module "cloudflare_zero_trust" {
  source = "../../modules/cloudflare-zero-trust"

  cloudflare_account_id    = var.cloudflare_account_id
  cloudflare_zone_id       = var.cloudflare_zone_id
  cloudflare_tunnel_secret = var.cloudflare_tunnel_secret
  admin_emails             = var.admin_emails
}

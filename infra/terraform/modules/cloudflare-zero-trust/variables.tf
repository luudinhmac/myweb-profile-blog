variable "cloudflare_account_id" {
  description = "The Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID cho ten mien luumac.io.vn"
  type        = string
}

variable "cloudflare_tunnel_secret" {
  type        = string
  description = "Secret key cua Cloudflared Tunnel (Chuoi Base64 co do dai >= 32 ky tu)"
  sensitive   = true
}

variable "admin_emails" {
  type        = list(string)
  description = "List of admin emails allowed in Access Policy"
  default     = ["admin@example.com"]
}

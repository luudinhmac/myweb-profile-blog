variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "The Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID cho ten mien luumac.io.vn"
  type        = string
}

variable "cloudflare_tunnel_secret" {
  description = "Secret key cua Cloudflared Tunnel (Chuoi Base64 co do dai >= 32 ky tu)"
  type        = string
  sensitive   = true
}

variable "admin_emails" {
  description = "Danh sach email admin duoc phep truy cap Access Application"
  type        = list(string)
  default     = ["admin@example.com"]
}

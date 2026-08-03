output "turnstile_site_key" {
  description = "The Cloudflare Turnstile Site Key for frontend configuration"
  value       = cloudflare_turnstile_widget.portfolio_widget.id
}

output "turnstile_secret_key" {
  description = "The Cloudflare Turnstile Secret Key for backend configuration"
  value       = cloudflare_turnstile_widget.portfolio_widget.secret
  sensitive   = true
}

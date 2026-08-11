output "turnstile_site_key" {
  description = "The Cloudflare Turnstile Site Key for frontend configuration"
  value       = module.cloudflare_zero_trust.turnstile_site_key
}

output "turnstile_secret_key" {
  description = "The Cloudflare Turnstile Secret Key for backend configuration"
  value       = module.cloudflare_zero_trust.turnstile_secret_key
  sensitive   = true
}

output "blog_upload_prod_id" {
  value = cloudflare_r2_bucket.blog_upload_prod.id
}
output "terraform_state_bucket_name" {
  value = cloudflare_r2_bucket.terraform_state.name
}

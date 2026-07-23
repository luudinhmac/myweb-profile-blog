# Di chuyển các R2 buckets từ cấp root (file cũ r2.tf) vào trong module cloudflare_r2

moved {
  from = cloudflare_r2_bucket.blog_upload_prod
  to   = module.cloudflare_r2.cloudflare_r2_bucket.blog_upload_prod
}

moved {
  from = cloudflare_r2_bucket.blog_upload_staging
  to   = module.cloudflare_r2.cloudflare_r2_bucket.blog_upload_staging
}

moved {
  from = cloudflare_r2_bucket.cluster_etcd_backup_prod
  to   = module.cloudflare_r2.cloudflare_r2_bucket.cluster_etcd_backup_prod
}

moved {
  from = cloudflare_r2_bucket.velero_k8s_prod
  to   = module.cloudflare_r2.cloudflare_r2_bucket.velero_k8s_prod
}

moved {
  from = cloudflare_r2_bucket.terraform_state
  to   = module.cloudflare_r2.cloudflare_r2_bucket.terraform_state
}

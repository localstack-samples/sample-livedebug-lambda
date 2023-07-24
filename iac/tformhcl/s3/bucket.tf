resource "aws_s3_bucket" "sample_bucket" {
    bucket = var.bucket_name
    acl = var.acl_value
}
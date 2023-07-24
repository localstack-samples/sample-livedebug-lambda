resource "aws_s3_bucket" "sample_bucket" {
    bucket = var.bucket_name
}

resource "aws_s3_bucket_acl" "sample_bucket_acl" {
    bucket = aws_s3_bucket.sample_bucket.bucket
    acl = var.acl_value
}
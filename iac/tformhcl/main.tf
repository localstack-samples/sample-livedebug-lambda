terraform {
  backend "local" {
    path = "./terraform.tfstate"
  }
}

provider "aws" {
#  skip_requesting_account_id = true
#  skip_credentials_validation = true
}


module "s3" {
    source = "./s3"
    # bucket name should be unique globally
    bucket_name = "sample-bucket"
}
terraform {
  backend "local" {
    path = "./terraform.tfstate"
  }
}

provider "aws" {}


module "s3" {
    source = "./s3"
    # bucket name should be unique globally
    bucket_name = "sample-bucket"
}
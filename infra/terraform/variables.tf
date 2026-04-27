variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t4g.micro"
}

variable "repo_url" {
  description = "Git repository URL to clone on the instance"
  type        = string
  default     = "git@github.com:HashMapsData2Value/check-place.git"
}

variable "github_owner" {
  description = "GitHub repository owner (user or org)."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
  default     = ""
}

variable "project_name" {
  description = "Project namespace used to name resources"
  type        = string
  default     = "check-place"
}

variable "public_key" {
  description = "Optional SSH public key (for creating an ec2 key pair)"
  type        = string
  default     = ""
}

variable "allowed_cidr" {
  description = "CIDR allowed to access instance ports (defaults to 0.0.0.0/0)"
  type        = string
  default     = "0.0.0.0/0"
}

variable "manage_deploy_key" {
  description = "Whether Terraform should create the deploy key SSM parameter. If false, assume the parameter already exists."
  type        = bool
  default     = false
}

variable "deploy_key_ssm_name" {
  description = "SSM Parameter name where the private deploy key is stored (SecureString)"
  type        = string
  default     = "/check-place/github-deploy-key"
}

variable "deploy_key_private" {
  description = "Private key value for SSM SecureString if managing via Terraform. Sensitive."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cleanup_deploy_key" {
  description = "Whether the EC2 instance should remove the deploy private key file after cloning (default true)"
  type        = bool
  default     = true
}

## Use SSM Parameter for the latest Amazon Linux 2 aarch64 (Graviton) AMI
data "aws_ssm_parameter" "amazon_linux_2_arm" {
  name = "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-arm64-gp2"
}

# Minimal VPC + public subnet for the project (namespaced)
resource "aws_vpc" "this" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = {
    Name    = "${var.project_name}-vpc"
    Project = var.project_name
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags = {
    Name    = "${var.project_name}-igw"
    Project = var.project_name
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.this.id
  cidr_block              = "10.0.1.0/24"
  map_public_ip_on_launch = true
  tags = {
    Name    = "${var.project_name}-public-subnet"
    Project = var.project_name
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = {
    Name    = "${var.project_name}-public-rt"
    Project = var.project_name
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security group limited to the project and allowed CIDR
resource "aws_security_group" "app_sg" {
  name        = "${var.project_name}-sg"
  description = "Allow app ports"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  ingress {
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  ingress {
    from_port   = 5678
    to_port     = 5678
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project_name}-sg"
    Project = var.project_name
  }
}

resource "aws_key_pair" "deployer" {
  count      = var.public_key != "" ? 1 : 0
  key_name   = "${var.project_name}-key"
  public_key = var.public_key
}

resource "aws_iam_role" "instance_role" {
  name = "${var.project_name}-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
  tags = {
    Project = var.project_name
  }
}

resource "aws_iam_role_policy_attachment" "ssm_attach" {
  role       = aws_iam_role.instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Minimal policy to allow reading SSM parameters under /check-place/*
data "aws_iam_policy_document" "ssm_read" {
  statement {
    actions = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/*"]
    effect = "Allow"
  }
}

resource "aws_iam_policy" "ssm_read_policy" {
  name   = "${var.project_name}-ssm-read"
  policy = data.aws_iam_policy_document.ssm_read.json
}

resource "aws_iam_role_policy_attachment" "attach_ssm_read" {
  role       = aws_iam_role.instance_role.name
  policy_arn = aws_iam_policy.ssm_read_policy.arn
}

resource "aws_iam_instance_profile" "instance_profile" {
  name = "${var.project_name}-instance-profile"
  role = aws_iam_role.instance_role.name
}

# Optional: create the deploy key SSM parameter if requested
resource "aws_ssm_parameter" "deploy_key" {
  count       = var.manage_deploy_key ? 1 : 0
  name        = var.deploy_key_ssm_name
  description = "Private deploy key for GitHub deploy (SecureString)"
  type        = "SecureString"
  value       = var.deploy_key_private
  overwrite   = true
  tags = {
    Project = var.project_name
  }
}

data "aws_caller_identity" "current" {}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.amazon_linux_2_arm.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  associate_public_ip_address = true
  iam_instance_profile   = aws_iam_instance_profile.instance_profile.name
  key_name               = length(aws_key_pair.deployer.*.key_name) > 0 ? aws_key_pair.deployer[0].key_name : null

  user_data = templatefile("${path.module}/user_data.sh.tpl", { 
    repo_url = var.repo_url != "" ? var.repo_url : "git@github.com:${var.github_owner}/${var.github_repo}.git",
    aws_region = var.aws_region,
    deploy_key_ssm_name = var.deploy_key_ssm_name,
    manage_deploy_key = var.manage_deploy_key,
    cleanup_deploy_key = var.cleanup_deploy_key
  })

  tags = {
    Name    = "${var.project_name}-backend"
    Project = var.project_name
  }
}

output "instance_public_ip" {
  value = aws_instance.app.public_ip
}

output "instance_public_dns" {
  value = aws_instance.app.public_dns
}

output "security_group_id" {
  value = aws_security_group.app_sg.id
}

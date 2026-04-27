Usage notes for `github-ci-policy.json`:

- The JSON file contains a suggested IAM policy for a GitHub Actions CI user that will run `terraform apply` to provision the EC2 host and related resources.
- Before applying in production, review and tighten resource ARNs and conditions. Some actions (notably IAM actions) require broad scope during creation; consider scoping by tag or name if possible.
- Replace wildcards and `*` where you can. For SSM access, the policy already restricts to `arn:aws:ssm:*:*:parameter/check-place/*`.
- If you store the deploy key with a customer-managed KMS key, add a condition granting `kms:Decrypt` only for that KMS key.
- To use this policy:
  1. Create an IAM user in AWS for GitHub CI.
  2. Create a new inline or managed policy using the JSON in `github-ci-policy.json`.
  3. Attach the policy to the IAM user (or a role that GitHub's OIDC will assume).

Security tips:
- Prefer using GitHub OIDC to assume a short-lived role instead of long-lived AWS user credentials.
- Keep the SSM parameter name consistent with Terraform's `deploy_key_ssm_name` (default `/check-place/github-deploy-key`).
- Consider requiring MFA on powerful human users; CI user should be programmatic and minimal.

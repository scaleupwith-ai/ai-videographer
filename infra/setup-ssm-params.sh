#!/bin/bash
# Setup SSM Parameters for AWS Batch worker
# Run this with AWS credentials that have SSM write access

set -e

REGION="ap-southeast-2"
PREFIX="/ai-videographer"

echo "Setting up SSM parameters for AI Videographer..."
echo "Region: $REGION"
echo ""

# Function to set a parameter
set_param() {
  local name=$1
  local value=$2
  local description=$3
  
  echo "Setting $PREFIX/$name..."
  aws ssm put-parameter \
    --region "$REGION" \
    --name "$PREFIX/$name" \
    --value "$value" \
    --type SecureString \
    --description "$description" \
    --overwrite \
    --no-cli-pager
}

# Prompt for values or read from env
echo "Enter values for SSM parameters (or set them as env vars before running):"
echo ""

# Supabase
if [ -z "$SUPABASE_URL" ]; then
  read -p "SUPABASE_URL: " SUPABASE_URL
fi
set_param "supabase-url" "$SUPABASE_URL" "Supabase project URL"

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  read -sp "SUPABASE_SERVICE_KEY: " SUPABASE_SERVICE_KEY
  echo ""
fi
set_param "supabase-service-key" "$SUPABASE_SERVICE_KEY" "Supabase service role key"

# R2 / Cloudflare
if [ -z "$R2_ACCESS_KEY_ID" ]; then
  read -p "R2_ACCESS_KEY_ID: " R2_ACCESS_KEY_ID
fi
set_param "r2-access-key-id" "$R2_ACCESS_KEY_ID" "Cloudflare R2 access key ID"

if [ -z "$R2_SECRET_ACCESS_KEY" ]; then
  read -sp "R2_SECRET_ACCESS_KEY: " R2_SECRET_ACCESS_KEY
  echo ""
fi
set_param "r2-secret-access-key" "$R2_SECRET_ACCESS_KEY" "Cloudflare R2 secret access key"

if [ -z "$R2_ENDPOINT" ]; then
  read -p "R2_ENDPOINT: " R2_ENDPOINT
fi
set_param "r2-endpoint" "$R2_ENDPOINT" "Cloudflare R2 endpoint URL"

if [ -z "$R2_BUCKET" ]; then
  read -p "R2_BUCKET (default: ai-videographer): " R2_BUCKET
  R2_BUCKET=${R2_BUCKET:-ai-videographer}
fi
set_param "r2-bucket" "$R2_BUCKET" "Cloudflare R2 bucket name"

if [ -z "$R2_PUBLIC_URL" ]; then
  read -p "R2_PUBLIC_URL: " R2_PUBLIC_URL
fi
set_param "r2-public-url" "$R2_PUBLIC_URL" "Cloudflare R2 public URL"

echo ""
echo "✅ All SSM parameters created successfully!"
echo ""
echo "To verify, run:"
echo "  aws ssm get-parameters-by-path --path '$PREFIX' --region $REGION --with-decryption"








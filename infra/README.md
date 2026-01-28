# AWS Batch Infrastructure for AI Videographer

This directory contains the infrastructure setup for serverless video rendering using AWS Batch.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│   AWS Batch     │────▶│   ECR Image     │
│  (Render API)   │     │   Job Queue     │     │   (Worker)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Supabase     │     │  Compute Env    │     │   R2 Storage    │
│   (Database)    │     │  (Scale to 0)   │     │   (Assets)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Benefits

- **Scale to Zero**: No idle costs - instances only run during renders
- **Auto-scaling**: Multiple renders can run in parallel
- **Cost-effective**: Pay only for actual render time
- **Managed**: AWS handles instance lifecycle
- **Secrets Management**: SSM Parameter Store for secure credential storage

## Setup Instructions

### Prerequisites

1. AWS CLI configured with admin access
2. VPC with at least one public subnet
3. ECR repository with worker image pushed

### Step 1: Set up SSM Parameters

Store your secrets in SSM Parameter Store:

```bash
chmod +x setup-ssm-params.sh
./setup-ssm-params.sh
```

Or set environment variables first:
```bash
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."
export R2_ACCESS_KEY_ID="xxx"
export R2_SECRET_ACCESS_KEY="xxx"
export R2_ENDPOINT="https://xxx.r2.cloudflarestorage.com"
export R2_BUCKET="ai-videographer"
export R2_PUBLIC_URL="https://pub-xxx.r2.dev"
./setup-ssm-params.sh
```

### Step 2: Deploy CloudFormation Stack

```bash
# Get your VPC and subnet IDs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,Tags[?Key==`Name`].Value|[0]]' --output table
aws ec2 describe-subnets --query 'Subnets[*].[SubnetId,VpcId,AvailabilityZone]' --output table

# Deploy the stack
aws cloudformation create-stack \
  --stack-name ai-videographer-batch \
  --template-body file://batch-stack.yaml \
  --parameters \
    ParameterKey=VpcId,ParameterValue=vpc-xxxxxxxx \
    ParameterKey=SubnetIds,ParameterValue="subnet-xxxxxxxx,subnet-yyyyyyyy" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name ai-videographer-batch \
  --region ap-southeast-2
```

### Step 3: Update Environment Variables

Add to your `.env.local`:

```bash
# Enable AWS Batch
USE_AWS_BATCH=true
AWS_REGION=ap-southeast-2
AWS_BATCH_JOB_QUEUE=ai-videographer-render-queue
AWS_BATCH_JOB_DEFINITION=ai-videographer-render

# AWS credentials (for submitting jobs)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

### Step 4: Update Worker Image

The worker needs to include the batch job entry point:

```bash
cd worker
npm run build
docker build --platform linux/amd64 -t ai-videographer-worker .
docker tag ai-videographer-worker:latest 960446855965.dkr.ecr.ap-southeast-2.amazonaws.com/ai-videographer-worker:latest
docker push 960446855965.dkr.ecr.ap-southeast-2.amazonaws.com/ai-videographer-worker:latest

# Update job definition to use new image (if needed)
aws batch register-job-definition \
  --job-definition-name ai-videographer-render \
  --type container \
  --container-properties file://job-definition.json \
  --region ap-southeast-2
```

## Monitoring

### View Batch Jobs

```bash
# List recent jobs
aws batch list-jobs \
  --job-queue ai-videographer-render-queue \
  --region ap-southeast-2

# Get job details
aws batch describe-jobs \
  --jobs <job-id> \
  --region ap-southeast-2
```

### View Logs

Logs are in CloudWatch under `/aws/batch/ai-videographer-render`.

```bash
# Stream logs for a job
aws logs tail /aws/batch/ai-videographer-render --follow
```

### Compute Environment Status

```bash
aws batch describe-compute-environments \
  --compute-environments ai-videographer-cpu \
  --region ap-southeast-2
```

## Cost Optimization

1. **Instance Types**: Currently using c6i.xlarge (4 vCPU, 8GB) - good balance for FFmpeg
2. **Spot Instances**: Consider enabling Spot for up to 90% savings (add to compute environment)
3. **Max vCPUs**: Adjust based on concurrent render needs

### Enable Spot Instances (Optional)

Update the compute environment to use Spot:

```yaml
ComputeResources:
  Type: SPOT
  BidPercentage: 80  # Pay up to 80% of on-demand price
  SpotIamFleetRole: !GetAtt SpotFleetRole.Arn
```

## Troubleshooting

### Job stuck in RUNNABLE

- Check compute environment has capacity
- Verify subnets have internet access (NAT Gateway or public subnet)
- Check security group allows outbound traffic

### Job fails immediately

- Check CloudWatch logs for error
- Verify SSM parameters are set correctly
- Test image locally: `docker run -e JOB_ID=test -e PROJECT_ID=test <image>`

### Scale issues

- Increase MaxvCpus in compute environment
- Add more instance types for better availability

## Cleanup

```bash
# Delete all resources
aws cloudformation delete-stack \
  --stack-name ai-videographer-batch \
  --region ap-southeast-2

# Delete SSM parameters
aws ssm delete-parameters \
  --names \
    /ai-videographer/supabase-url \
    /ai-videographer/supabase-service-key \
    /ai-videographer/r2-access-key-id \
    /ai-videographer/r2-secret-access-key \
    /ai-videographer/r2-endpoint \
    /ai-videographer/r2-bucket \
    /ai-videographer/r2-public-url \
  --region ap-southeast-2
```








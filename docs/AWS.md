# Deploying to AWS

Everything runs in **your company's AWS account**, so you own the data, the videos and the bill.

```
                          ┌──────────────── your AWS account ────────────────┐
 Phone / browser ──HTTPS──▶  Application Load Balancer (ACM certificate)      │
                          │            │                                     │
                          │   ECS Fargate service  (1 container: API + web)  │
                          │      │                  │                        │
                          │      ▼                  ▼                        │
                          │  RDS PostgreSQL     S3 bucket (private)          │
                          │  (private subnet)   videos + images              │
                          │                                                  │
                          │  Secrets Manager · CloudWatch Logs · AWS Backup  │
                          └──────────────────────────────────────────────────┘
```

* **One container** (the `Dockerfile` in the repo) serves the React app and the API on port 3000, so there is no CORS to configure and the sign-in cookie just works.
* **Videos never have a public URL.** The bucket blocks all public access. Staff watch through the app's `/api/media/...` endpoint, which checks the user, their shift, their assignment and brand/role on *every* request and streams from S3 in short ranges. Admins upload straight from their browser to S3 with a short-lived presigned URL.
* **No AWS keys anywhere.** The container uses its ECS *task role* to reach S3.

> **Why ECS and not App Runner?** AWS [stopped accepting new App Runner customers on 30 April 2026](https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/apprunner-availability-change.html) and recommends ECS Express Mode. The same image and environment variables below work on either ECS Express Mode (simplest — it creates the service, load balancer and scaling for you) or a regular Fargate service behind an ALB. EC2 or Lightsail with `docker run` also works for a very small pilot.

> **Status of this guide:** the app, its tests and the S3 code path were exercised locally (against Postgres 16 and an S3-compatible server). The AWS steps below were **not** run against a real AWS account, so treat them as a checklist to verify, and check current console screens and pricing.

## 1. Create the pieces

### S3 bucket (videos and images)
* Region close to your staff (e.g. `ap-south-1`, Mumbai). **Block all public access: ON.** Default encryption SSE-S3. Versioning ON (protects against accidental deletes).
* **CORS** (needed for the admin's browser upload). Replace the origin with your real URL:
  ```json
  [{ "AllowedOrigins": ["https://training.example.com"], "AllowedMethods": ["PUT"],
     "AllowedHeaders": ["content-type"], "ExposeHeaders": [], "MaxAgeSeconds": 3000 }]
  ```
* The CORS rule is only used for uploads; playback goes through the app.

### RDS PostgreSQL
* PostgreSQL 16, **private subnets**, not publicly accessible. Start with `db.t4g.micro` or `db.t4g.small`; storage 20 GB with autoscaling.
* **Automated backups ON** (retention 7–35 days) — this is your database backup. Enable deletion protection.
* Security group: allow port 5432 **only from the ECS service's security group**.
* RDS enforces TLS, so set `DATABASE_SSL=true`. To also verify the certificate, bundle AWS's `global-bundle.pem` into the image and set `DATABASE_SSL_CA_FILE`.

### Secrets
Store in Secrets Manager (or SSM Parameter Store) and inject into the task definition as secrets:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgres://USER:PASSWORD@HOST:5432/lms` |
| `JWT_SECRET` | output of `openssl rand -hex 32` (the server refuses to start in production without it) |

### Container image
```bash
aws ecr create-repository --repository-name staff-lms
docker build -t staff-lms .
docker tag staff-lms:latest <account>.dkr.ecr.<region>.amazonaws.com/staff-lms:latest
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker push <account>.dkr.ecr.<region>.amazonaws.com/staff-lms:latest
```

### Task role (what the container may do in AWS)
Attach this to the ECS **task role** (not the execution role). Nothing else is needed:
```json
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"],
                  "Resource": "arn:aws:s3:::YOUR-BUCKET/*" }] }
```

## 2. Run it
Create the ECS service (Express Mode, or Fargate + ALB) from the image with:

| Setting | Value |
|---|---|
| Container port | `3000` |
| Health check | `GET /api/health` (checks the database too) |
| CPU / memory | 0.5 vCPU / 1 GB is plenty to start; 2 tasks across two AZs for availability |
| Load balancer | HTTPS listener with an ACM certificate for your domain; **idle timeout ≥ 120 s** |
| Environment | `NODE_ENV=production`, `DATABASE_SSL=true`, `STORAGE_DRIVER=s3`, `S3_BUCKET=…`, `AWS_REGION=…`, `APP_TIMEZONE=Asia/Kolkata` |
| Secrets | `DATABASE_URL`, `JWT_SECRET` |

The server applies database migrations on startup (safe with several tasks starting at once).

### First sign-in
There is no shell on Fargate, so the first Super Admin is created from the environment. On the **first** deploy only, also set:

```
ADMIN_EMPLOYEE_ID=ADMIN001
ADMIN_NAME=Head Office
ADMIN_PASSWORD=<a temporary password>
```
Sign in, you will be forced to choose a new password, then **delete the three `ADMIN_*` variables** and redeploy. (They are ignored once any user exists, but remove them anyway.) Everything after that — brands, outlets, users, modules, recipes, assignments — is done in the app.

## 3. Operate it
* **Backups:** RDS automated backups + the S3 bucket's versioning. Test a restore once before go-live. For a second copy, add an AWS Backup plan for the database and S3 replication/backup for the bucket.
* **Logs & alarms:** container logs go to CloudWatch. Add alarms for ALB 5xx, ECS unhealthy tasks, RDS CPU/free storage. Business events (sign-ins, access removals, content changes, video starts) are in the app's **Audit** page.
* **Updating:** push a new image, force a new ECS deployment. Migrations in `server/migrations/` run automatically. Add new schema changes as new numbered `.sql` files, never edit old ones.
* **Removing a person's access** takes effect on their very next request — no cache to wait for.

## 4. Rough running costs
Order-of-magnitude only; check the [AWS Pricing Calculator](https://calculator.aws/) for your region and numbers.

| Item | Typical small setup |
|---|---|
| Fargate (2 × 0.5 vCPU / 1 GB) | tens of USD / month |
| RDS `db.t4g.small`, single AZ, 20 GB | tens of USD / month (roughly double for Multi-AZ) |
| Application Load Balancer | ~USD 20 / month plus usage |
| S3 storage | cents per GB-month — a few hundred GB of video is a few USD |
| **Data transfer out (video streaming)** | **the cost that scales with usage**: roughly USD 0.09–0.11 per GB streamed to the internet. Cost ≈ views × video length × bitrate. Compress videos (720p, ~1–2 Mbps H.264 is plenty for kitchen training). |
| Secrets Manager, CloudWatch, backups | a few USD / month |

## 5. When you outgrow this
* **Many simultaneous viewers or slow mobile networks:** put CloudFront in front of the bucket and convert videos to adaptive HLS with AWS Elemental MediaConvert. The access rules would then use CloudFront signed cookies instead of streaming through the Node container. This is the main planned upgrade; the app's media routes are the only place that changes.
* **Reminders:** Amazon SES (email) / SNS (SMS) triggered from an EventBridge schedule calling a small endpoint or script. Not built yet.

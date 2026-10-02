# Workshop Shop - Application Repository

This repository contains **Workshop Shop**, a deliberately small shopping
demo application, plus the GitHub Actions workflow that builds it and
hands it off to the platform repository for deployment.

> This is one of two repositories used in the workshop
> *"Build a CI/CD Pipeline on Amazon EKS with Terraform, GitHub Actions, and Argo CD"*.
> The other repository, which holds the Terraform infrastructure, Argo CD
> configuration, and Kubernetes manifests, is here:
> **`<PLATFORM_REPO_URL_PLACEHOLDER>`** (replace with your `shop-platform` repository URL).

## What this application is (and isn't)

Workshop Shop is a single Node.js + Express app serving plain HTML, CSS,
and JavaScript - no frontend framework, no TypeScript, no database, and
no real payment processing. It:

- Displays six products (name, GBP price, icon) from `app/products.json`.
- Lets you add products to a cart, change quantities, and remove items.
- Shows a running total.
- Stores the cart in the browser's `localStorage` (there is no server-side
  cart or session).
- Simulates checkout: it shows an order confirmation and clearly labels
  it as a demonstration - **no real order is placed**.
- Shows a store banner and the app version, both read from the server.
- Exposes `GET /health` for Kubernetes probes.
- Listens on port `3000`.

All prices are stored and calculated as **integer pence** (e.g. 1999 =
£19.99) and only formatted to a `£x.xx` string for display, which avoids
floating-point rounding mistakes.

## Project layout

```
app/
  server.js          Express server: serves static files, /health, /api/store-info
  products.json       The six products shown in the store
  public/             index.html, style.css, script.js (the whole frontend)
  Dockerfile          Simple single-stage build using npm ci
  .dockerignore
.github/workflows/
  build-and-update-gitops.yaml   CI: build image -> push to ECR -> update platform repo
```

## Running locally

Requires Node.js 20+.

```bash
cd app
npm ci
npm start
```

Then open <http://localhost:3000> and check the health endpoint:

```bash
curl http://localhost:3000/health
# {"status":"ok","version":"1.0.0"}
```

## Running with Docker

```bash
cd app
docker build -t workshop-shop:local .
docker run --rm -p 3000:3000 workshop-shop:local
```

Open <http://localhost:3000> as above.

## Changing the product price and the banner

These are the two edits used during the workshop demo to show a change
flow all the way through the pipeline:

- **Product price**: edit the `pricePence` field for any product in
  [`app/products.json`](app/products.json). Prices are integer pence, so
  £24.99 is `2499`.
- **Store banner**: edit the `STORE_BANNER` constant near the top of
  [`app/server.js`](app/server.js).

Commit and push either change to `main` and the workflow below takes it
from there.

## The CI workflow, step by step

File: [`.github/workflows/build-and-update-gitops.yaml`](.github/workflows/build-and-update-gitops.yaml)

1. **Trigger** - runs on pushes to `main` that touch `app/**` or the
   workflow file itself, and can also be run manually
   (`workflow_dispatch`) from the Actions tab.
2. **Checkout** - checks out this (application) repository.
3. **AWS authentication (OIDC)** - exchanges this run's GitHub OIDC token
   for short-lived AWS credentials by assuming `AWS_ROLE_ARN`. No AWS
   access keys are stored in this repository at all.
4. **ECR login** - logs the Docker client in to Amazon ECR using those
   temporary credentials.
5. **Build** - builds the application image from `app/` and tags it with
   the **full application commit SHA** (captured once, at the very start
   of the job, into `env.APP_COMMIT_SHA` - see the comment in the
   workflow file for why).
6. **Push** - pushes that image to `ECR_REPOSITORY_URL`.
7. **Checkout the platform repository** - checks out `GITOPS_REPOSITORY`
   into a separate `platform/` directory, authenticated with the
   `GITOPS_TOKEN` secret.
8. **Update the manifest** - replaces only the image line in
   `platform/gitops/deployment.yaml` that carries a
   `# workshop-shop-image` marker comment, using one `sed` command. If
   that marker is missing, the step fails loudly instead of silently
   doing nothing.
9. **Commit and push** - commits the manifest change (using the SHA
   captured in step 5) and pushes it to the platform repository's `main`
   branch. If the image tag didn't actually change, this step exits
   cleanly without an empty commit.

Argo CD (running in the cluster, configured in the platform repository)
notices the new commit and deploys it - this workflow never touches
Kubernetes or EKS directly.

### Permissions and security notes

- The workflow's `GITHUB_TOKEN` is limited to `contents: read` and
  `id-token: write` - just enough to check out code and request an OIDC
  token. It is **not** used to push to the platform repository.
- AWS authentication always uses **OIDC**, never long-lived AWS access
  keys.
- `concurrency` is set so that overlapping runs queue up instead of
  cancelling each other - a cancelled run could push an image without
  ever updating the manifest, or vice versa.

## Repository variables

Set these under **Settings -> Secrets and variables -> Actions -> Variables**:

| Variable | Example | Purpose |
|---|---|---|
| `AWS_REGION` | `eu-west-2` | Region containing the ECR repository and EKS cluster |
| `AWS_ROLE_ARN` | `arn:aws:iam::<account-id>:role/workshop-shop-github-actions` | IAM role this workflow assumes via OIDC (Terraform output `github_actions_role_arn`) |
| `ECR_REPOSITORY_URL` | `<account-id>.dkr.ecr.eu-west-2.amazonaws.com/workshop-shop` | Where the built image is pushed (Terraform output `ecr_repository_url`) |
| `GITOPS_REPOSITORY` | `your-org/shop-platform` | The platform repository, in `owner/repository` format |

## Repository secret

| Secret | Purpose |
|---|---|
| `GITOPS_TOKEN` | A **fine-grained GitHub personal access token**, restricted to the `shop-platform` repository only, with repository permission **Contents: Read and write**. Stored **only** in this (application) repository's Actions secrets - never in the platform repository, and never printed or embedded in any URL or log. |

**Organisation approval:** if either repository lives in a GitHub
organisation, an organisation owner may need to approve the fine-grained
PAT before it can access the repository (organisations can require this
under *Settings -> Personal access tokens -> Settings*). Ask an org owner
to approve it if the token appears "pending".

**Protected branches:** this workshop assumes `main` on the platform
repository accepts direct pushes from `GITOPS_TOKEN`. In a production
setup, `main` would typically be protected, and this workflow would open
a pull request instead of pushing directly - that is a good next
improvement, not implemented here to keep the workshop simple.

## CI troubleshooting

| Symptom | Likely cause |
|---|---|
| `AssumeRoleWithWebIdentity` / OIDC error | `AWS_ROLE_ARN` is wrong, or the IAM role's trust policy doesn't match this repository/branch - see the platform repo's Terraform for the trust condition. |
| `denied: ...` pushing to ECR | `ECR_REPOSITORY_URL` is wrong, or the IAM role lacks ECR push permissions. |
| `::error::Could not find the '# workshop-shop-image' marker` | `platform/gitops/deployment.yaml` was edited and lost the marker comment, or `GITOPS_REPOSITORY` points at the wrong repo. |
| `git push` step fails with a permission/403 error | `GITOPS_TOKEN` is missing, expired, not approved by the organisation, or not scoped to the platform repository with write access. |
| Workflow runs but platform repo never changes | Check the "Commit and push manifest change" step's log - it may have exited cleanly because the image tag was already up to date. |

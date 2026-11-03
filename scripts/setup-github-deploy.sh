#!/usr/bin/env bash
# Configura, uma única vez, a publicação automática pelo GitHub Actions sem chave secreta.
# Rodar no Cloud Shell do projeto labeme-reservas:  bash scripts/setup-github-deploy.sh
set -euo pipefail
P=labeme-reservas
REPO=labeme-ufpb/labeme-reservas
SA_NAME=github-deploy
SA=$SA_NAME@$P.iam.gserviceaccount.com
PN=$(gcloud projects describe $P --format='value(projectNumber)')

echo "1/5 Ativando APIs..."
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com firebasehosting.googleapis.com firebaserules.googleapis.com --project $P

echo "2/5 Conta de serviço $SA..."
gcloud iam service-accounts describe $SA --project $P >/dev/null 2>&1 || \
  gcloud iam service-accounts create $SA_NAME --display-name="GitHub Actions (publicação)" --project $P

echo "3/5 Permissões..."
for R in roles/firebase.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding $P --member=serviceAccount:$SA --role=$R --condition=None >/dev/null
done

echo "4/5 Identidade do GitHub (Workload Identity Federation)..."
gcloud iam workload-identity-pools describe github --location=global --project $P >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create github --location=global --display-name="GitHub" --project $P
gcloud iam workload-identity-pools providers describe github-oidc --workload-identity-pool=github --location=global --project $P >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc github-oidc --workload-identity-pool=github --location=global \
    --display-name="GitHub Actions" --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='$REPO'" --project $P

echo "5/5 Autorizando apenas o repositório $REPO..."
gcloud iam service-accounts add-iam-policy-binding $SA --project $P --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/github/attribute.repository/$REPO" >/dev/null

echo "PRONTO. Provedor: projects/$PN/locations/global/workloadIdentityPools/github/providers/github-oidc"

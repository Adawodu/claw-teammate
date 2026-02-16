.PHONY: deploy-openclaw ssh-tunnel openclaw-status

# Deploy OpenClaw to GCP Compute Engine
deploy-openclaw:
	bash infra/gcp/deploy-openclaw.sh

# SSH tunnel to access OpenClaw dashboard at http://localhost:18789
ssh-tunnel:
	gcloud compute ssh openclaw-vm \
		--zone=$${GCP_ZONE:-us-central1-a} \
		--project=$${GCP_PROJECT:?Set GCP_PROJECT} \
		-- -L 18789:localhost:18789

# Check OpenClaw gateway health
openclaw-status:
	gcloud compute ssh openclaw-vm \
		--zone=$${GCP_ZONE:-us-central1-a} \
		--project=$${GCP_PROJECT:?Set GCP_PROJECT} \
		-- openclaw status

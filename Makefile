.PHONY: mqtt-monitor

mqtt-monitor:
	mosquitto_sub -h mosquitto -t "GivEnergy/control/#" -v

REMOTE_HOST ?= user@remote-host
REMOTE_DIR  ?= ~/battery-client

.PHONY: deploy deploy-status deploy-logs deploy-down

deploy:
	ssh $(REMOTE_HOST) "mkdir -p $(REMOTE_DIR)/mosquitto $(REMOTE_DIR)/givtcp-config"
	scp docker-compose.yml Dockerfile $(REMOTE_HOST):$(REMOTE_DIR)/
	scp mosquitto/mosquitto.conf $(REMOTE_HOST):$(REMOTE_DIR)/mosquitto/
	scp givtcp-config/allsettings.json $(REMOTE_HOST):$(REMOTE_DIR)/givtcp-config/ 2>/dev/null || true
	scp -r src/ public/ package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs $(REMOTE_HOST):$(REMOTE_DIR)/
	scp .env $(REMOTE_HOST):$(REMOTE_DIR)/ 2>/dev/null || true
	ssh $(REMOTE_HOST) "cd $(REMOTE_DIR) && docker compose up -d --build"

deploy-status:
	ssh $(REMOTE_HOST) "cd $(REMOTE_DIR) && docker compose ps"

deploy-logs:
	ssh $(REMOTE_HOST) "cd $(REMOTE_DIR) && docker compose logs -f"

deploy-down:
	ssh $(REMOTE_HOST) "cd $(REMOTE_DIR) && docker compose down"

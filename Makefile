.PHONY: mqtt-monitor

ifneq ($(wildcard .env),)
include .env
export
else
$(error .env file not found. Copy .env.example to .env and fill in the required values before running make.)
endif

REMOTE_SSH ?= $(REMOTE_USER)@$(REMOTE_HOST)
REMOTE_DIR  ?= ~/battery-client

mqtt-monitor:
	mosquitto_sub -h $(REMOTE_HOST) -t "GivEnergy/#" -v

.PHONY: deploy deploy-status deploy-logs deploy-down

deploy:
	ssh $(REMOTE_SSH) "mkdir -p $(REMOTE_DIR)/mosquitto $(REMOTE_DIR)/givtcp-config"
	scp docker-compose.yml Dockerfile $(REMOTE_SSH):$(REMOTE_DIR)/
	scp mosquitto/mosquitto.conf $(REMOTE_SSH):$(REMOTE_DIR)/mosquitto/
	scp givtcp-config/allsettings.json $(REMOTE_SSH):$(REMOTE_DIR)/givtcp-config/ 2>/dev/null || true
	scp -r src/ public/ package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs $(REMOTE_SSH):$(REMOTE_DIR)/
	scp .env $(REMOTE_SSH):$(REMOTE_DIR)/ 2>/dev/null || true
	ssh $(REMOTE_SSH) "cd $(REMOTE_DIR) && docker compose up -d --build"

deploy-status:
	ssh $(REMOTE_SSH) "cd $(REMOTE_DIR) && docker compose ps"

deploy-logs:
	ssh $(REMOTE_SSH) "cd $(REMOTE_DIR) && docker compose logs -f"

deploy-down:
	ssh $(REMOTE_SSH) "cd $(REMOTE_DIR) && docker compose down"

.PHONY: smartthings-deploy smartthings-update smartthings-redeploy smartthings-clean smartthings-logs smart-login lint

smart-login:
	npx tsx smartthings-edge-driver/scripts/deploy-smartthings.ts login

smart-deploy:
	npx tsx smartthings-edge-driver/scripts/deploy-smartthings.ts deploy

smart-update:
	npx tsx smartthings-edge-driver/scripts/deploy-smartthings.ts update

# Force-recreate one or more capabilities (drops & re-registers schema + presentation,
# then re-uploads the driver). Pass capability names via CAPS=...
#   Example: make smart-redeploy CAPS=pauseSchedule
#   Example: make smart-redeploy CAPS="pauseSchedule targetSoc"
smart-redeploy:
	@if [ -z "$(CAPS)" ]; then \
		echo "ERROR: CAPS is required. Example: make smart-redeploy CAPS=pauseSchedule"; \
		exit 2; \
	fi
	npx tsx smartthings-edge-driver/scripts/deploy-smartthings.ts redeploy $(CAPS)

smart-clean:
	@echo "To remove orphaned capabilities from SmartThings cloud:"
	@echo "  smartthings capabilities:list"
	@echo "  smartthings capabilities:delete <capability-id>"
	@echo ""
	@echo "  smartthings edge:drivers:installed --hub $(SMARTTHINGS_HUB_ID)"
	@echo "  smartthings edge:drivers:uninstall <driver-id> --hub $(SMARTTHINGS_HUB_ID)"

smart-logs:
	npx tsx smartthings-edge-driver/scripts/deploy-smartthings.ts logs

lint:
	npm run lint
	cd smartthings-edge-driver && luacheck src/

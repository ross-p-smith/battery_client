.PHONY: mqtt-monitor

include .env
export

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

.PHONY: smartthings-deploy smartthings-update smartthings-logs lint

smart-deploy:
	npx tsx smartthings-edge-driver/scripts/deploy-smartthings.ts deploy

smart-update:
	npx tsx smartthings-edge-driver/scripts/deploy-smartthings.ts update

lint:
	npm run lint
	cd smartthings-edge-driver && luacheck src/

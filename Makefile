.PHONY: mqtt-monitor

mqtt-monitor:
	mosquitto_sub -h mosquitto -t "GivEnergy/control/#" -v

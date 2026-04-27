local Driver = require "st.driver"
local capabilities = require "st.capabilities"
local cosock = require "cosock"
local socket = require "cosock.socket"
local log = require "log"
local mqtt = require "mqtt"

local topic_router = require "topic_router"
local command_handlers = require "command_handlers"
local caps = require "capabilities_ref"

local DRIVER_VERSION = "1.1.0"

local client = nil

-- Getter closure for command handlers
local function get_client()
  return client
end

-- Create MQTT client with device preferences
local function create_mqtt_client(device)
  local connect_args = {
    uri = device.preferences.brokerIp,
    clean = true,
  }
  if device.preferences.mqttUser and device.preferences.mqttUser ~= "" then
    connect_args.username = device.preferences.mqttUser
    connect_args.password = device.preferences.mqttPass
  end

  local c = mqtt.client(connect_args)
  c:on{
    connect = function(connack)
      if connack.rc ~= 0 then
        log.error("MQTT connection failed:", connack:reason_string())
        return
      end
      log.info("Connected to MQTT broker")
      device:online()
      device:emit_component_event(device.profile.components.main,
        caps.mqttStatus.status("Connected"))
      local serial = device.preferences.inverterSerial
      c:subscribe{ topic = "GivEnergy/" .. serial .. "/#", qos = 1 }
      log.info("Subscribed to GivEnergy/" .. serial .. "/#")
    end,
    message = function(msg)
      assert(c:acknowledge(msg))
      topic_router.route_message(device, msg.topic, msg.payload)
    end,
    error = function(err)
      log.error("MQTT error:", err)
      device:offline()
      device:emit_component_event(device.profile.components.main,
        caps.mqttStatus.status("Error: " .. tostring(err)))
    end,
  }
  return c
end

-- Start MQTT in background coroutine with reconnection loop
local function start_mqtt(device)
  client = create_mqtt_client(device)
  cosock.spawn(function()
    while true do
      local ok, err = mqtt.run_sync(client)
      if not ok then
        log.warn("MQTT disconnected:", tostring(err))
        device:offline()
        device:emit_component_event(device.profile.components.main,
          caps.mqttStatus.status("Reconnecting..."))
        local delay = device.preferences.reconnectDelay or 15
        socket.sleep(delay)
        client = create_mqtt_client(device)
      end
    end
  end, "MQTT client loop")
end

-- Lifecycle: init — start MQTT if preferences are configured
local function device_init(driver, device)
  log.info("Device init:", device.label)
  device:emit_component_event(device.profile.components.inverter,
    caps.inverterInfo.info("v" .. DRIVER_VERSION))
  device:emit_component_event(device.profile.components.schedule,
    caps.pauseSchedule.pauseMode("PauseDischarge"))
  device:emit_component_event(device.profile.components.schedule,
    caps.pauseSchedule.pauseStart("23:00"))
  device:emit_component_event(device.profile.components.schedule,
    caps.pauseSchedule.pauseEnd("05:30"))

  if device.preferences.inverterSerial and device.preferences.inverterSerial ~= ""
     and device.preferences.brokerIp and device.preferences.brokerIp ~= "" then
    start_mqtt(device)
  else
    device:emit_component_event(device.profile.components.main,
      caps.mqttStatus.status("Configure broker IP and serial"))
  end
end

-- Lifecycle: added — emit initial zero state
local function device_added(driver, device)
  log.info("Device added:", device.label)
  device:emit_event(capabilities.battery.battery(0))
  device:emit_component_event(device.profile.components.main,
    capabilities.powerMeter.power({value = 0, unit = "W"}))

  device:emit_component_event(device.profile.components.grid,
    capabilities.powerMeter.power({value = 0, unit = "W"}))
  device:emit_component_event(device.profile.components.house,
    capabilities.powerMeter.power({value = 0, unit = "W"}))
  device:emit_component_event(device.profile.components.inverter,
    caps.inverterInfo.info("v" .. DRIVER_VERSION))
  device:emit_component_event(device.profile.components.schedule,
    caps.pauseSchedule.pauseMode("Disabled"))
  device:emit_component_event(device.profile.components.schedule,
    caps.pauseSchedule.pauseStart(""))
  device:emit_component_event(device.profile.components.schedule,
    caps.pauseSchedule.pauseEnd(""))
  device:emit_component_event(device.profile.components.main,
    caps.mqttStatus.status("Not connected"))
end

-- Lifecycle: removed — disconnect MQTT
local function device_removed(driver, device)
  log.info("Device removed:", device.label)
  if client then
    client:disconnect()
    client = nil
  end
end

-- Lifecycle: infoChanged — reconnect on preference change
local function info_changed(driver, device, event, args)
  if args.old_st_store and args.old_st_store.preferences then
    local old = args.old_st_store.preferences
    if old.brokerIp ~= device.preferences.brokerIp or
       old.inverterSerial ~= device.preferences.inverterSerial or
       old.brokerPort ~= device.preferences.brokerPort or
       old.mqttUser ~= device.preferences.mqttUser then
      log.info("Preferences changed, reconnecting MQTT")
      if client then client:disconnect() end
      start_mqtt(device)
    end
  end
end

-- Refresh handler — reconnects MQTT
local function handle_refresh(driver, device, command)
  log.info("Refresh requested")
  if client then
    client:disconnect()
  end
  start_mqtt(device)
end

-- Discovery handler — creates single device
local function discovery_handler(driver, _, should_continue)
  if #driver:get_devices() == 0 then
    driver:try_create_device({
      type = "LAN",
      device_network_id = "GivEnergy_Battery_" .. tostring(socket.gettime()),
      label = "GivEnergy Battery",
      profile = "givenergy-battery",
      manufacturer = "Ross Smith",
      model = "GivTCP MQTT",
      vendor_provided_label = "GivEnergy Battery System",
    })
  end
end

-- Driver construction
local handlers = command_handlers.build_handlers(get_client)
handlers[capabilities.refresh.ID] = {
  [capabilities.refresh.commands.refresh.NAME] = handle_refresh,
}

local driver = Driver("GivEnergy Battery", {
  discovery = discovery_handler,
  lifecycle_handlers = {
    init = device_init,
    added = device_added,
    removed = device_removed,
    infoChanged = info_changed,
  },
  capability_handlers = handlers,
})

-- Set global for luamqtt client.lua timer compatibility
thisDriver = driver

driver:run()

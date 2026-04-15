local log = require "log"
local caps = require "capabilities_ref"

local M = {}

-- Battery mode mapping (SmartThings mode name → GivTCP mode value)
local mode_values = {
  ["Eco"]           = "1",
  ["Timed Demand"]  = "4",
  ["Timed Export"]  = "2",
}

-- Command map: defines all SmartThings commands and their GivTCP MQTT targets
local command_map = {
  -- control component
  { cap = caps.switchLevel,    cmd = "setLevel",  topic = "setChargeRate",     xform = function(args) return tostring(args.level) end },
  { cap = caps.mode,           cmd = "setMode",   topic = "setBatteryMode",    xform = function(args) return mode_values[args.mode] or "1" end },
  { cap = caps.forceCharge,    cmd = "on",        topic = "forceCharge",       payload = "enable" },
  { cap = caps.forceCharge,    cmd = "off",       topic = "forceCharge",       payload = "disable" },
  { cap = caps.forceExport,    cmd = "on",        topic = "forceExport",       payload = "enable" },
  { cap = caps.forceExport,    cmd = "off",       topic = "forceExport",       payload = "disable" },
  { cap = caps.dischargeRate,  cmd = "setRate",   topic = "setDischargeRate",  xform = function(args) return tostring(args.rate) end },
  { cap = caps.targetSoc,      cmd = "setLevel",  topic = "setChargeTarget",   xform = function(args) return tostring(args.level) end },
  { cap = caps.batteryReserve, cmd = "setLevel",  topic = "setBatteryReserve", xform = function(args) return tostring(args.level) end },

  -- schedule component
  { cap = caps.chargeSchedule,    cmd = "enable",  topic = "enableChargeSchedule",    payload = "enable" },
  { cap = caps.chargeSchedule,    cmd = "disable", topic = "enableChargeSchedule",    payload = "disable" },
  { cap = caps.dischargeSchedule, cmd = "enable",  topic = "enableDischargeSchedule", payload = "enable" },
  { cap = caps.dischargeSchedule, cmd = "disable", topic = "enableDischargeSchedule", payload = "disable" },

  -- pause schedule
  { cap = caps.pauseSchedule, cmd = "setPauseMode",  topic = "setBatteryPauseMode", xform = function(args) return args.mode end },
  { cap = caps.pauseSchedule, cmd = "setPauseStart", topic = "setPauseStart",        xform = function(args) return args.time end },
  { cap = caps.pauseSchedule, cmd = "setPauseEnd",   topic = "setPauseEnd",          xform = function(args) return args.time end },
}

-- Build capability_handlers table for the Driver constructor
-- get_client: function that returns the current MQTT client (or nil)
function M.build_handlers(get_client)
  local handlers = {}
  for _, entry in ipairs(command_map) do
    local cap_id = entry.cap.ID
    local cmd_name = entry.cmd

    if not handlers[cap_id] then
      handlers[cap_id] = {}
    end

    handlers[cap_id][cmd_name] = function(driver, device, command)
      local serial = device.preferences.inverterSerial
      if not serial or serial == "" then
        log.warn("Inverter serial not configured, cannot send command")
        return
      end

      local topic = "GivEnergy/control/" .. serial .. "/" .. entry.topic
      local payload
      if entry.payload then
        payload = entry.payload
      elseif entry.xform then
        payload = entry.xform(command.args)
      else
        log.warn("No payload or transform for command:", entry.topic)
        return
      end

      local client = get_client()
      if client then
        log.info("Publishing:", topic, "=", payload)
        client:publish{ topic = topic, payload = tostring(payload), qos = 1 }
      else
        log.warn("MQTT client not connected, cannot publish to:", topic)
      end
    end
  end
  return handlers
end

return M

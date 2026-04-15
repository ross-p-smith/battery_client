local log = require "log"
local caps = require "capabilities_ref"

local M = {}

-- Transform functions
local transforms = {
  integer = function(val)
    local n = tonumber(val)
    return n and math.floor(n) or nil
  end,
  number = function(val)
    return tonumber(val)
  end,
  string = function(val)
    return val
  end,
  enable_disable = function(val)
    local lower = string.lower(tostring(val))
    if lower == "enable" or lower == "true" or lower == "1" then
      return "on"
    else
      return "off"
    end
  end,
}

-- Routing table: topic path suffix -> component + capability + attribute + transform + unit
local routing_table = {
  -- main (Battery) component
  ["Power/Power/SOC"]             = { comp = "main", cap = "battery", attr = "battery", xform = "integer" },
  ["Power/Power/Battery_Power"]   = { comp = "main", cap = "powerMeter", attr = "power", xform = "number", unit = "W" },
  ["Power/Power/Battery_Voltage"] = { comp = "main", cap = "voltageMeasurement", attr = "voltage", xform = "number", unit = "V" },

  -- grid component
  ["Power/Power/Grid_Power"]                  = { comp = "grid", cap = "powerMeter", attr = "power", xform = "number", unit = "W" },
  ["Power/Power/Grid_Voltage"]                = { comp = "grid", cap = "voltageMeasurement", attr = "voltage", xform = "number", unit = "V" },
  ["Energy/Today/Import_Energy_Today_kWh"]    = { comp = "grid", cap = "energyMeter", attr = "energy", xform = "number", unit = "kWh" },

  -- house component
  ["Power/Power/Load_Power"]                  = { comp = "house", cap = "powerMeter", attr = "power", xform = "number", unit = "W" },
  ["Energy/Today/Load_Energy_Today_kWh"]      = { comp = "house", cap = "energyMeter", attr = "energy", xform = "number", unit = "kWh" },

  -- control component
  ["Control/Battery_Charge_Rate"]    = { comp = "control", cap = "switchLevel", attr = "level", xform = "integer" },
  ["Control/Battery_Discharge_Rate"] = { comp = "control", cap = "dischargeRate", attr = "rate", xform = "integer" },
  ["Control/Target_SOC"]             = { comp = "control", cap = "targetSoc", attr = "level", xform = "integer" },
  ["Control/Battery_Power_Reserve"]  = { comp = "control", cap = "batteryReserve", attr = "level", xform = "integer" },
  ["Control/Mode"]                   = { comp = "control", cap = "mode", attr = "mode", xform = "string" },
  ["Control/Force_Charge"]           = { comp = "control", cap = "forceCharge", attr = "switch", xform = "enable_disable" },
  ["Control/Force_Export"]           = { comp = "control", cap = "forceExport", attr = "switch", xform = "enable_disable" },

  -- schedule component
  ["Control/Enable_Charge_Schedule"]    = { comp = "schedule", cap = "chargeSchedule", attr = "enabled", xform = "enable_disable" },
  ["Control/Enable_Discharge_Schedule"] = { comp = "schedule", cap = "dischargeSchedule", attr = "enabled", xform = "enable_disable" },

  -- pause schedule
  ["Control/Battery_pause_mode"]          = { comp = "schedule", cap = "pauseSchedule", attr = "pauseMode", xform = "string" },
  ["Control/Battery_pause_start_time_slot"] = { comp = "schedule", cap = "pauseSchedule", attr = "pauseStart", xform = "string" },
  ["Control/Battery_pause_end_time_slot"]   = { comp = "schedule", cap = "pauseSchedule", attr = "pauseEnd", xform = "string" },

  -- inverter component
  ["{serial}/Invertor_Temperature"]                      = { comp = "inverter", cap = "temperatureMeasurement", attr = "temperature", xform = "number", unit = "C" },
  ["Energy/Today/Export_Energy_Today_kWh"]               = { comp = "inverter", cap = "energyStats", attr = "exportEnergy", xform = "number" },
  ["Energy/Today/Self_Consumption_Energy_Today_kWh"]     = { comp = "inverter", cap = "energyStats", attr = "selfConsumption", xform = "number" },
  ["Energy/Today/Battery_Throughput_Today_kWh"]          = { comp = "inverter", cap = "energyStats", attr = "batteryThroughput", xform = "number" },
}

-- Route an incoming MQTT message to the correct SmartThings component capability
function M.route_message(device, topic, payload)
  -- Strip prefix: "GivEnergy/{serial}/" -> remaining path
  local path = topic:match("^GivEnergy/[^/]+/(.+)$")
  if not path then
    log.debug("Ignoring non-GivEnergy topic:", topic)
    return
  end

  -- Handle inverter temp topic (contains serial twice): GivEnergy/{serial}/{serial}/Invertor_Temperature
  local serial = device.preferences.inverterSerial
  if serial and serial ~= "" then
    path = path:gsub("^" .. serial .. "/", "{serial}/")
  end

  local route = routing_table[path]
  if not route then
    log.debug("No route for topic path:", path)
    return
  end

  local xform_fn = transforms[route.xform]
  if not xform_fn then
    log.warn("Unknown transform:", route.xform)
    return
  end

  local value = xform_fn(payload)
  if value == nil then
    log.warn("Transform returned nil for:", path, payload)
    return
  end

  local cap = caps[route.cap]
  if not cap then
    log.warn("Unknown capability:", route.cap)
    return
  end

  local event
  if route.unit then
    event = cap[route.attr]({value = value, unit = route.unit})
  else
    event = cap[route.attr](value)
  end

  local component = device.profile.components[route.comp]
  if component then
    device:emit_component_event(component, event)
  else
    log.warn("Unknown component:", route.comp)
  end
end

return M

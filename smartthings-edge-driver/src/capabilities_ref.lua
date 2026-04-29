local capabilities = require "st.capabilities"

local caps = {}

-- Standard capabilities
caps.battery = capabilities.battery
caps.powerMeter = capabilities.powerMeter
caps.energyMeter = capabilities.energyMeter
caps.switchLevel = capabilities.switchLevel
caps.mode = capabilities.mode
caps.refresh = capabilities.refresh

-- Custom capabilities (namespace substituted by deploy script)
caps.mqttStatus = capabilities["<ns>.mqttStatus"]
caps.forceCharge = capabilities["<ns>.forceCharge"]
caps.forceExport = capabilities["<ns>.forceExport"]
caps.dischargeRate = capabilities["<ns>.dischargeRate"]
caps.targetSoc = capabilities["<ns>.targetSoc"]
caps.batteryReserve = capabilities["<ns>.batteryReserve"]

caps.inverterInfo = capabilities["<ns>.inverterInfo"]
caps.energyStats = capabilities["<ns>.energyStats"]
caps.pauseSchedule = capabilities["<ns>.pauseSchedule"]

return caps

local capabilities = require "st.capabilities"

local caps = {}

-- Standard capabilities
caps.battery = capabilities.battery
caps.powerMeter = capabilities.powerMeter
caps.energyMeter = capabilities.energyMeter
caps.temperatureMeasurement = capabilities.temperatureMeasurement
caps.voltageMeasurement = capabilities.voltageMeasurement
caps.switchLevel = capabilities.switchLevel
caps.mode = capabilities.mode
caps.refresh = capabilities.refresh
caps.healthCheck = capabilities.healthCheck

-- Custom capabilities (namespace filled after registration)
caps.mqttStatus = capabilities["instantheart30774.mqttStatus"]
caps.forceCharge = capabilities["instantheart30774.forceCharge"]
caps.forceExport = capabilities["instantheart30774.forceExport"]
caps.dischargeRate = capabilities["instantheart30774.dischargeRate"]
caps.targetSoc = capabilities["instantheart30774.targetSoc"]
caps.batteryReserve = capabilities["instantheart30774.batteryReserve"]
caps.chargeSchedule = capabilities["instantheart30774.chargeSchedule"]
caps.dischargeSchedule = capabilities["instantheart30774.dischargeSchedule"]
caps.inverterInfo = capabilities["instantheart30774.inverterInfo"]
caps.energyStats = capabilities["instantheart30774.energyStats"]

return caps

std = "lua53"
max_line_length = 170

-- SmartThings Edge globals provided by the runtime
globals = { "thisDriver" }
read_globals = { "cosock" }

-- SmartThings lifecycle callbacks require fixed signatures; suppress unused args
unused_args = false

-- Vendored luamqtt library — exclude from linting
exclude_files = { "src/mqtt/**" }

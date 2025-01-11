module "hello-lambda-function" {
  source  = "terraform-aws-modules/lambda/aws"
  version = ">= 2.24.0"

  architectures = compact([var.architecture])
  function_name = var.name
  handler       = "index.handler"
  runtime       = var.runtime

  create_package         = false
  local_existing_package = "${path.module}/../../build/function.zip"

  memory_size = 512
  timeout     = 60

  layers = compact([
    var.collector_layer_arn,
    var.sdk_layer_arn
  ])

environment_variables = {
    AWS_LAMBDA_EXEC_WRAPPER     = "/opt/otel-handler"
    #OTEL_TRACES_EXPORTER        = "logging"
    OTEL_METRICS_EXPORTER       = "none"
    OTEL_LOGS_EXPORTER          = "none"
    #OTEL_LOG_LEVEL              = "DEBUG"
    OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318/"
    OTEL_TRACES_SAMPLER         = "always_on"
    OPENTELEMETRY_COLLECTOR_CONFIG_URI  = "file:/var/task/collector-config.yaml"
    HONEYCOMB_API_KEY           = "b8ueofmeEUe9xeZD7xDKB6B"
    OTLP_DUPLICATE_FACTOR       = 10000
  }

  tracing_mode = var.tracing_mode

  attach_policy_statements = true
  policy_statements = {
    s3 = {
      effect = "Allow"
      actions = [
        "s3:ListAllMyBuckets"
      ]
      resources = [
        "*"
      ]
    }
  }
}

module "api-gateway" {
  source = "../../../../../utils/terraform/api-gateway-proxy"

  name                = var.name
  function_name       = module.hello-lambda-function.lambda_function_name
  function_invoke_arn = module.hello-lambda-function.lambda_function_invoke_arn
  enable_xray_tracing = var.tracing_mode == "Active"
}

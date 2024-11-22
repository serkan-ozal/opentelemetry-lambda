module "hello-lambda-function" {
  source  = "terraform-aws-modules/lambda/aws"
  version = ">= 2.24.0"

  architectures = compact([var.architecture])
  function_name = var.name
  handler       = "index.handler"
  runtime       = "nodejs18.x"

  create_package         = false
  local_existing_package = "${path.module}/../../build/function.zip"

  memory_size = 512
  timeout     = 20

  layers = compact([
    var.collector_layer_arn,
    var.sdk_layer_arn
  ])

  environment_variables = {
    AWS_LAMBDA_EXEC_WRAPPER     = "/opt/otel-handler"
    //OTEL_TRACES_EXPORTER        = "logging"
    //OTEL_METRICS_EXPORTER       = "logging"
    //OTEL_LOG_LEVEL              = "DEBUG"
    //OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318/"
    OTEL_TRACES_SAMPLER         = "always_on"
    ////////////////////////////////////////////////////
    //OTEL_METRICS_EXPORTER       = "none"
    //OTEL_LOGS_EXPORTER          = "none"
    //OTEL_EXPORTER_OTLP_PROTOCOL = "grpc"
    //OTEL_EXPORTER_OTLP_ENDPOINT = "https://api.honeycomb.io:443"
    //OTEL_EXPORTER_OTLP_HEADERS  = "x-honeycomb-team=b8ueofmeEUe9xeZD7xDKB6B"
    //OTEL_EXPORTER_OTLP_ENDPOINT = "https://otel-collector-staging.tracing.catchpoint.net:443"
    //OTEL_EXPORTER_OTLP_HEADERS  = "x-catchpoint-api-key=ce01c09b-9dda-45e2-a08d-f61d0f60e985"
    //OTEL_LAMBDA_MODULE_TRACE_ENABLE = "false"
    //OTEL_LAMBDA_MODULE_TRACE_MIN_DURATION = 10
    ////////////////////////////////////////////////////
    OTEL_TRACED_EXPORTER                    = "logging"
    OTEL_METRICS_EXPORTER                   = "logging"
    OTEL_NODE_PROFILER_ENABLE               = "false"
    OTEL_NODE_PROFILER_SAMPLING_INTERVAL    = "10"
    OTEL_NODE_PROFILER_S3_BUCKET_NAME       = "sozal-otel"
    OTEL_LAMBDA_MODULE_TRACE_ENABLE         = "false"
    OTEL_NODE_REQUIRE_CACHE_S3_BUCKET_NAME  = "sozal-otel"
  }

  tracing_mode = var.tracing_mode

  attach_policy_statements = true
  policy_statements = {
    s3 = {
      effect = "Allow"
      actions = [
        "s3:*"
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


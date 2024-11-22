variable "name" {
  type        = string
  description = "Name of created function and API Gateway"
  default     = "hello-nodejs-awssdk"
}

variable "collector_layer_arn" {
  type        = string
  description = "ARN for the Lambda layer containing the OpenTelemetry collector extension"
  // TODO(anuraaga): Add default when a public layer is published.
#  default     = "arn:aws:lambda:us-west-2:184161586896:layer:opentelemetry-collector-amd64-0_12_0:1"
  default     = "arn:aws:lambda:us-west-2:482514484979:layer:otel-collector:9"
}

variable "sdk_layer_arn" {
  type        = string
  description = "ARN for the Lambda layer containing the OpenTelemetry NodeJS Wrapper"
  // TODO(anuraaga): Add default when a public layer is published.
  //default     = "arn:aws:lambda:us-west-2:184161586896:layer:opentelemetry-nodejs-0_11_0:1"
  default       = "arn:aws:lambda:us-west-2:482514484979:layer:otel-node:82"
}

variable "tracing_mode" {
  type        = string
  description = "Lambda function tracing mode"
  default     = "PassThrough"
}

variable "architecture" {
  type        = string
  description = "Lambda function architecture, valid values are arm64 or x86_64"
  default     = "x86_64"
}

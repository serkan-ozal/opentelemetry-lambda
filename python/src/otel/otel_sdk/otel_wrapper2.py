# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
`otel_wrapper.py`

This file serves as a wrapper over the user's Lambda function.

Usage
-----
Patch the reserved `_HANDLER` Lambda environment variable to point to this
file's `otel_wrapper.lambda_handler` property. Do this having saved the original
`_HANDLER` in the `ORIG_HANDLER` environment variable. Doing this makes it so
that **on import of this file, the handler is instrumented**.

Instrumenting any earlier will cause the instrumentation to be lost because the
AWS Service uses `imp.load_module` to import the handler which RELOADS the
module. This is why AwsLambdaInstrumentor cannot be instrumented with the
`opentelemetry-instrument` script.

See more:
https://docs.python.org/3/library/imp.html#imp.load_module

"""


import os
import time
from logging import getLogger
from importlib import import_module

import_start1 = time.perf_counter_ns()
import opentelemetry.trace as trace
import_time1 = (time.perf_counter_ns() - import_start1) // 1_000_000
print(f'Imports-1 took {import_time1} milliseconds')

import_start2 = time.perf_counter_ns()
from opentelemetry.sdk.trace import TracerProvider
import_time2 = (time.perf_counter_ns() - import_start2) // 1_000_000
print(f'Imports-2 took {import_time2} milliseconds')

import_start3 = time.perf_counter_ns()
#from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from exporter.span_exporter import OTLPSpanExporter
import_time3 = (time.perf_counter_ns() - import_start3) // 1_000_000
print(f'Imports-3 took {import_time3} milliseconds')

import_start4 = time.perf_counter_ns()
from opentelemetry.sdk.trace.export import BatchSpanProcessor
import_time4 = (time.perf_counter_ns() - import_start4) // 1_000_000
print(f'Imports-4 took {import_time4} milliseconds')

from opentelemetry import metrics
#from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from exporter.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

import_start5 = time.perf_counter_ns()
from opentelemetry.instrumentation.environment_variables import (
    OTEL_PYTHON_DISABLED_INSTRUMENTATIONS,
)
import_time5 = (time.perf_counter_ns() - import_start5) // 1_000_000
print(f'Imports-5 took {import_time5} milliseconds')

import_start6 = time.perf_counter_ns()
from opentelemetry.instrumentation.aws_lambda import AwsLambdaInstrumentor
import_time6 = (time.perf_counter_ns() - import_start6) // 1_000_000
print(f'Imports-6 took {import_time6} milliseconds')


_logger = getLogger(__name__)


def modify_module_name(module_name):
    """Returns a valid modified module to get imported"""
    return ".".join(module_name.split("/"))


def create_instrumentor(packages_to_exclude, package_name, module_name, class_name):
    if package_name in packages_to_exclude:
        _logger.debug("Instrumentation skipped for library %s", package_name)
        return None

    start = time.perf_counter_ns()
    try:
        module = import_module(module_name)
        clazz = getattr(module, class_name)
        return clazz()
    except:
        return None
    finally:
        end = time.perf_counter_ns()
        passed_time = (end - start) // 1_000_000
        _logger.debug(f'Creation of the instrumentor {module_name}.{class_name} took {passed_time} milliseconds')

def create_and_add_instrumentor(instrumentors, packages_to_exclude, package_name, module_name, class_name):
    instrumentor = create_instrumentor(packages_to_exclude, package_name, module_name, class_name)
    if instrumentor:
        instrumentors.append(instrumentor)


def create_instrumentors():
    instrumentors = []

    packages_to_exclude = os.environ.get(OTEL_PYTHON_DISABLED_INSTRUMENTATIONS, [])
    if isinstance(packages_to_exclude, str):
        packages_to_exclude = packages_to_exclude.split(",")
        # to handle users entering "requests , flask" or "requests, flask" with spaces
        packages_to_exclude = [x.strip() for x in packages_to_exclude]

    instrumentors.append(AwsLambdaInstrumentor())

    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "aiohttp_client",
        "opentelemetry.instrumentation.aiohttp_client", "AioHttpClientInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "asyncpg",
        "opentelemetry.instrumentation.asyncpg", "AsyncPGInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "boto",
        "opentelemetry.instrumentation.boto", "BotoInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "botocore",
        "opentelemetry.instrumentation.botocore", "BotocoreInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "boto3sqs",
        "opentelemetry.instrumentation.boto3sqs", "Boto3SQSInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "celery",
        "opentelemetry.instrumentation.celery", "CeleryInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "django",
        "opentelemetry.instrumentation.django", "DjangoInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "elasticsearch",
        "opentelemetry.instrumentation.elasticsearch", "ElasticsearchInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "falcon",
        "opentelemetry.instrumentation.falcon", "FalconInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "fastapi",
        "opentelemetry.instrumentation.fastapi", "FastAPIInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "flask",
        "opentelemetry.instrumentation.flask", "FlaskInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "grpc",
        "opentelemetry.instrumentation.grpc", "GrpcAioInstrumentorClient"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "grpc",
        "opentelemetry.instrumentation.grpc", "GrpcAioInstrumentorServer"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "grpc",
        "opentelemetry.instrumentation.grpc", "GrpcInstrumentorClient"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "grpc",
        "opentelemetry.instrumentation.grpc", "GrpcInstrumentorServer"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "jinja2",
        "opentelemetry.instrumentation.jinja2", "Jinja2Instrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "mysql",
        "opentelemetry.instrumentation.mysql", "MySQLInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "psycopg2",
        "opentelemetry.instrumentation.psycopg2", "Psycopg2Instrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "pymemcache",
        "opentelemetry.instrumentation.pymemcache", "PymemcacheInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "pymongo",
        "opentelemetry.instrumentation.pymongo", "PymongoInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "pymysql",
        "opentelemetry.instrumentation.pymysql", "PyMySQLInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "pyramid",
        "opentelemetry.instrumentation.pyramid", "PyramidInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "redis",
        "opentelemetry.instrumentation.redis", "RedisInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "requests",
        "opentelemetry.instrumentation.requests", "RequestsInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "sqlalchemy",
        "opentelemetry.instrumentation.sqlalchemy", "SQLAlchemyInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "sqlite3",
        "opentelemetry.instrumentation.sqlite3", "SQLite3Instrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "starlette",
        "opentelemetry.instrumentation.starlette", "StarletteInstrumentor"
    )
    create_and_add_instrumentor(
        instrumentors, packages_to_exclude, "tornado",
        "opentelemetry.instrumentation.tornado", "TornadoInstrumentor"
    )

    return instrumentors


class HandlerError(Exception):
    pass


# Init trace provider
########################################################################
traceProvider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter())
traceProvider.add_span_processor(processor)
trace.set_tracer_provider(traceProvider)
########################################################################

# Init metric provider
########################################################################
metricReader = PeriodicExportingMetricReader(OTLPMetricExporter())
meterProvider = MeterProvider(metric_readers=[metricReader])
metrics.set_meter_provider(meterProvider)
########################################################################

# Init instrumentors
########################################################################
instrumentors = create_instrumentors()
for i in instrumentors:
    start = time.perf_counter_ns()
    i.instrument()
    end = time.perf_counter_ns()
    passed_time = (end - start) // 1_000_000
    instrumentor_name = type(i).__name__
    _logger.debug(f'Completed running instrumentor {instrumentor_name} in {passed_time} milliseconds')
########################################################################

path = os.environ.get("ORIG_HANDLER")

if path is None:
    raise HandlerError("ORIG_HANDLER is not defined.")

try:
    (mod_name, handler_name) = path.rsplit(".", 1)
except ValueError as e:
    raise HandlerError("Bad path '{}' for ORIG_HANDLER: {}".format(path, str(e)))

modified_mod_name = modify_module_name(mod_name)
handler_module = import_module(modified_mod_name)
lambda_handler = getattr(handler_module, handler_name)

import {
  AsyncLocalStorageContextManager,
} from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  PROPAGATOR_FACTORY,
  SDKRegistrationConfig,
} from '@opentelemetry/sdk-trace-base';
import {
  NodeTracerConfig,
} from '@opentelemetry/sdk-trace-node';

export class LambdaTracerProvider extends BasicTracerProvider {
  protected static override readonly _registeredPropagators = new Map<
    string,
    PROPAGATOR_FACTORY
  >([
    ...BasicTracerProvider._registeredPropagators,
  ]);

  constructor(config: NodeTracerConfig = {}) {
    super(config);
  }

  override register(config: SDKRegistrationConfig = {}): void {
    if (config.contextManager === undefined) {
      config.contextManager = new AsyncLocalStorageContextManager();
      config.contextManager.enable();
    }

    super.register(config);
  }
}

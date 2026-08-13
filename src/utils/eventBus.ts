import { EventEmitter } from 'events';

class SharedEventBus extends EventEmitter {}

export const eventBus = new SharedEventBus();

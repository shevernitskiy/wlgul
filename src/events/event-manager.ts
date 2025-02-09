export type EventHandler = {
  success: (topic: string, text: string) => void;
  fail: (topic: string, text?: string) => void;
  progress: (topic: string, text: string) => void;
  log: (topic: string, text: string) => void;
};

export type Event = keyof EventHandler;
export type Emitter = (event: Event, text: string) => void;

export class EventManager {
  private handlers: EventHandler[];

  constructor(options: {
    handlers: EventHandler[];
  }) {
    this.handlers = options.handlers;
  }

  emit(topic: string, event: Event, text: string): void {
    for (const handler of this.handlers) {
      switch (event) {
        case "success":
          handler.success(topic, text);
          break;
        case "fail":
          handler.fail(topic, text);
          break;
        case "progress":
          handler.progress(topic, text);
          break;
        case "log":
          handler.log(topic, text);
          break;
        default:
          throw new Error(`Unknown event: ${event}`);
      }
    }
  }
}

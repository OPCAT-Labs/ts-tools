import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as zmq from 'zeromq';
import { ConfigService } from '@nestjs/config';

const monitorEventList = [
  'connect',
  'connect_delay',
  'connect_retry',
  'listen',
  'bind_error',
  'accept',
  'accept_error',
  'close',
  'close_error',
  'disconnect',
];

@Injectable()
export class ZmqService implements OnModuleDestroy {
  private readonly logger = new Logger(ZmqService.name);
  private readonly callBackQueueRawTx: any[];
  private readonly callBackQueueHashBlock: any[];
  private sock: zmq.Subscriber;
  private readonly zmqServerList: string[];
  private running = false;

  constructor(private readonly configService: ConfigService) {
    this.callBackQueueRawTx = [];
    this.callBackQueueHashBlock = [];
    const _zmqServer = this.configService.get('zmqServer');
    const zmqSubEventList = this.configService.get('zmqSubEventList');
    const zmqDebug = this.configService.get('zmqDebug');
    const zmqServerList = _zmqServer.split(',');

    // Create a subscriber socket
    this.sock = new zmq.Subscriber();

    console.log('zmqServer', zmqServerList);
    // Connect to all ZMQ servers
    for (const zmqServer of zmqServerList) {
      if (zmqServer.trim()) {
        this.sock.connect(zmqServer);

        // Subscribe to all events in the list
        for (const zmqSubEvent of zmqSubEventList) {
          this.sock.subscribe(zmqSubEvent);
        }
      }
    }

    // Start listening for messages
    this.running = true;
    this.receiveMessages();
    if (zmqDebug) {
      this.logger.debug('ZMQ service initialized with debug mode');
      this.logger.debug(`Connected to ZMQ servers: ${zmqServerList.filter((s) => s.trim()).join(', ')}`);
      this.logger.debug(`Subscribed to events: ${zmqSubEventList.join(', ')}`);
    }
  }

  async onModuleDestroy() {
    this.running = false;
    if (this.sock) {
      for (let index = 0; index < this.zmqServerList.length; index++) {
        await this.sock.disconnect(this.zmqServerList[index]);
      }
      await this.sock.close();
    }
  }

  monitorHandler(event: any, event_value: any, event_endpoint_addr: any, ex: any) {
    this.logger.debug(`monitorHandler ${event} ${event_value} ${event_endpoint_addr} ${ex}`);
  }

  monitorErrorHandler(error: any) {
    this.logger.debug(`monitorErrorHandler ${error}`);
  }

  onRawTx(func: any) {
    this.callBackQueueRawTx.push(func);
  }

  onHashBlock(func: any) {
    this.callBackQueueHashBlock.push(func);
  }

  private static mapCallbackByQueue(message: Buffer, queue: any[]) {
    for (const callback of queue) {
      try {
        callback(message);
      } catch (e) {}
    }
  }

  private eventHandlerRawTx(message: Buffer) {
    ZmqService.mapCallbackByQueue(message, this.callBackQueueRawTx);
  }

  private eventHandlerHashBlock(message: Buffer) {
    ZmqService.mapCallbackByQueue(message, this.callBackQueueHashBlock);
  }

  private async receiveMessages() {
    try {
      // Process messages in a loop
      while (this.running) {
        const [topic, message] = await this.sock.receive();
        const topicStr = topic.toString();

        if (topicStr === 'rawtx') {
          this.eventHandlerRawTx(message);
        }
        if (topicStr === 'hashblock') {
          this.eventHandlerHashBlock(message);
        }
      }
    } catch (error) {
      if (this.running) {
        this.logger.error(`Error in ZMQ message processing: ${error.message}`);
        // Restart the message loop if we're still supposed to be running
        setTimeout(() => this.receiveMessages(), 1000);
      }
    }
  }
}

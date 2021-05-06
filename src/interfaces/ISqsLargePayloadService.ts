import { SQS } from 'aws-sdk';

export interface ISqsLargePayloadService {
    SendMessage<T>(body: T, queueName?: string): Promise<SQS.SendMessageResult>;
    SendMessage(queueName: string, body?: string): Promise<any>;
    ProcessReceivedMessage(event: string): Promise<string>;
}

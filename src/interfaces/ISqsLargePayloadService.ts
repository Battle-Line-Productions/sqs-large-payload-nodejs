import { SQSEvent } from 'aws-lambda';

export interface ISqsLargePayloadService {
    SendMessage(queueName: string, body: string): Promise<any>;
    ProcessReceivedMessage(event: SQSEvent);
}

import AWS from 'aws-sdk';
import { ISqsLargePayloadService, ISqsServiceOptions } from '../../src/interfaces';
import { SqsLargePayloadService } from '../../src/services/sqs.service';
import { nanoid } from 'nanoid';


describe('src/services/sqs.service.ts', () => {
    let mockUrl: string, mockGetQueueUrlMethod, sut: ISqsLargePayloadService, serviceOptions: ISqsServiceOptions, mockSendMessageMethod, mockS3UploadMethod, s3BucketResponse;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mock('aws-sdk');

        mockUrl = 'https://queueurl.aws.com';
        mockGetQueueUrlMethod = jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({ QueueUrl: mockUrl })
        });

        mockSendMessageMethod = jest.fn().mockReturnValue({ promise: jest.fn() });

        AWS.SQS = jest.fn().mockImplementation(() => {
            return {
                getQueueUrl: mockGetQueueUrlMethod,
                sendMessage: mockSendMessageMethod
            };
        });

        s3BucketResponse = {
            Key: '123456789.json',
            Location: '/'
        };

        mockS3UploadMethod = jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue(s3BucketResponse) });

        AWS.S3 = jest.fn().mockImplementation(() => {
            return {
                upload: mockS3UploadMethod
            };
        });

        nanoid = jest.fn().mockImplementation(() => {
            return '123456789';
        });

        serviceOptions = {
            region: 'us-east-2',
            s3BucketName: 'testBucket',
            s3EndpointUrl: 'https://s3.url.com'
        };

        sut = new SqsLargePayloadService(serviceOptions);
    });

    describe('When sending a message to SQS', () => {
        describe('and the message is below threshold size', () => {
            test('message is successfully sent to SQS while passing in queueName', async () => {
                expect.hasAssertions();

                const expected = {
                    QueueUrl: 'https://queueurl.aws.com',
                    MessageBody: JSON.stringify({ message: 'MockStringBody' })
                };

                await sut.SendMessage('MockStringBody', 'queueName');

                expect(mockSendMessageMethod).toHaveBeenCalledTimes(1);
                expect(mockSendMessageMethod).toHaveBeenCalledWith(expected);
            });

            test('message is successfully sent to SQS while not passing in queueName', async () => {
                expect.hasAssertions();

                serviceOptions = {
                    region: 'us-east-2',
                    s3BucketName: 'testBucket',
                    s3EndpointUrl: 'https://s3.url.com',
                    queueName: 'name'
                };

                sut = new SqsLargePayloadService(serviceOptions);

                const expected = {
                    QueueUrl: 'https://queueurl.aws.com',
                    MessageBody: JSON.stringify({ message: 'MockStringBody' })
                };

                await sut.SendMessage('MockStringBody');

                expect(mockSendMessageMethod).toHaveBeenCalledTimes(1);
                expect(mockSendMessageMethod).toHaveBeenCalledWith(expected);
            });

            test('message is successfully sent to SQS with custom message size', async () => {
                expect.hasAssertions();

                serviceOptions = {
                    region: 'us-east-2',
                    s3BucketName: 'testBucket',
                    s3EndpointUrl: 'https://s3.url.com',
                    queueName: 'name',
                    maxMessageSize: 2222222
                };

                sut = new SqsLargePayloadService(serviceOptions);

                const expected = {
                    QueueUrl: 'https://queueurl.aws.com',
                    MessageBody: JSON.stringify({ message: 'MockStringBody' })
                };

                await sut.SendMessage('MockStringBody');

                expect(mockSendMessageMethod).toHaveBeenCalledTimes(1);
                expect(mockSendMessageMethod).toHaveBeenCalledWith(expected);
            });
        });

        describe('and the message is above threshold size', () => {
            test('message is successfully sent to s3 and then to the queue', async () => {
                expect.hasAssertions();

                serviceOptions = {
                    region: 'us-east-2',
                    s3BucketName: 'testBucket',
                    s3EndpointUrl: 'https://s3.url.com',
                    queueName: 'name',
                    maxMessageSize: 1
                };

                sut = new SqsLargePayloadService(serviceOptions);

                const s3Expected = {
                    Bucket: 'testBucket',
                    Body: JSON.stringify({ message: 'MockStringBody' }),
                    Key: '123456789.json'
                };

                const sqsExpected = {
                    QueueUrl: 'https://queueurl.aws.com',
                    MessageBody: JSON.stringify({
                        S3Payload: {
                            Id: '123456789.json',
                            Key: '123456789.json',
                            Location: '/'
                        }
                    })
                };

                await sut.SendMessage('MockStringBody');

                expect(mockS3UploadMethod).toHaveBeenCalledTimes(1);
                expect(mockS3UploadMethod).toHaveBeenCalledWith(s3Expected)
                expect(mockSendMessageMethod).toHaveBeenCalledTimes(1);
                expect(mockSendMessageMethod).toHaveBeenCalledWith(sqsExpected);
            });
        });
    });

    describe('When getting a queue URL for SQS Queue', () => {
        test('Returns a Queue Url when queue name is passed in', async () => {
            expect.hasAssertions;

            const result = await sut.GetQueueUrl('queueName');

            expect(result).toEqual(mockUrl);
        });

        test('QueueUrl is empty when queue name is passed in', async () => {
            expect.hasAssertions;

            mockGetQueueUrlMethod = jest.fn().mockReturnValue({
                promise: jest.fn().mockResolvedValue({ QueueUrl: '' })
            });

            AWS.SQS = jest.fn().mockImplementation(() => {
                return {
                    getQueueUrl: mockGetQueueUrlMethod
                }
            });

            sut = new SqsLargePayloadService({ region: 'us-east-2', s3BucketName: 'testBucket', s3EndpointUrl: 'https://s3.url.com' });

            await expect(sut.GetQueueUrl('QueueName')).rejects.toEqual(new Error(`Unable to determine Queue url from provided name of QueueName`));
        });

        test('QueueUrl is empty', async () => {
            expect.hasAssertions;

            sut = new SqsLargePayloadService({ region: 'us-east-2', s3BucketName: 'testBucket', s3EndpointUrl: 'https://s3.url.com' });

            await expect(sut.GetQueueUrl()).rejects.toEqual(new Error(`Missing Queue Name`));
        });
    });
});
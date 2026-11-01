import axios from 'axios';
import { MPesaService } from '../../../src/services/mobile-money/mpesa.service';

jest.mock('axios');
jest.mock('../../../src/utils/logger.util', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MPesaService.b2cPayment', () => {
  const service = new MPesaService({
    consumerKey: 'key',
    consumerSecret: 'secret',
    environment: 'sandbox',
    businessShortCode: '600000',
    passkey: 'pass',
    callbackUrl: 'https://example.com/mpesa',
  });

  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  it('sends the B2C occasion under Occassion as required by Daraja', async () => {
    mockedAxios.get.mockResolvedValue({ data: { access_token: 'token' } });
    mockedAxios.post.mockResolvedValue({
      data: {
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully.',
      },
    });

    await service.b2cPayment('+254712345678', 10, 'Cash out');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [, body] = mockedAxios.post.mock.calls[0];
    expect(body).toEqual(
      expect.objectContaining({
        Occassion: 'Withdrawal',
      })
    );
    expect(body).not.toHaveProperty('Occasion');
    expect(String((body as { Occassion: string }).Occassion).length).toBeLessThanOrEqual(100);
  });
});

import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { WalletService } from './wallet.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Minimal exec()-able query mock helper.
const execable = (value: any) => ({ exec: jest.fn().mockResolvedValue(value), lean: () => execable(value) });

function buildModels() {
  const walletModel: any = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const ledgerModel: any = jest.fn().mockImplementation((doc: any) => ({ ...doc, save: jest.fn().mockResolvedValue(doc) }));
  ledgerModel.updateOne = jest.fn().mockReturnValue(execable({}));
  ledgerModel.find = jest.fn();
  ledgerModel.countDocuments = jest.fn();
  const payoutRequestModel: any = jest.fn().mockImplementation((doc: any) => ({
    ...doc,
    _id: 'payout-1',
    save: jest.fn().mockResolvedValue({ ...doc, _id: 'payout-1' }),
  }));
  payoutRequestModel.findByIdAndUpdate = jest.fn().mockReturnValue(execable({}));
  payoutRequestModel.find = jest.fn();
  return { walletModel, ledgerModel, payoutRequestModel };
}

function configureMtn() {
  process.env.MTN_MOMO_DISBURSEMENT_API_KEY = 'dis-key';
  process.env.MTN_MOMO_DISBURSEMENT_USER_ID = 'dis-user';
  process.env.MTN_MOMO_DISBURSEMENT_API_SECRET = 'dis-secret';
  process.env.MTN_MOMO_BASE_URL = 'https://sandbox.example.mtn';
}

// A valid ObjectId-shaped hex string (24 chars).
const USER_ID = '6a0b828384bd8fb2fa9cabce';

describe('WalletService withdrawal', () => {
  let models: ReturnType<typeof buildModels>;
  let service: WalletService;

  beforeEach(() => {
    configureMtn();
    models = buildModels();
    service = new WalletService(models.walletModel, models.ledgerModel, models.payoutRequestModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    delete process.env.MTN_MOMO_DISBURSEMENT_API_KEY;
    delete process.env.MTN_MOMO_DISBURSEMENT_USER_ID;
    delete process.env.MTN_MOMO_DISBURSEMENT_API_SECRET;
    delete process.env.MTN_MOMO_BASE_URL;
  });

  it('debits atomically and sets the payout to PROCESSING (not COMPLETED) on success', async () => {
    // Atomic debit returns the post-debit wallet.
    models.walletModel.findOneAndUpdate.mockReturnValue(execable({ availableBalance: 3000 }));
    // token, then transfer 202.
    mockedAxios.post
      .mockResolvedValueOnce({ data: { access_token: 'tok', expires_in: 3600 } } as any)
      .mockResolvedValueOnce({ status: 202, data: '' } as any);

    const result = await service.requestWithdrawal(USER_ID, 'SELLER', 2000, '0788123456');

    expect(result.status).toBe('PROCESSING');
    // Atomic debit used a $gte precondition.
    const debitCall = models.walletModel.findOneAndUpdate.mock.calls[0];
    expect(debitCall[0]).toMatchObject({ availableBalance: { $gte: 2000 } });
    expect(debitCall[1].$inc).toMatchObject({ availableBalance: -2000, pendingBalance: 2000 });
    // Payout request was set to PROCESSING.
    const updateCall = models.payoutRequestModel.findByIdAndUpdate.mock.calls[0];
    expect(updateCall[1].$set.status).toBe('PROCESSING');
    expect(updateCall[1].$set.status).not.toBe('COMPLETED');
  });

  it('throws BadRequestException when the atomic debit finds insufficient balance', async () => {
    // No document matched the $gte precondition.
    models.walletModel.findOneAndUpdate.mockReturnValue(execable(null));

    await expect(service.requestWithdrawal(USER_ID, 'SELLER', 2000, '0788123456'))
      .rejects.toBeInstanceOf(BadRequestException);
    // Gateway must never be called when the debit fails.
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('simulates a concurrent withdrawal: the second request fails gracefully', async () => {
    // First debit succeeds, second finds nothing (already drained).
    models.walletModel.findOneAndUpdate
      .mockReturnValueOnce(execable({ availableBalance: 0 }))
      .mockReturnValueOnce(execable(null));
    mockedAxios.post
      .mockResolvedValueOnce({ data: { access_token: 'tok', expires_in: 3600 } } as any)
      .mockResolvedValueOnce({ status: 202, data: '' } as any);

    const first = await service.requestWithdrawal(USER_ID, 'SELLER', 2000, '0788123456');
    expect(first.status).toBe('PROCESSING');

    await expect(service.requestWithdrawal(USER_ID, 'SELLER', 2000, '0788123456'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('reverses the debit when MTN initiation fails', async () => {
    models.walletModel.findOneAndUpdate
      .mockReturnValueOnce(execable({ availableBalance: 1000 })) // debit
      .mockReturnValueOnce(execable({})); // reversal
    mockedAxios.post
      .mockResolvedValueOnce({ data: { access_token: 'tok', expires_in: 3600 } } as any)
      .mockRejectedValueOnce(new Error('mtn down'));

    await expect(service.requestWithdrawal(USER_ID, 'SELLER', 2000, '0788123456'))
      .rejects.toBeInstanceOf(BadRequestException);

    // Second wallet update reverses the debit.
    const reversal = models.walletModel.findOneAndUpdate.mock.calls[1];
    expect(reversal[1].$inc).toMatchObject({ availableBalance: 2000, pendingBalance: -2000 });
  });
});

describe('WalletService.addWithdrawalStatusPoller', () => {
  let models: ReturnType<typeof buildModels>;
  let service: WalletService;

  beforeEach(() => {
    configureMtn();
    jest.useFakeTimers();
    models = buildModels();
    service = new WalletService(models.walletModel, models.ledgerModel, models.payoutRequestModel);
    models.walletModel.findOneAndUpdate.mockReturnValue(execable({}));
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('settles to COMPLETED and decrements pendingBalance on SUCCESSFUL', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'SUCCESSFUL' } } as any);
    mockedAxios.post.mockResolvedValue({ data: { access_token: 'tok', expires_in: 3600 } } as any);

    service.addWithdrawalStatusPoller('ref-1', 'payout-1', '6a0b828384bd8fb2fa9cabce', 2000);
    await jest.advanceTimersByTimeAsync(30_000);
    await Promise.resolve();

    const walletInc = models.walletModel.findOneAndUpdate.mock.calls.find(
      (c) => c[1]?.$inc?.totalWithdrawn !== undefined,
    );
    expect(walletInc).toBeDefined();
    expect(walletInc![1].$inc).toMatchObject({ pendingBalance: -2000, totalWithdrawn: 2000 });

    const payoutUpdate = models.payoutRequestModel.findByIdAndUpdate.mock.calls.find(
      (c) => c[1]?.$set?.status === 'COMPLETED',
    );
    expect(payoutUpdate).toBeDefined();
  });

  it('reverses the balance on a FAILED transfer', async () => {
    mockedAxios.get.mockResolvedValue({ data: { status: 'FAILED' } } as any);
    mockedAxios.post.mockResolvedValue({ data: { access_token: 'tok', expires_in: 3600 } } as any);

    service.addWithdrawalStatusPoller('ref-2', 'payout-2', '6a0b828384bd8fb2fa9cabce', 2000);
    await jest.advanceTimersByTimeAsync(30_000);
    await Promise.resolve();

    const reversal = models.walletModel.findOneAndUpdate.mock.calls.find(
      (c) => c[1]?.$inc?.availableBalance === 2000,
    );
    expect(reversal).toBeDefined();
    expect(reversal![1].$inc).toMatchObject({ availableBalance: 2000, pendingBalance: -2000 });

    const payoutUpdate = models.payoutRequestModel.findByIdAndUpdate.mock.calls.find(
      (c) => c[1]?.$set?.status === 'FAILED',
    );
    expect(payoutUpdate).toBeDefined();
  });
});

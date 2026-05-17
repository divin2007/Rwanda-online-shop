import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

type ContractDocument = {
  version: string;
  active: boolean;
  publishedAt: Date;
  content: string;
  changelog: string[];
};

const DEFAULT_CONTRACTS: ContractDocument[] = [
  {
    version: '1.0',
    active: false,
    publishedAt: new Date('2025-01-01T00:00:00Z'),
    content: 'Legacy RMF Partner Agreement.',
    changelog: ['Initial public partner terms.'],
  },
  {
    version: '2.0',
    active: false,
    publishedAt: new Date('2025-06-01T00:00:00Z'),
    content: 'Updated RMF Partner Agreement.',
    changelog: ['Added marketplace operating rules.', 'Clarified seller verification requirements.'],
  },
  {
    version: '3.0',
    active: true,
    publishedAt: new Date('2026-04-01T00:00:00Z'),
    content: 'RMF Partner Agreement v3.0.',
    changelog: ['Added contract version tracking.', 'Added buyer protection and payout obligations.'],
  },
];

@Injectable()
export class ContractsService implements OnModuleInit {
  constructor(@InjectModel('Contract') private readonly contractModel: Model<ContractDocument>) {}

  async onModuleInit() {
    await this.contractModel.bulkWrite(
      DEFAULT_CONTRACTS.map(contract => ({
        updateOne: {
          filter: { version: contract.version },
          update: { $setOnInsert: contract },
          upsert: true,
        },
      }))
    );
  }

  async findAll() {
    return this.contractModel.find().sort({ publishedAt: -1 }).lean().exec();
  }

  async findActive() {
    const active = await this.contractModel.findOne({ active: true }).sort({ publishedAt: -1 }).lean().exec();
    if (!active) {
      throw new NotFoundException('No active contract version found');
    }
    return active;
  }

  async findByVersion(version: string) {
    const contract = await this.contractModel.findOne({ version }).lean().exec();
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    return contract;
  }
}

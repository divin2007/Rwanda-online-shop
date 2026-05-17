import { Controller, Get, Param } from '@nestjs/common';
import { ContractsService } from './contracts.service';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  async getContracts() {
    const contracts = await this.contractsService.findAll();
    return { success: true, data: contracts };
  }

  @Get('active')
  async getActiveContract() {
    const active = await this.contractsService.findActive();
    return { success: true, data: active };
  }

  @Get(':version')
  async getContractByVersion(@Param('version') version: string) {
    const contract = await this.contractsService.findByVersion(version);
    return { success: true, data: contract };
  }
}

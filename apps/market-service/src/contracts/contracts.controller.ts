import { Controller, Get, Param } from '@nestjs/common';

@Controller('contracts')
export class ContractsController {
  
  // Stub for Document 2 Section 9 - Contract Versioning
  private readonly contracts = [
    { version: '1.0', active: false, publishedAt: '2025-01-01T00:00:00Z', content: 'Legacy Terms...' },
    { version: '2.0', active: false, publishedAt: '2025-06-01T00:00:00Z', content: 'Updated Terms...' },
    { version: '3.0', active: true, publishedAt: '2026-04-01T00:00:00Z', content: 'RMF Partner Agreement v3.0...' }
  ];

  @Get('active')
  getActiveContract() {
    const active = this.contracts.find(c => c.active);
    return { success: true, data: active };
  }

  @Get(':version')
  getContractByVersion(@Param('version') version: string) {
    const contract = this.contracts.find(c => c.version === version);
    if (!contract) {
      return { success: false, error: { message: 'Contract not found' } };
    }
    return { success: true, data: contract };
  }
}

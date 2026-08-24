import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SessionAuthGuard as JwtAuthGuard } from '../auth/guards/session-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('assets')
  searchAssets(@Query('q') query: string) {
    return this.searchService.searchAssets(query);
  }

  @Get('inventory')
  searchInventory(@Query('q') query: string) {
    return this.searchService.searchInventory(query);
  }
}

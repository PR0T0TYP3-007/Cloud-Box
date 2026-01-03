import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@CurrentUser() user: any, @Query('q') q: string) {
    const userId = user?.sub ?? user?.id;
    return this.searchService.searchForUser(userId, q);
  }
}

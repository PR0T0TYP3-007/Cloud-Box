import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards';
import { AuthService } from './providers/auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const builder = Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: {} }],
    })
    builder.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    const module: TestingModule = await builder.compile()

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

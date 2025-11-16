# Testing Guide for CAT Tracker

本指南介绍如何为 CAT Tracker 项目编写和运行测试。

## 目录结构

```
packages/tracker/
├── src/
│   └── routes/
│       └── token/
│           ├── token.controller.ts
│           ├── token.controller.spec.ts     # Controller 单元测试
│           ├── token.service.ts
│           └── token.service.spec.ts        # Service 单元测试
├── test/
│   ├── jest-e2e.json                        # E2E 测试配置
│   ├── test-db.config.ts                    # 测试数据库配置
│   ├── test-helpers.ts                      # 测试工具函数
│   ├── health-check.e2e-spec.ts            # HealthCheck E2E 测试示例
│   └── token.e2e-spec.ts                   # Token E2E 测试示例
└── jest.config.js                           # Jest 配置
```

## 运行测试

### 单元测试

```bash
# 运行所有单元测试
npm test

# 运行单元测试并监听文件变化
npm run test:watch

# 生成测试覆盖率报告
npm run test:cov

# 调试单元测试
npm run test:debug
```

### E2E 测试

```bash
# 运行 E2E 测试
npm run test:e2e
```

## 测试类型说明

### 1. Controller 单元测试

Controller 测试主要验证 HTTP 请求处理逻辑，包括：
- 请求参数验证
- 响应格式正确性
- 错误处理
- Service 方法调用

示例文件：`src/routes/token/token.controller.spec.ts`

**关键点：**
- 使用 `@nestjs/testing` 的 `Test.createTestingModule()` 创建测试模块
- Mock Service 依赖，只测试 Controller 层逻辑
- 验证返回的响应格式（code, msg, data）
- 测试错误处理分支

```typescript
// 示例
describe('TokenController', () => {
  let controller: TokenController;
  let tokenService: TokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TokenController],
      providers: [
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    controller = module.get<TokenController>(TokenController);
    tokenService = module.get<TokenService>(TokenService);
  });

  it('should return token info', async () => {
    mockTokenService.getTokenInfoByTokenIdOrTokenScriptHash
      .mockResolvedValue(mockTokenInfo);

    const result = await controller.getTokenInfo('test_token_id');

    expect(result).toEqual({
      code: 0,
      msg: 'ok',
      data: mockTokenInfo,
    });
  });
});
```

### 2. Service 单元测试

Service 测试主要验证业务逻辑，包括：
- 数据库查询逻辑
- 数据转换和处理
- 业务规则验证
- 缓存逻辑

示例文件：`src/routes/token/token.service.spec.ts`

**关键点：**
- Mock TypeORM Repository
- Mock 其他 Service 依赖
- 测试各种业务场景（成功、失败、边界情况）
- 验证数据库查询参数

```typescript
// 示例
describe('TokenService', () => {
  let service: TokenService;
  let tokenInfoRepository: Repository<TokenInfoEntity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: getRepositoryToken(TokenInfoEntity),
          useValue: mockTokenInfoRepository,
        },
        // ... 其他依赖
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('should return token info by token id', async () => {
    mockTokenInfoRepository.findOne.mockResolvedValue(mockTokenInfo);

    const result = await service.getTokenInfoByTokenIdOrTokenScriptHash(
      'test_token_id',
      TokenTypeScope.Fungible
    );

    expect(result).toBeDefined();
    expect(tokenInfoRepository.findOne).toHaveBeenCalledWith({
      select: expect.any(Array),
      where: expect.objectContaining({
        tokenId: 'test_token_id',
      }),
    });
  });
});
```

### 3. E2E 测试

E2E 测试验证整个 API 端点，包括：
- HTTP 请求和响应
- 路由配置
- 请求验证
- 端到端的功能流程

示例文件：`test/token.e2e-spec.ts`

**两种方式：**

#### 方式一：使用 Mock Service（推荐用于快速测试）

不需要数据库连接，速度快，适合 CI/CD。

```typescript
describe('TokenController (e2e) - Mocked', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TokenModule],
    })
      .overrideProvider(TokenService)
      .useValue(mockTokenService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should return token info', () => {
    return request(app.getHttpServer())
      .get('/tokens/test_token_id')
      .expect(200)
      .expect((res) => {
        expect(res.body.code).toBe(0);
        expect(res.body.data).toHaveProperty('tokenId');
      });
  });
});
```

#### 方式二：使用真实数据库（用于完整的集成测试）

需要配置测试数据库。

```typescript
beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot(getTestDatabaseConfig()),
      TokenModule,
    ],
  }).compile();

  app = moduleFixture.createNestApplication();
  await app.init();
});
```

## 测试工具文件说明

### test-helpers.ts

包含常用的测试工具函数和 Mock 数据工厂：

```typescript
// 创建 Mock 数据
const mockToken = createMockTokenInfo({ name: 'My Token' });
const mockTxOuts = createMockTxOutList(10);

// 创建 Mock Repository
const mockRepo = createMockRepository<TokenInfoEntity>();

// 创建 Mock Service
const mockCommonService = createMockCommonService();

// 异步测试辅助函数
await expectToThrow(
  async () => await service.invalidOperation(),
  'Expected error message'
);
```

### test-db.config.ts

包含测试数据库配置：

```typescript
// PostgreSQL 测试数据库
const config = getTestDatabaseConfig();

// SQLite 内存数据库（快速但功能有限）
const config = getInMemoryDatabaseConfig();
```

## 环境变量配置

在运行需要数据库的 E2E 测试之前，需要配置以下环境变量：

```bash
# 测试数据库配置
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_USERNAME=test
export TEST_DB_PASSWORD=test
export TEST_DB_NAME=tracker_test
```

或者创建 `.env.test` 文件。

## 最佳实践

1. **单元测试**
   - 每个测试应该独立，不依赖其他测试
   - 使用 `beforeEach` 清理状态
   - Mock 所有外部依赖
   - 测试边界条件和错误情况

2. **E2E 测试**
   - 使用 Mock Service 进行快速测试
   - 使用真实数据库进行集成测试
   - 在每次测试后清理数据库
   - 测试完整的用户流程

3. **测试覆盖率**
   - 目标：关键业务逻辑达到 80% 以上覆盖率
   - 优先测试复杂的业务逻辑
   - 不要追求 100% 覆盖率

4. **测试命名**
   - 使用描述性的测试名称
   - 格式：`should [预期行为] when [条件]`
   - 例如：`should return null when token not found`

5. **Mock 数据管理**
   - 使用工厂函数创建 Mock 数据
   - 保持 Mock 数据简单和可读
   - 在 `test-helpers.ts` 中集中管理

## 常见问题

### Q: 如何 Mock TypeORM Repository？

A: 使用 `getRepositoryToken()` 和测试工具：

```typescript
{
  provide: getRepositoryToken(TokenInfoEntity),
  useValue: createMockRepository<TokenInfoEntity>(),
}
```

### Q: 如何测试异步方法？

A: 使用 `async/await`：

```typescript
it('should handle async operation', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});
```

### Q: 如何测试异常？

A: 使用 `expectToThrow` 辅助函数或 `rejects`：

```typescript
// 方式一
await expectToThrow(
  async () => await service.throwError(),
  'Error message'
);

// 方式二
await expect(service.throwError()).rejects.toThrow('Error message');
```

### Q: E2E 测试太慢怎么办？

A: 使用 Mock Service 而不是真实数据库：

```typescript
.overrideProvider(TokenService)
.useValue(mockTokenService)
```

## 参考资源

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

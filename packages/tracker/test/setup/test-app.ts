
import { INestApplication } from '@nestjs/common';
import {Test, TestingModule} from '@nestjs/testing';
import { AppApiModule } from '../../src/app-api.module';
import { AppWorkerModule } from '../../src/app-worker.module';

export class TestApp {
    private static apiInstance: INestApplication;
    private static workerInstance: INestApplication;

    private static isCreated = false;

    static async create() {
        if (!this.isCreated) {
            const apiModuleFixture: TestingModule = await Test.createTestingModule({
                imports: [AppApiModule],
            }).compile();

            const workerModuleFixture: TestingModule = await Test.createTestingModule({
                imports: [AppWorkerModule],
            }).compile();

            this.apiInstance = apiModuleFixture.createNestApplication();
            this.workerInstance = workerModuleFixture.createNestApplication();

            await this.apiInstance.init();
            await this.workerInstance.init();
            this.isCreated = true;
        }
        return [this.workerInstance, this.apiInstance] as const;
    }

    static async close() {
        if (this.isCreated) {
            await this.apiInstance.close();
            await this.workerInstance.close();
            this.isCreated = false;
        }
    }
}
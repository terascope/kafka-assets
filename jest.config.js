import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
    verbose: true,
    testEnvironment: 'node',
    setupFilesAfterEnv: ['jest-extended/all'],
    collectCoverage: false,
    testMatch: [
        '<rootDir>/test/**/*-spec.{ts,js}',
        '<rootDir>/test/*-spec.{ts,js}',
    ],
    moduleNameMapper: {
        '^terafoundation_kafka_connector$': path.join(dirname, '/packages/terafoundation_kafka_connector/src/index.ts'),
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    preset: 'ts-jest',
    extensionsToTreatAsEsm: ['.ts'],
    globals: {
        'ts-jest': {
            tsconfig: './tsconfig.json',
            diagnostics: true,
            useESM: true
        },
        ignoreDirectories: ['dist'],
        availableExtensions: ['.js', '.ts', '.mjs']
    },
    transform: {
        '\\.[jt]sx?$': ['ts-jest', {
            isolatedModules: true,
            tsconfig: './tsconfig.json',
            diagnostics: true,
            pretty: true,
            useESM: true
        }]
    },
    testTimeout: 60 * 1000
};

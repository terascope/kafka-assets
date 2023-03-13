'use strict';

const path = require('path');

module.exports = {
    verbose: true,
    testEnvironment: 'node',
    setupFilesAfterEnv: ['jest-extended/all'],
    collectCoverage: true,
    coverageReporters: ['json', 'lcov', 'text', 'html'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        '<rootDir>/asset/**/*.ts',
        '!<rootDir>/asset/src/kafka_*/index.ts',
        '!<rootDir>/packages/*/**/*.ts',
        '!<rootDir>/packages/*/test/**',
        '!<rootDir>/**/coverage/**',
        '!<rootDir>/**/*.d.ts',
        '!<rootDir>/**/dist/**',
        '!<rootDir>/**/coverage/**'
    ],
    testMatch: [
        '<rootDir>/test/**/*-spec.{ts,js}',
        '<rootDir>/test/*-spec.{ts,js}',
    ],
    moduleNameMapper: {
        '^terafoundation_kafka_connector$': path.join(__dirname, '/packages/terafoundation_kafka_connector/src/index.ts'),
    },
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            tsconfig: './tsconfig.json',
            diagnostics: true,
        },
        ignoreDirectories: ['dist'],
        availableExtensions: ['.js', '.ts']
    }
};

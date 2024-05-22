'use strict';

module.exports = {
    verbose: true,
    testEnvironment: 'node',
    setupFilesAfterEnv: ['jest-extended/all'],
    collectCoverage: false,
    testMatch: [
        '<rootDir>/test/**/*-spec.{ts,js}',
        '<rootDir>/test/*-spec.{ts,js}',
    ],
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            tsconfig: './tsconfig.json',
            diagnostics: true,
            pretty: true,
        }
    },
    testTimeout: 60 * 1000
};

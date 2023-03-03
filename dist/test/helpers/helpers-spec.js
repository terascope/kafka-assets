"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const _kafka_helpers_1 = require("../../asset/src/_kafka_helpers");
const codes = __importStar(require("../../asset/src/_kafka_helpers/error-codes"));
describe('wrapError helper', () => {
    describe('when given a Error', () => {
        it('should return a correctly formatted error', () => {
            const err = new Error('Uh oh');
            const error = (0, _kafka_helpers_1.wrapError)('Hello', err);
            expect(error.message).toEqual('Hello, caused by error: Uh oh');
        });
    });
    describe('when given a KafkaError', () => {
        it('should return a correctly formatted error', () => {
            const err = new Error('Uh oh');
            err.code = -174;
            const error = (0, _kafka_helpers_1.wrapError)('Failure', err);
            expect(error.message).toEqual('Failure, caused by error: Uh oh, code: -174, desc: "Revoked partitions (rebalance_cb)"');
        });
    });
    describe('when given a wrappedError', () => {
        it('should return a correctly formatted error', () => {
            const err = new Error('Uh oh');
            err.code = -174;
            const wrappedError = (0, _kafka_helpers_1.wrapError)('Failure', err);
            const error = (0, _kafka_helpers_1.wrapError)('Double Failure', wrappedError);
            expect(error.message).toEqual('Double Failure, caused by error: Uh oh, code: -174, desc: "Revoked partitions (rebalance_cb)"');
        });
    });
    describe('when given a number', () => {
        it('should return a correctly formatted error', () => {
            const error = (0, _kafka_helpers_1.wrapError)('Failure', -174);
            expect(error.message).toEqual('Failure, caused by error: -174, code: -174, desc: "Revoked partitions (rebalance_cb)"');
        });
    });
    describe('when given a string', () => {
        it('should return a correctly formatted error', () => {
            const error = (0, _kafka_helpers_1.wrapError)('Failure', 'bad news bears');
            expect(error.message).toEqual('Failure, caused by error: bad news bears');
        });
    });
    describe('when given a null', () => {
        it('should return a correctly formatted error', () => {
            const error = (0, _kafka_helpers_1.wrapError)('Failure', null);
            expect(error.message).toEqual('Failure');
        });
    });
});
describe('isOkayError helper', () => {
    const alwaysOk = Object.keys(codes.okErrors.any);
    const alwaysBad = [123, -67, 2, -100, null, undefined, 'hello'];
    describe.each([
        codes.KAFKA_NO_OFFSET_STORED,
        codes.ERR__WAIT_COORD,
        codes.ERR_NOT_COORDINATOR_FOR_GROUP,
        codes.ERR__TIMED_OUT_QUEUE,
        ...alwaysOk
    ])('when consuming and checking ok error code %s', (code) => {
        // eslint-disable-next-line jest/no-identical-title
        it('should return true', () => {
            const err = new Error('Uh oh');
            err.code = code;
            expect((0, _kafka_helpers_1.isOkayError)(err, 'consume')).toBeTrue();
            expect((0, _kafka_helpers_1.isOkayError)(code, 'consume')).toBeTrue();
        });
    });
    describe.each(alwaysBad)('when consuming and checking bad error code %s', (code) => {
        it('should return false', () => {
            const err = new Error('Uh oh');
            err.code = code;
            expect((0, _kafka_helpers_1.isOkayError)(err, 'consume')).toBeFalse();
            expect((0, _kafka_helpers_1.isOkayError)(code, 'consume')).toBeFalse();
        });
    });
    describe.each([
        codes.KAFKA_NO_OFFSET_STORED,
        ...alwaysOk
    ])('when committing and checking error code %s', (code) => {
        // eslint-disable-next-line jest/no-identical-title
        it('should return true', () => {
            const err = new Error('Uh oh');
            err.code = code;
            expect((0, _kafka_helpers_1.isOkayError)(err, 'commit')).toBeTrue();
            expect((0, _kafka_helpers_1.isOkayError)(code, 'commit')).toBeTrue();
        });
    });
    describe.each([
        codes.ERR__MSG_TIMED_OUT,
        ...alwaysOk
    ])('when producing and checking error code %s', (code) => {
        // eslint-disable-next-line jest/no-identical-title
        it('should return true', () => {
            const err = new Error('Uh oh');
            err.code = code;
            expect((0, _kafka_helpers_1.isOkayError)(err, 'produce')).toBeTrue();
            expect((0, _kafka_helpers_1.isOkayError)(code, 'produce')).toBeTrue();
        });
    });
});
//# sourceMappingURL=helpers-spec.js.map
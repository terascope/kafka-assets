import type { LibrdKafkaError, Message } from 'node-rdkafka';
import {
    toString, isString, isError,
    DataEntityMetadata
} from '@terascope/job-components';
import { codeToMessage, okErrors } from './error-codes';

export type AnyKafkaError = Error|KafkaError|number|string|null;

export type KafkaError = LibrdKafkaError;

export function wrapError(message: string, err: AnyKafkaError|unknown): KafkaError {
    const cause = getErrorCause(err);
    const error = new Error(`${message}${cause}`) as any as KafkaError;

    if (isKafkaError(err)) {
        error.code = err.code;
        error.errno = err.errno;
        error.origin = err.origin;
    }

    Error.captureStackTrace(error, wrapError);

    // @ts-expect-error
    error._wrapped = true;
    return error;
}

function getErrorCause(err: any): string {
    const causedBy = ', caused by error: ';

    if (err == null) return '';
    if (isString(err)) return `${causedBy}${err}`;

    if (err._wrapped) {
        const parts = err.message.split(causedBy);
        return parts.length > 1 ? `${causedBy}${parts[1]}` : err.message;
    }

    let message = causedBy;
    message += typeof err === 'object' ? err.message : toString(err);

    let code: number|string|null = null;

    if (isKafkaError(err)) {
        code = err.code;
    } else if (Number.isInteger(err)) {
        code = err;
    }

    if (code != null) {
        message += `, code: ${code}`;
        if (codeToMessage[code]) {
            message += `, desc: "${codeToMessage[code]}"`;
        }
    }

    return message;
}

export interface KafkaMessageMetadata extends DataEntityMetadata {
    /** the message key */
    _key: string|undefined;
    /** The time at which the data was ingested into the source data */
    _ingestTime: number;
    /** The time at which the data was consumed by the reader */
    _processTime: number;
    /** TODO - a time off of the specific field */
    _eventTime: number;
    /** the topic name */
    topic: string;
    /** the partition on the topic the message was on */
    partition: number;
    /** the offset of the message */
    offset: number;
    /** the message size, in bytes. */
    size: number;
}

export type KafkaMessage = Message;

export function isKafkaError(err: unknown): err is KafkaError {
    // @ts-expect-error
    return isError(err) && err.code != null;
}

export function isOkayError(err?: AnyKafkaError|unknown|undefined, action = 'any'): boolean {
    if (err == null) return false;
    const code = isKafkaError(err) ? err.code : err as number;
    if (action === 'retryable') {
        return okErrors[action][code] != null;
    }
    return (okErrors[action] && okErrors[action][code] != null) || okErrors.any[code] != null;
}

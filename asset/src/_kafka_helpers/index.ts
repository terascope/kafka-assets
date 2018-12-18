import { toString, isString, isError } from '@terascope/job-components';
import { codeToMessage, okErrors } from './error-codes';

export type AnyKafkaError = Error|KafkaError|number|string|null;

export interface KafkaError extends Error {
    code: number;
}

export function wrapError(message: string, err: AnyKafkaError): KafkaError {
    const cause = getErrorCause(err);
    const error = new Error(`${message}${cause}`) as KafkaError;

    if (isKafkaError(err)) error.code = err.code;

    Error.captureStackTrace(error, wrapError);

    // @ts-ignore
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

    let code: number|null = null;

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

export interface KafkaMessageMetadata {
    /** the topic name */
    topic: string;
    /** the partition on the topic the message was on */
    partition: number;
    /** the offset of the message */
    offset: number;
    /** the message key */
    key: string;
    /** the message size, in bytes. */
    size: number;
    /** the message timestamp */
    timestamp: number;
}

export interface KafkaMessage extends KafkaMessageMetadata {
    /** the message data */
    value: Buffer;
}

export function isKafkaError(err: any): err is KafkaError {
    // @ts-ignore
    return isError(err) && err.code != null;
}

export function isOkayError(err: AnyKafkaError, action: string = 'any'): boolean {
    if (err == null) return false;
    const code = isKafkaError(err) ? err.code : err as number;
    if (action === 'retryable') {
        return okErrors[action][code] != null;
    }
    return okErrors[action] && okErrors[action][code] != null || okErrors.any[code] != null;
}

import { codeToMessage, okErrors, OkErrors } from './error-codes';

export type AnyKafkaError = Error|KafkaError|number|null;

export interface KafkaError extends Error {
    code: number;
}

export function wrapError(message: string, err: AnyKafkaError): KafkaError {
    const cause = getErrorCause(err);
    const error = new Error(`${message}${cause}`) as KafkaError;

    if (isKafkaError(err)) error.code = err.code;

    Error.captureStackTrace(error, wrapError);
    return error;
}

function getErrorCause(err: any): string {
    if (err == null) return '';
    if (typeof err === 'string') return `, caused by, ${err}`;

    let message = ', caused by error: ';
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

export function toString(val: any): string {
    if (val == null) return '';
    if (typeof val.toString === 'function') return val.toString();
    return JSON.stringify(val);
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

function isKafkaError(err: any): err is KafkaError {
    return err && err.code;
}

export function isError(err: any): err is Error {
    return err && err.stack && err.message;
}

export function isOkayError(err: AnyKafkaError, action: keyof OkErrors) {
    if (isKafkaError(err)) {
        return okErrors[action][err.code];
    }

    return err && okErrors[action][err as number];
}

/** A simplified implemation of moment(new Date(val)).isValid() */
export function getValidDate(val: any): Date|false {
    const d = new Date(val);
    // @ts-ignore
    return d instanceof Date && !isNaN(d) && d;
}

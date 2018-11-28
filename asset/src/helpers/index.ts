export interface KafkaError extends Error {
    code: number;
}

export function wrapError(message: string, err: any) {
    const cause = err && err.message ? err.message : toString(err);
    const error = new Error(`${message}, caused by ${cause}`) as KafkaError;

    if (err && err.code) {
        error.code = err.code;
    }

    Error.captureStackTrace(error, wrapError);
    return error;
}

export function toString(val: any): string {
    if (val == null) return '';
    if (typeof val.toString === 'function') return val.toString();
    return JSON.stringify(val);
}

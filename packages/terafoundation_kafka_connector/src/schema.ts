import { ConvictSchema, AnyObject } from '@terascope/job-components';

export const schema = {
    brokers: {
        doc: 'List of seed brokers for the kafka environment',
        default: ['localhost:9092'],
        format: Array
    },
    security_protocol: {
        doc: 'Protocol used to communicate with brokers',
        format: ['plaintext', 'ssl'],
        default: 'plaintext'
    },
    ssl_crl_location: {
        doc: 'Path to CRL for verifying broker\'s certificate validity',
        default: undefined,
        format: 'optional_String'
    },
    ssl_ca_location: {
        doc: 'File or directory path to CA certificate(s) for verifying the broker\'s key. Ignored if `caCertificate` is provided.',
        default: undefined,
        format: 'optional_String'
    },
    caCertificate: {
        doc: 'CA certificate string (PEM format) for verifying the broker\'s key. If provided `ssl_ca_location` will be ignored.',
        default: undefined,
        format: 'optional_String'
    },
    ssl_certificate_location: {
        doc: 'Path to client\'s public key (PEM) used for authentication',
        default: undefined,
        format: 'optional_String'
    },
    ssl_key_location: {
        doc: 'Path to client\'s private key (PEM) used for authentication',
        default: undefined,
        format: 'optional_String'
    },
    ssl_key_password: {
        doc: 'Private key passphrase',
        default: undefined,
        format: 'optional_String'
    },
    rdkafka_options: {
        doc: 'Additional rdkafka configuration options. See https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md for available options.',
        default: undefined,
        format: Object
    }
};

export default class Schema extends ConvictSchema<AnyObject> {
    // This validation function is a workaround for the limitations of convict when
    // parsing configs that have periods `.` within its key values.
    // https://github.com/mozilla/node-convict/issues/250
    // This will pull `rdkafka_options` out before convict validation
    // https://github.com/terascope/kafka-assets/pull/1071
    validate(config: Record<string, any>): any {
        const { rdkafka_options, ...parsedConfig } = config;
        const results = super.validate(parsedConfig);

        return {
            ...results,
            rdkafka_options
        };
    }

    build(): Record<string, any> {
        return schema;
    }
}

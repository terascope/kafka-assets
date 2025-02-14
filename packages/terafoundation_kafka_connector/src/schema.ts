export default {
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
        doc: 'File or directory path to CA certificate(s) for verifying the broker\'s key. Ignored if `ssl_ca_pem` is provided.',
        default: undefined,
        format: 'optional_String'
    },
    ssl_ca_pem: {
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
    }
};

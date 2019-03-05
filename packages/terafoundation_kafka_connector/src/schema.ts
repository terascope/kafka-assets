export = {
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
        default: null,
        format: String
    },
    ssl_ca_location: {
        doc: 'File or directory path to CA certificate(s) for verifying the broker\'s key',
        default: null,
        format: String
    },
    ssl_certificate_location: {
        doc: 'Path to client\'s public key (PEM) used for authentication',
        default: null,
        format: String
    },
    ssl_key_location: {
        doc: 'Path to client\'s private key (PEM) used for authentication',
        default: null,
        format: String
    },
    ssl_key_password: {
        doc: 'Private key passphrase',
        default: null,
        format: String
    }
};

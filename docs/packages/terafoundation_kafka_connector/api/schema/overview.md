---
title: Terafoundation Kafka Connector: `schema`
sidebar_label: schema
---

[terafoundation_kafka_connector](../overview.md) / schema

# schema

## Variables

<a id="default"></a>

### default

> **default**: `object`

Defined in: [schema.ts:1](https://github.com/terascope/kafka-assets/blob/b4e3eb0e523d6b614deaefe4e0a4f374baa11655/packages/terafoundation_kafka_connector/src/schema.ts#L1)

#### Type declaration

<a id="brokers-2"></a>

##### brokers

> **brokers**: `object`

<a id=""></a>

###### brokers.default

> **default**: `string`[]

<a id=""></a>

###### brokers.doc

> **doc**: `string` = `'List of seed brokers for the kafka environment'`

<a id=""></a>

###### brokers.format

> **format**: `ArrayConstructor` = `Array`

<a id="cacertificate-2"></a>

##### caCertificate

> **caCertificate**: `object`

<a id=""></a>

###### caCertificate.default

> **default**: `undefined` = `undefined`

<a id=""></a>

###### caCertificate.doc

> **doc**: `string` = `'CA certificate string (PEM format) for verifying the broker\'s key. If provided `ssl_ca_location` will be ignored.'`

<a id=""></a>

###### caCertificate.format

> **format**: `string` = `'optional_String'`

<a id="security_protocol-2"></a>

##### security\_protocol

> **security\_protocol**: `object`

<a id=""></a>

###### security\_protocol.default

> **default**: `string` = `'plaintext'`

<a id=""></a>

###### security\_protocol.doc

> **doc**: `string` = `'Protocol used to communicate with brokers'`

<a id=""></a>

###### security\_protocol.format

> **format**: `string`[]

<a id="ssl_ca_location-2"></a>

##### ssl\_ca\_location

> **ssl\_ca\_location**: `object`

<a id=""></a>

###### ssl\_ca\_location.default

> **default**: `undefined` = `undefined`

<a id=""></a>

###### ssl\_ca\_location.doc

> **doc**: `string` = `'File or directory path to CA certificate(s) for verifying the broker\'s key. Ignored if `caCertificate` is provided.'`

<a id=""></a>

###### ssl\_ca\_location.format

> **format**: `string` = `'optional_String'`

<a id="ssl_certificate_location-2"></a>

##### ssl\_certificate\_location

> **ssl\_certificate\_location**: `object`

<a id=""></a>

###### ssl\_certificate\_location.default

> **default**: `undefined` = `undefined`

<a id=""></a>

###### ssl\_certificate\_location.doc

> **doc**: `string` = `'Path to client\'s public key (PEM) used for authentication'`

<a id=""></a>

###### ssl\_certificate\_location.format

> **format**: `string` = `'optional_String'`

<a id="ssl_crl_location-2"></a>

##### ssl\_crl\_location

> **ssl\_crl\_location**: `object`

<a id=""></a>

###### ssl\_crl\_location.default

> **default**: `undefined` = `undefined`

<a id=""></a>

###### ssl\_crl\_location.doc

> **doc**: `string` = `'Path to CRL for verifying broker\'s certificate validity'`

<a id=""></a>

###### ssl\_crl\_location.format

> **format**: `string` = `'optional_String'`

<a id="ssl_key_location-2"></a>

##### ssl\_key\_location

> **ssl\_key\_location**: `object`

<a id=""></a>

###### ssl\_key\_location.default

> **default**: `undefined` = `undefined`

<a id=""></a>

###### ssl\_key\_location.doc

> **doc**: `string` = `'Path to client\'s private key (PEM) used for authentication'`

<a id=""></a>

###### ssl\_key\_location.format

> **format**: `string` = `'optional_String'`

<a id="ssl_key_password-2"></a>

##### ssl\_key\_password

> **ssl\_key\_password**: `object`

<a id=""></a>

###### ssl\_key\_password.default

> **default**: `undefined` = `undefined`

<a id=""></a>

###### ssl\_key\_password.doc

> **doc**: `string` = `'Private key passphrase'`

<a id=""></a>

###### ssl\_key\_password.format

> **format**: `string` = `'optional_String'`

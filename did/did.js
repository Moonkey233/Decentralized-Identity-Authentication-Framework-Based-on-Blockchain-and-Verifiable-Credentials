const qs = require('qs')

const DIGIT = array(10, (i) => 0x30 + i)
const ALPHA = concat(
    array(26, (i) => 0x61 + i), // a-z
    array(26, (i) => 0x41 + i), // A-Z
)

function code(ch) {
    return String(ch).charCodeAt(0)
}

function array(size, map) {
    return Array(size).fill(0).map((_, i) => map(i))
}

function concat() {
    return Array.prototype.concat.apply([], arguments)
}

function inRange(value, start, end) {
    return value >= start && value <= end
}

function toLower(ch) {
    return String(ch).toLowerCase()
}

// specific-idstring  = idstring *( ":" idstring )
// idstring           = 1*idchar
// idchar             = ALPHA / DIGIT / "." / "-" / "_"
function isValidIdentifierCharacter(ch) {
    if (!ch) {
        return false
    }

    return (
        0x5f == code(ch) || // '_'
        0x2d == code(ch) || // '-'
        0x2e == code(ch) || // '.'
        0x3a == code(ch) || // ':'
        inRange(code(ch), 0x30, 0x39) || // 0-9 (DIGIT)
        inRange(code(ch), 0x61, 0x7a) || // a-z (ALPHA)
        inRange(code(ch), 0x41, 0x5a)    // A-Z (ALPHA)
    )
}

// method     = 1*methodchar
// methodchar = %x61-7A / DIGIT
function isValidMethodCharacter(ch) {
    if (!ch) {
        return false
    }

    return (
        inRange(code(ch), 0x30, 0x39) ||
        inRange(code(ch), 0x61, 0x7a)
    )
}

// pchar       = unreserved / pct-encoded / sub-delims / ":" / "@"
// unreserved  = ALPHA / DIGIT / "-" / "." / "_" / "~"
// pct-encoded = "%" HEXDIG HEXDIG
// sub-delims  = "!" / "$" / "&" / "'" / "(" / ")"
//             / "*" / "+" / "," / ";" / "="
function isValidPathCharacter(ch) {
    if (!ch) {
        return false
    }

    const sub = ['!', '$', '&', "'", '(', ')', '*', '+', ',', ';', '='].map(code)
    return concat(ALPHA, DIGIT, sub, code(':'), code('@')).indexOf(code(ch)) > -1
}

// query       = *( pchar / "/" / "?" )
// pchar       = unreserved / pct-encoded / sub-delims / ":" / "@"
// unreserved  = ALPHA / DIGIT / "-" / "." / "_" / "~"
// pct-encoded = "%" HEXDIG HEXDIG
// gen-delims  = ":" / "/" / "?" / "#" / "[" / "]" / "@"
// sub-delims  = "!" / "$" / "&" / "'" / "(" / ")"
//             / "*" / "+" / "," / ";" / "="
function isValidQueryCharacter(ch) {
    if (!ch) {
        return false
    }

    const gen = [':', '/', '?', '#', '[', ']', '@'].map(code)
    const sub = ['!', '$', '&', "'", '(', ')', '*', '+', ',', ';', '='].map(code)
    const pct = ['%', '-', '_', '~'].map(code)
    return concat(ALPHA, DIGIT, gen, sub, pct, code('.')).indexOf(code(ch)) > -1
}

// fragment    = *( pchar / "/" / "?" )
// pchar       = unreserved / pct-encoded / sub-delims / ":" / "@"
// unreserved  = ALPHA / DIGIT / "-" / "." / "_" / "~"
// pct-encoded = "%" HEXDIG HEXDIG
// gen-delims  = ":" / "/" / "?" / "#" / "[" / "]" / "@"
// sub-delims  = "!" / "$" / "&" / "'" / "(" / ")"
//             / "*" / "+" / "," / ";" / "="
function isValidFragmentCharacter(ch) {
    return isValidQueryCharacter(ch)
}

// param       = param-name [ "=" param-value ]
// param-name  = 1*param-char
// param-value = *param-char
// param-char  = ALPHA / DIGIT / "." / "-" / "_" / ":" / pct-encoded
function isValidParamCharacter(ch) {
    if (!ch) {
        return false
    }

    return (
        0x2e == code(ch) || // '.'
        0x2d == code(ch) || // '-'
        0x5f == code(ch) || // '_'
        0x3a == code(ch) || // ':'
        inRange(code(ch), 0x30, 0x39) || // 0-9 (DIGIT)
        inRange(code(ch), 0x61, 0x7a) || // a-z (ALPHA)
        inRange(code(ch), 0x41, 0x5a) ||  // A-Z (ALPHA)
        -1 !== ['%', '-', '_', '~'].map(code).indexOf(ch) // pct-encoded
    )
}

/**
 * The `DID` represents an object class similar to the
 * `URL` class exported by the `url` module. This object is
 * serializable.
 */
class DID {

    static from(uri) {
        return new this(format(uri))
    }

    constructor(uri, base) {
        if (base && 'string' == typeof base) {
            if ('/' != uri[0]) {
                if ('/' != base.slice(-1)) {
                    uri = '/' + uri
                }
            }
            uri = base + uri
        }

        this.reference = null
        this.did = null
        this.method = null
        this.identifier = null
        this.path = null
        this.fragment = null
        this.query = null
        this.param = null

        this.parameters = null
        this.queryParameters = null
        this.fragmentParameters = null

        Object.seal(this)
        Object.assign(this, parse(uri))

        this.parameters = parseParam(this.param)
        this.queryParameters = Object.seal(Object.freeze(qs.parse(this.query)))
        this.fragmentParameters = Object.seal(Object.freeze(qs.parse(this.fragment)))

        function parseParam(param) {
            if (!param) {
                return {}
            }

            const result = {}
            const params = param.split(';').filter(Boolean).map((p) => p.split('='))
            const values = params.map((tuple) => tuple[1])
            const keys = params.map((tuple) => tuple[0])

            for (let i = 0; i < params.length; ++i) {
                const raw = undefined === values[i] ? true : values[i]
                const key = keys[i]
                const parts = key.split('.')
                const depth = parts.length
                let value = raw

                if ('string' === typeof value) {
                    try {
                        value = JSON.parse(value)
                    } catch (err) {
                        value = raw
                    }
                }

                if (depth > 1) {
                    let scope = result
                    const p = parts.pop()
                    for (const k of parts) {
                        scope[k] = scope[k] || {}
                        scope = scope[k]
                    }

                    scope[p] = value
                } else {
                    result[key] = value
                }
            }

            return Object.freeze(Object.seal(result))
        }
    }

    toString() { return format(this) }
    toJSON() { return format(this) }
    valueOf() { return format(this) }
}

function parse(uri) {
    if (uri && 'object' == typeof uri && false == Array.isArray(uri)) {
        uri = format(uri)
    }

    if ('string' != typeof uri) {
        throw new TypeError("did.parse: Expecting uri to be a string.")
    }

    uri = normalize(uri)

    const ctx = {
        // https://w3c-ccg.github.io/did-spec/#the-generic-did-scheme
        reference: null, // did [ "/" path ] [ "#" fragment ] ]
        did: null, // "did:" method ":" identifier
        method: null, // *(%x61-7A / DIGIT)
        identifier: null, // *([:] ALPHA / DIGIT / "." / "-")

        // https://w3c-ccg.github.io/did-spec/#did-paths
        path: null, // [ "/" path ]

        // https://w3c-ccg.github.io/did-spec/#did-fragments
        fragment: null, // [ "#" fragment ]

        // https://tools.ietf.org/html/rfc3986
        query: null,

        // https://w3c-ccg.github.io/did-spec/#method-specific-did-parameter-names
        param: null,
    }

    const len = uri.length
    let i = 0

    while (peek()) {
        if (null == ctx.reference) {
            ctx.reference = ''
            // parse protocol first to determine if URI is valid to continue parsing
            for (let j = 0; j < 4; ++j) {
                ctx.reference += toLower(peek())
                next()
            }

            // ensure correct protocol is used
            if ('did:' != ctx.reference) {
                throw new SyntaxError(`Invalid protocol (${ctx.reference}) specified.`)
            } else {
                ctx.reference += uri.slice(4)
            }
        }

        if (null == ctx.method) {
            ctx.method = ''
            while (':' != peek()) {
                if (isValidMethodCharacter(peek())) {
                    ctx.method += next()
                } else {
                    throw new SyntaxError(`Invalid method (${ctx.method || peek()}) specified.`)
                }
            }

            if (':' != next()) {
                // UNREACHABLE
                throw new SyntaxError(`Unexpected token '${peek()}'.`)
            }
        }

        if (null == ctx.identifier) {
            ctx.identifier = ''

            // break on EOL and path character prefix
            const breaks = ['/', '?', '#', ';']
            while (null != peek() && -1 == breaks.indexOf(peek())) {
                if (isValidIdentifierCharacter(peek())) {
                    ctx.identifier += next()
                } else {
                    throw new SyntaxError(`Invalid character (${peek()}) in "idstring".`)
                }
            }
        }

        if (null == ctx.did) {
            if (ctx.method && ctx.identifier) {
                ctx.did = `did:${ctx.method}:${ctx.identifier}`
            }
        }

        if (null == ctx.param) {
            ctx.param = ''

            if (';' == peek()) {
                ctx.param += next()
                if (false == isValidParamCharacter(peek())) {
                    throw new SyntaxError(`Invalid character (${peek()}) in "param".`)
                }

                // break on EOL, query search prefix, and hash fragment prefix
                const breaks = ['/', '?', '#']
                while (null != peek() && -1 == breaks.indexOf(peek())) {
                    if (';' == peek() || '=' == peek() || isValidParamCharacter(peek())) {
                        ctx.param += next()
                    } else {
                        throw new SyntaxError(`Invalid character (${peek()}) in "param".`)
                    }
                }
            }
        }

        if (null == ctx.path) {
            ctx.path = ''

            if ('/' == peek()) {
                ctx.path += next()

                // ensure next character is a valid path character before
                // proceeding to parse
                if (
                    false == isValidPathCharacter(peek()) &&
                    false == isValidQueryCharacter(peek()) &&
                    false == isValidFragmentCharacter(peek())
                ) {
                    throw new SyntaxError(`Invalid character (${peek()}) in "path".`)
                }

                // break on EOL, query search prefix, and hash fragment prefix
                while (null != peek() && '?' != peek() && '#' != peek()) {
                    if ('/' == peek() || isValidPathCharacter(peek())) {
                        ctx.path += next()
                    } else {
                        throw new SyntaxError(`Invalid character (${peek()}) in "path".`)
                    }
                }
            }
        }

        if (null == ctx.query) {
            ctx.query = ''

            if ('?' == peek()) {
                // ensure next character is a valid path character before
                // proceeding to parse
                if (false == isValidQueryCharacter(peek(1))) {
                    throw new SyntaxError(`Invalid character (${peek(1)}) in "query".`)
                } else {
                    next()
                }

                while (null != peek() && '#' != peek()) {
                    if (isValidQueryCharacter(peek())) {
                        ctx.query += next()
                    } else {
                        throw new SyntaxError(`Invalid character (${peek()}) in "query".`)
                    }
                }
            }
        }

        if (null == ctx.fragment) {
            ctx.fragment = ''

            if ('#' == peek()) {
                // ensure next character is a valid path character before
                // proceeding to parse
                if (false == isValidFragmentCharacter(peek(1))) {
                    throw new SyntaxError(`Invalid character (${peek(1)}) in "fragment".`)
                } else {
                    next()
                }

                while (null != peek() && '#' != peek()) {
                    if (isValidFragmentCharacter(peek())) {
                        ctx.fragment += next()
                    } else {
                        throw new SyntaxError(`Invalid character (${peek()}) in "fragment".`)
                    }
                }
            }
        }

        next()
    }

    return ctx

    function next() {
        return uri[i++]
    }

    function peek(direction = 0) {
        return uri[i + direction]
    }
}

function normalize(uri) {
    if (uri && 'object' == typeof uri && false == Array.isArray(uri)) {
        uri = format(uri)
    }

    if ('string' != typeof uri) {
        throw new TypeError("did.normalize: Expecting uri to be a string.")
    }

    // remove dead padding
    uri = uri.trim()
    // remove newlines
    uri = uri.replace(/\n|\r/g, '')
    // normalize' did://'
    uri = uri.replace(/^did:\/\//g, 'did:')

    // prepend `did:?`
    if (false == /^did:/.test(uri)) {
        if (/^:/.test(uri)) {
            uri = `did${uri}`
        } else {
            uri = `did:${uri}`
        }
    }

    return uri
}

function format(obj) {
    if ('string' == typeof obj) {
        obj = parse(obj)
    } else if (!obj || 'object' != typeof obj || Array.isArray(obj)) {
        throw new TypeError("did.format: Expecting object.")
    } else if (!obj.method && !obj.identifier && (!obj.did || 'string' != typeof obj.did)) {
        throw new TypeError(
            "did.format: Expecting 'did' string in object or 'method' and 'identifier' to be defined."
        )
    }

    let uri = ''

    if (obj.did) {
        uri += obj.did
    } else if (obj.method && obj.identifier) {
        uri += `did:${obj.method}:${obj.identifier}`
    }

    if (obj.param && 'string' == typeof obj.param) {
        uri += obj.param
    }

    if (obj.path && 'string' == typeof obj.path) {
        uri += obj.path
    }

    if (obj.query && 'string' == typeof obj.query) {
        uri += '?' + obj.query
    }

    if (obj.fragment && 'string' == typeof obj.fragment) {
        uri += '#' + obj.fragment
    }

    parse(uri)

    return uri
}

module.exports = Object.assign(DID, {
    normalize,
    format,
    parse,
    DID,
})
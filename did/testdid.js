const { normalize, format, parse, DID } = require('./did.js')
const test = require('tape')

test("normalize(uri) throws", (t) => {
    t.throws(() => normalize(), TypeError)
    t.throws(() => normalize(true), TypeError)
    t.throws(() => normalize([]), TypeError)
    t.throws(() => normalize(null), TypeError)
    t.end()
})

test("normalize(uri)", (t) => {
    t.true('did:method:identifier' == normalize('did://method:identifier'))
    t.true('did:method:identifier' == normalize('   did://method:identifier\n'))
    t.true('did:method:identifier' == normalize(parse('did://method:identifier')))
    t.true('did:method:identifier' == normalize(parse('method:identifier')))
    t.true('did:method:identifier' == normalize(parse(':method:identifier')))
    t.end()
})

test("parse(uri) throws", (t) => {
    t.throws(() => parse(), TypeError)
    t.throws(() => parse(null), TypeError)
    t.throws(() => parse(true), TypeError)
    t.throws(() => parse([]), TypeError)
    t.throws(() => parse(1), TypeError)
    t.end()
})

test("parse(uri) simple", (t) => {
    const uri = 'did:method:identifier'
    const did = parse(uri)
    t.true('object' == typeof did)
    t.true(uri == did.reference)
    t.true(uri == did.did)
    t.true('method' == did.method)
    t.true('identifier' == did.identifier)
    t.true('' == did.path)
    t.true('' == did.fragment)
    t.true('' == did.query)
    t.end()
})

test("parse(uri) path", (t) => {
    const uri = 'did:method:identifier/path/to/this'
    const did = parse(uri)
    t.true(uri == did.reference)
    t.true('/path/to/this' == did.path)
    t.end()
})

test("parse(uri) query", (t) => {
    const uri = 'did:method:identifier/path/to/this?thing=that'
    const did = parse(uri)
    t.true(uri == did.reference)
    t.true('thing=that' == did.query)
    t.end()
})

test("parse(uri) query with no path", (t) => {
    const uri = 'did:method:identifier/?thing=that'
    const did = parse(uri)
    t.true(uri == did.reference)
    t.true('thing=that' == did.query)
    t.end()
})

test("parse(uri) fragment", (t) => {
    const uri = 'did:method:identifier/path/to/this?thing=that.foo#fragment=hash.foo'
    const did = parse(uri)
    t.true(uri == did.reference)
    t.true('fragment=hash.foo' == did.fragment)
    t.end()
})

test("parse(uri) fragment with no path", (t) => {
    const uri = 'did:method:identifier#fragment=hash'
    const did = parse(uri)
    t.true(uri == did.reference)
    t.true('fragment=hash' == did.fragment)
    t.end()
})

test("parse(uri) fragment with no path but leading query prefix (?)", (t) => {
    const uri = 'did:method:identifier?#fragment=hash'
    const did = parse(uri)
    t.true(uri == did.reference)
    t.true('fragment=hash' == did.fragment)
    t.end()
})

test("parse(uri) param", (t) => {
    const param = ';foo:bar=baz;service=thing;o.key=123;o.value=456'
    const uri = `did:method:identifier${param}/path/to/this?thing=that`
    const did = parse(uri)
    t.true(uri == did.reference)
    t.true(param == did.param)
    t.end()
})

test("format(obj) throws", (t) => {
    t.throws(() => format(), TypeError)
    t.throws(() => format(true), TypeError)
    t.throws(() => format([]), TypeError)
    t.throws(() => format(null), TypeError)
    t.throws(() => format(1), TypeError)
    t.end()
})

test("format(obj)", (t) => {
    const uri = 'did:method:identifier/path/to/this?thing=that#fragment=hash'
    const did = parse(uri)
    const formatted = format(did)
    t.true('string' == typeof formatted)
    t.true(formatted == uri)
    t.true(uri == format(uri))
    t.true(uri == format(parse(uri)))
    t.end()
})

test("new DID(uri)", (t) => {
    const uri = 'did:method:identifier;init_param;param=value;boolean=true;number=123;object.key=hello;object.value=world/path/to/this?thing=that&nested[property]=this#fragment=hash'
    const did = new DID(uri)
    t.true(uri == did.reference)
    t.true('method' == did.method)
    t.true('identifier' == did.identifier)
    t.true('thing=that&nested[property]=this' == did.query)
    t.true('this' == did.queryParameters.nested.property)
    t.true('fragment=hash' == did.fragment)
    t.true('value' == did.parameters.param)
    t.true(true == did.parameters.init_param)
    t.true(true == did.parameters.boolean)
    t.true(123 == did.parameters.number)
    t.true('hello' == did.parameters.object.key)
    t.true('world' == did.parameters.object.value)
    t.true(format(parse(uri)) == String(did))
    t.end()
})

test("new DID(uri) throws", (t) => {
    t.throws(() => new DID(), TypeError)
    t.throws(() => new DID(true), TypeError)
    t.throws(() => new DID(false), TypeError)
    t.throws(() => new DID([]), TypeError)
    t.throws(() => new DID(null), TypeError)
    t.throws(() => new DID(1), TypeError)
    t.end()
})

test("DID#toString()", (t) => {
    const uri = 'did:method:identifier;service=this;value=12;param=true;o.a=1;o.b=3/path/to/this?thing=that#fragment=hash'
    const did = new DID(uri)
    t.true(uri == did.toJSON())
    t.true(`"${uri}"` == JSON.stringify(did))
    t.true(uri == String(did))
    t.end()
})

test("DID#toJSON()", (t) => {
    t.end()
})
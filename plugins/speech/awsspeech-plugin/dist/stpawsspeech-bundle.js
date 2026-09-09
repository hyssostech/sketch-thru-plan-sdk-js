(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.StpAWS = {}));
})(this, (function (exports) { 'use strict';

    function setCredentialFeature(credentials, feature, value) {
        if (!credentials.$source) {
            credentials.$source = {};
        }
        credentials.$source[feature] = value;
        return credentials;
    }

    const isStreamingPayload = (request) => request?.body instanceof ReadableStream;

    const getAllAliases = (name, aliases) => {
        const _aliases = [];
        if (name) {
            _aliases.push(name);
        }
        if (aliases) {
            for (const alias of aliases) {
                _aliases.push(alias);
            }
        }
        return _aliases;
    };
    const getMiddlewareNameWithAliases = (name, aliases) => {
        return `${name || "anonymous"}${aliases && aliases.length > 0 ? ` (a.k.a. ${aliases.join(",")})` : ""}`;
    };
    const constructStack = () => {
        let absoluteEntries = [];
        let relativeEntries = [];
        let identifyOnResolve = false;
        const entriesNameSet = new Set();
        const sort = (entries) => entries.sort((a, b) => stepWeights[b.step] - stepWeights[a.step] ||
            priorityWeights[b.priority || "normal"] - priorityWeights[a.priority || "normal"]);
        const removeByName = (toRemove) => {
            let isRemoved = false;
            const filterCb = (entry) => {
                const aliases = getAllAliases(entry.name, entry.aliases);
                if (aliases.includes(toRemove)) {
                    isRemoved = true;
                    for (const alias of aliases) {
                        entriesNameSet.delete(alias);
                    }
                    return false;
                }
                return true;
            };
            absoluteEntries = absoluteEntries.filter(filterCb);
            relativeEntries = relativeEntries.filter(filterCb);
            return isRemoved;
        };
        const removeByReference = (toRemove) => {
            let isRemoved = false;
            const filterCb = (entry) => {
                if (entry.middleware === toRemove) {
                    isRemoved = true;
                    for (const alias of getAllAliases(entry.name, entry.aliases)) {
                        entriesNameSet.delete(alias);
                    }
                    return false;
                }
                return true;
            };
            absoluteEntries = absoluteEntries.filter(filterCb);
            relativeEntries = relativeEntries.filter(filterCb);
            return isRemoved;
        };
        const cloneTo = (toStack) => {
            absoluteEntries.forEach((entry) => {
                toStack.add(entry.middleware, { ...entry });
            });
            relativeEntries.forEach((entry) => {
                toStack.addRelativeTo(entry.middleware, { ...entry });
            });
            toStack.identifyOnResolve?.(stack.identifyOnResolve());
            return toStack;
        };
        const expandRelativeMiddlewareList = (from) => {
            const expandedMiddlewareList = [];
            from.before.forEach((entry) => {
                if (entry.before.length === 0 && entry.after.length === 0) {
                    expandedMiddlewareList.push(entry);
                }
                else {
                    expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
                }
            });
            expandedMiddlewareList.push(from);
            from.after.reverse().forEach((entry) => {
                if (entry.before.length === 0 && entry.after.length === 0) {
                    expandedMiddlewareList.push(entry);
                }
                else {
                    expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
                }
            });
            return expandedMiddlewareList;
        };
        const getMiddlewareList = (debug = false) => {
            const normalizedAbsoluteEntries = [];
            const normalizedRelativeEntries = [];
            const normalizedEntriesNameMap = {};
            absoluteEntries.forEach((entry) => {
                const normalizedEntry = {
                    ...entry,
                    before: [],
                    after: [],
                };
                for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
                    normalizedEntriesNameMap[alias] = normalizedEntry;
                }
                normalizedAbsoluteEntries.push(normalizedEntry);
            });
            relativeEntries.forEach((entry) => {
                const normalizedEntry = {
                    ...entry,
                    before: [],
                    after: [],
                };
                for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
                    normalizedEntriesNameMap[alias] = normalizedEntry;
                }
                normalizedRelativeEntries.push(normalizedEntry);
            });
            normalizedRelativeEntries.forEach((entry) => {
                if (entry.toMiddleware) {
                    const toMiddleware = normalizedEntriesNameMap[entry.toMiddleware];
                    if (toMiddleware === undefined) {
                        if (debug) {
                            return;
                        }
                        throw new Error(`${entry.toMiddleware} is not found when adding ` +
                            `${getMiddlewareNameWithAliases(entry.name, entry.aliases)} ` +
                            `middleware ${entry.relation} ${entry.toMiddleware}`);
                    }
                    if (entry.relation === "after") {
                        toMiddleware.after.push(entry);
                    }
                    if (entry.relation === "before") {
                        toMiddleware.before.push(entry);
                    }
                }
            });
            const mainChain = sort(normalizedAbsoluteEntries)
                .map(expandRelativeMiddlewareList)
                .reduce((wholeList, expandedMiddlewareList) => {
                wholeList.push(...expandedMiddlewareList);
                return wholeList;
            }, []);
            return mainChain;
        };
        const stack = {
            add: (middleware, options = {}) => {
                const { name, override, aliases: _aliases } = options;
                const entry = {
                    step: "initialize",
                    priority: "normal",
                    middleware,
                    ...options,
                };
                const aliases = getAllAliases(name, _aliases);
                if (aliases.length > 0) {
                    if (aliases.some((alias) => entriesNameSet.has(alias))) {
                        if (!override)
                            throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
                        for (const alias of aliases) {
                            const toOverrideIndex = absoluteEntries.findIndex((entry) => entry.name === alias || entry.aliases?.some((a) => a === alias));
                            if (toOverrideIndex === -1) {
                                continue;
                            }
                            const toOverride = absoluteEntries[toOverrideIndex];
                            if (toOverride.step !== entry.step || entry.priority !== toOverride.priority) {
                                throw new Error(`"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware with ` +
                                    `${toOverride.priority} priority in ${toOverride.step} step cannot ` +
                                    `be overridden by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware with ` +
                                    `${entry.priority} priority in ${entry.step} step.`);
                            }
                            absoluteEntries.splice(toOverrideIndex, 1);
                        }
                    }
                    for (const alias of aliases) {
                        entriesNameSet.add(alias);
                    }
                }
                absoluteEntries.push(entry);
            },
            addRelativeTo: (middleware, options) => {
                const { name, override, aliases: _aliases } = options;
                const entry = {
                    middleware,
                    ...options,
                };
                const aliases = getAllAliases(name, _aliases);
                if (aliases.length > 0) {
                    if (aliases.some((alias) => entriesNameSet.has(alias))) {
                        if (!override)
                            throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
                        for (const alias of aliases) {
                            const toOverrideIndex = relativeEntries.findIndex((entry) => entry.name === alias || entry.aliases?.some((a) => a === alias));
                            if (toOverrideIndex === -1) {
                                continue;
                            }
                            const toOverride = relativeEntries[toOverrideIndex];
                            if (toOverride.toMiddleware !== entry.toMiddleware || toOverride.relation !== entry.relation) {
                                throw new Error(`"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware ` +
                                    `${toOverride.relation} "${toOverride.toMiddleware}" middleware cannot be overridden ` +
                                    `by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware ${entry.relation} ` +
                                    `"${entry.toMiddleware}" middleware.`);
                            }
                            relativeEntries.splice(toOverrideIndex, 1);
                        }
                    }
                    for (const alias of aliases) {
                        entriesNameSet.add(alias);
                    }
                }
                relativeEntries.push(entry);
            },
            clone: () => cloneTo(constructStack()),
            use: (plugin) => {
                plugin.applyToStack(stack);
            },
            remove: (toRemove) => {
                if (typeof toRemove === "string")
                    return removeByName(toRemove);
                else
                    return removeByReference(toRemove);
            },
            removeByTag: (toRemove) => {
                let isRemoved = false;
                const filterCb = (entry) => {
                    const { tags, name, aliases: _aliases } = entry;
                    if (tags && tags.includes(toRemove)) {
                        const aliases = getAllAliases(name, _aliases);
                        for (const alias of aliases) {
                            entriesNameSet.delete(alias);
                        }
                        isRemoved = true;
                        return false;
                    }
                    return true;
                };
                absoluteEntries = absoluteEntries.filter(filterCb);
                relativeEntries = relativeEntries.filter(filterCb);
                return isRemoved;
            },
            concat: (from) => {
                const cloned = cloneTo(constructStack());
                cloned.use(from);
                cloned.identifyOnResolve(identifyOnResolve || cloned.identifyOnResolve() || (from.identifyOnResolve?.() ?? false));
                return cloned;
            },
            applyToStack: cloneTo,
            identify: () => {
                return getMiddlewareList(true).map((mw) => {
                    const step = mw.step ??
                        mw.relation +
                            " " +
                            mw.toMiddleware;
                    return getMiddlewareNameWithAliases(mw.name, mw.aliases) + " - " + step;
                });
            },
            identifyOnResolve(toggle) {
                if (typeof toggle === "boolean")
                    identifyOnResolve = toggle;
                return identifyOnResolve;
            },
            resolve: (handler, context) => {
                for (const middleware of getMiddlewareList()
                    .map((entry) => entry.middleware)
                    .reverse()) {
                    handler = middleware(handler, context);
                }
                if (identifyOnResolve) {
                    console.log(stack.identify());
                }
                return handler;
            },
        };
        return stack;
    };
    const stepWeights = {
        initialize: 5,
        serialize: 4,
        build: 3,
        finalizeRequest: 2,
        deserialize: 1,
    };
    const priorityWeights = {
        high: 3,
        normal: 2,
        low: 1,
    };

    var EndpointURLScheme;
    (function (EndpointURLScheme) {
        EndpointURLScheme["HTTP"] = "http";
        EndpointURLScheme["HTTPS"] = "https";
    })(EndpointURLScheme || (EndpointURLScheme = {}));

    var AlgorithmId;
    (function (AlgorithmId) {
        AlgorithmId["MD5"] = "md5";
        AlgorithmId["CRC32"] = "crc32";
        AlgorithmId["CRC32C"] = "crc32c";
        AlgorithmId["SHA1"] = "sha1";
        AlgorithmId["SHA256"] = "sha256";
    })(AlgorithmId || (AlgorithmId = {}));

    const SMITHY_CONTEXT_KEY = "__smithy_context";

    const getSmithyContext = (context) => context[SMITHY_CONTEXT_KEY] || (context[SMITHY_CONTEXT_KEY] = {});

    function hasOwn(o, k) {
        return Object.prototype.hasOwnProperty.call(o, k);
    }

    class HttpRequest {
        method;
        protocol;
        hostname;
        port;
        path;
        query;
        headers;
        username;
        password;
        fragment;
        body;
        constructor(options) {
            this.method = options.method || "GET";
            this.hostname = options.hostname || "localhost";
            this.port = options.port;
            this.query = options.query || {};
            this.headers = options.headers || {};
            this.body = options.body;
            this.protocol = options.protocol
                ? options.protocol.slice(-1) !== ":"
                    ? `${options.protocol}:`
                    : options.protocol
                : "https:";
            this.path = options.path ? (options.path.charAt(0) !== "/" ? `/${options.path}` : options.path) : "/";
            this.username = options.username;
            this.password = options.password;
            this.fragment = options.fragment;
        }
        static clone(request) {
            const cloned = new HttpRequest({
                ...request,
                headers: { ...request.headers },
            });
            if (cloned.query) {
                cloned.query = cloneQuery(cloned.query);
            }
            return cloned;
        }
        static isInstance(request) {
            if (!request) {
                return false;
            }
            const req = request;
            return ("method" in req &&
                "protocol" in req &&
                "hostname" in req &&
                "path" in req &&
                typeof req["query"] === "object" &&
                typeof req["headers"] === "object");
        }
        clone() {
            return HttpRequest.clone(this);
        }
    }
    function cloneQuery(query) {
        return Object.keys(query).reduce((carry, paramName) => {
            const param = query[paramName];
            return {
                ...carry,
                [paramName]: Array.isArray(param) ? [...param] : param,
            };
        }, {});
    }

    class HttpResponse {
        statusCode;
        reason;
        headers;
        body;
        constructor(options) {
            this.statusCode = options.statusCode;
            this.reason = options.reason;
            this.headers = options.headers || {};
            this.body = options.body;
        }
        static isInstance(response) {
            if (!response)
                return false;
            const resp = response;
            return typeof resp.statusCode === "number" && typeof resp.headers === "object";
        }
    }

    const VALID_HOST_LABEL_REGEX = new RegExp(`^(?!.*-$)(?!-)[a-zA-Z0-9-]{1,63}$`);
    const isValidHostLabel = (value, allowSubDomains = false) => {
        if (!allowSubDomains) {
            return VALID_HOST_LABEL_REGEX.test(value);
        }
        const labels = value.split(".");
        for (const label of labels) {
            if (!isValidHostLabel(label)) {
                return false;
            }
        }
        return true;
    };

    function isValidHostname(hostname) {
        const hostPattern = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
        return hostPattern.test(hostname);
    }

    const normalizeProvider$1 = (input) => {
        if (typeof input === "function")
            return input;
        const promisified = Promise.resolve(input);
        return () => promisified;
    };

    function parseQueryString(querystring) {
        const query = {};
        querystring = querystring.replace(/^\?/, "");
        if (querystring) {
            for (const pair of querystring.split("&")) {
                let [key, value = null] = pair.split("=");
                key = decodeURIComponent(key);
                if (value) {
                    value = decodeURIComponent(value);
                }
                if (!(key in query)) {
                    query[key] = value;
                }
                else if (Array.isArray(query[key])) {
                    query[key].push(value);
                }
                else {
                    query[key] = [query[key], value];
                }
            }
        }
        return query;
    }

    const parseUrl = (url) => {
        if (typeof url === "string") {
            return parseUrl(new URL(url));
        }
        const { hostname, pathname, port, protocol, search } = url;
        let query;
        if (search) {
            query = parseQueryString(search);
        }
        return {
            hostname,
            port: port ? parseInt(port) : undefined,
            protocol,
            path: pathname,
            query,
        };
    };

    const toEndpointV1 = (endpoint) => {
        if (typeof endpoint === "object") {
            if ("url" in endpoint) {
                const v1Endpoint = parseUrl(endpoint.url);
                if (endpoint.headers) {
                    v1Endpoint.headers = {};
                    for (const name in endpoint.headers) {
                        if (!hasOwn(endpoint.headers, name))
                            continue;
                        v1Endpoint.headers[name.toLowerCase()] = endpoint.headers[name].join(", ");
                    }
                }
                return v1Endpoint;
            }
            return endpoint;
        }
        return parseUrl(endpoint);
    };

    const invalidProvider = (message) => () => Promise.reject(message);

    class Client {
        config;
        middlewareStack = constructStack();
        initConfig;
        handlers;
        constructor(config) {
            this.config = config;
            const { protocol, protocolSettings } = config;
            if (protocolSettings) {
                if (typeof protocol === "function") {
                    config.protocol = new protocol(protocolSettings);
                }
            }
        }
        send(command, optionsOrCb, cb) {
            const options = typeof optionsOrCb !== "function" ? optionsOrCb : undefined;
            const callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
            const useHandlerCache = options === undefined && this.config.cacheMiddleware === true;
            let handler;
            if (useHandlerCache) {
                if (!this.handlers) {
                    this.handlers = new WeakMap();
                }
                const handlers = this.handlers;
                if (handlers.has(command.constructor)) {
                    handler = handlers.get(command.constructor);
                }
                else {
                    handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
                    handlers.set(command.constructor, handler);
                }
            }
            else {
                delete this.handlers;
                handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
            }
            if (callback) {
                handler(command)
                    .then((result) => callback(null, result.output), (err) => callback(err))
                    .catch(() => { });
            }
            else {
                return handler(command).then((result) => result.output);
            }
        }
        destroy() {
            this.config?.requestHandler?.destroy?.();
            delete this.handlers;
        }
    }

    const deref = (schemaRef) => {
        if (typeof schemaRef === "function") {
            return schemaRef();
        }
        return schemaRef;
    };

    const operation = (namespace, name, traits, input, output) => ({
        name,
        namespace,
        traits,
        input,
        output,
    });

    const schemaDeserializationMiddleware = (config) => (next, context) => async (args) => {
        const { response } = await next(args);
        const { operationSchema } = getSmithyContext(context);
        const [, ns, n, t, i, o] = operationSchema ?? [];
        try {
            const parsed = await config.protocol.deserializeResponse(operation(ns, n, t, i, o), {
                ...config,
                ...context,
            }, response);
            return {
                response,
                output: parsed,
            };
        }
        catch (error) {
            Object.defineProperty(error, "$response", {
                value: response,
                enumerable: false,
                writable: false,
                configurable: false,
            });
            if (!("$metadata" in error)) {
                const hint = `Deserialization error: to see the raw response, inspect the hidden field {error}.$response on this object.`;
                try {
                    error.message += "\n  " + hint;
                }
                catch (ignored) {
                    if (!context.logger || context.logger?.constructor?.name === "NoOpLogger") {
                        console.warn(hint);
                    }
                    else {
                        context.logger?.warn?.(hint);
                    }
                }
                if (typeof error.$responseBodyText !== "undefined") {
                    if (error.$response) {
                        error.$response.body = error.$responseBodyText;
                    }
                }
                try {
                    if (HttpResponse.isInstance(response)) {
                        const { headers = {}, statusCode } = response;
                        const headerEntries = Object.entries(headers);
                        error.$metadata = {
                            httpStatusCode: statusCode,
                            requestId: findHeader(/^x-[\w-]+-request-?id$/, headerEntries),
                            extendedRequestId: findHeader(/^x-[\w-]+-id-2$/, headerEntries),
                            cfId: findHeader(/^x-[\w-]+-cf-id$/, headerEntries),
                        };
                    }
                }
                catch (ignored) {
                }
            }
            throw error;
        }
    };
    const findHeader = (pattern, headers) => {
        return (headers.find(([k]) => {
            return k.match(pattern);
        }) || [void 0, void 0])[1];
    };

    const schemaSerializationMiddleware = (config) => (next, context) => async (args) => {
        const { operationSchema } = getSmithyContext(context);
        const [, ns, n, t, i, o] = operationSchema ?? [];
        const endpoint = context.endpointV2
            ? async () => toEndpointV1(context.endpointV2)
            : config.endpoint;
        const request = await config.protocol.serializeRequest(operation(ns, n, t, i, o), args.input, {
            ...config,
            ...context,
            endpoint,
        });
        return next({
            ...args,
            request,
        });
    };

    const deserializerMiddlewareOption = {
        name: "deserializerMiddleware",
        step: "deserialize",
        tags: ["DESERIALIZER"],
        override: true,
    };
    const serializerMiddlewareOption$1 = {
        name: "serializerMiddleware",
        step: "serialize",
        tags: ["SERIALIZER"],
        override: true,
    };
    function getSchemaSerdePlugin(config) {
        return {
            applyToStack: (commandStack) => {
                commandStack.add(schemaSerializationMiddleware(config), serializerMiddlewareOption$1);
                commandStack.add(schemaDeserializationMiddleware(config), deserializerMiddlewareOption);
                config.protocol.setSerdeContext(config);
            },
        };
    }

    const traitsCache = [];
    function translateTraits(indicator) {
        if (typeof indicator === "object") {
            return indicator;
        }
        indicator = indicator | 0;
        if (traitsCache[indicator]) {
            return traitsCache[indicator];
        }
        const traits = {};
        let i = 0;
        for (const trait of [
            "httpLabel",
            "idempotent",
            "idempotencyToken",
            "sensitive",
            "httpPayload",
            "httpResponseCode",
            "httpQueryParams",
        ]) {
            if (((indicator >> i++) & 1) === 1) {
                traits[trait] = 1;
            }
        }
        return (traitsCache[indicator] = traits);
    }

    const anno = {
        it: Symbol.for("@smithy/nor-struct-it"),
        ns: Symbol.for("@smithy/ns"),
    };
    const simpleSchemaCacheN = [];
    const simpleSchemaCacheS = {};
    class NormalizedSchema {
        ref;
        memberName;
        static symbol = Symbol.for("@smithy/nor");
        symbol = NormalizedSchema.symbol;
        name;
        schema;
        _isMemberSchema;
        traits;
        memberTraits;
        normalizedTraits;
        constructor(ref, memberName) {
            this.ref = ref;
            this.memberName = memberName;
            const traitStack = [];
            let _ref = ref;
            let schema = ref;
            this._isMemberSchema = false;
            while (isMemberSchema(_ref)) {
                traitStack.push(_ref[1]);
                _ref = _ref[0];
                schema = deref(_ref);
                this._isMemberSchema = true;
            }
            if (traitStack.length > 0) {
                this.memberTraits = {};
                for (let i = traitStack.length - 1; i >= 0; --i) {
                    const traitSet = traitStack[i];
                    Object.assign(this.memberTraits, translateTraits(traitSet));
                }
            }
            else {
                this.memberTraits = 0;
            }
            if (schema instanceof NormalizedSchema) {
                const computedMemberTraits = this.memberTraits;
                Object.assign(this, schema);
                this.memberTraits = Object.assign({}, computedMemberTraits, schema.getMemberTraits(), this.getMemberTraits());
                this.normalizedTraits = void 0;
                this.memberName = memberName ?? schema.memberName;
                return;
            }
            this.schema = deref(schema);
            if (isStaticSchema(this.schema)) {
                this.name = `${this.schema[1]}#${this.schema[2]}`;
                this.traits = this.schema[3];
            }
            else {
                this.name = this.memberName ?? String(schema);
                this.traits = 0;
            }
            if (this._isMemberSchema && !memberName) {
                throw new Error(`@smithy/core/schema - NormalizedSchema member init ${this.getName(true)} missing member name.`);
            }
        }
        static [Symbol.hasInstance](lhs) {
            const isPrototype = this.prototype.isPrototypeOf(lhs);
            if (!isPrototype && typeof lhs === "object" && lhs !== null) {
                const ns = lhs;
                return ns.symbol === this.symbol;
            }
            return isPrototype;
        }
        static of(ref) {
            const keyAble = typeof ref === "function" || (typeof ref === "object" && ref !== null);
            if (typeof ref === "number") {
                if (simpleSchemaCacheN[ref]) {
                    return simpleSchemaCacheN[ref];
                }
            }
            else if (typeof ref === "string") {
                if (simpleSchemaCacheS[ref]) {
                    return simpleSchemaCacheS[ref];
                }
            }
            else if (keyAble) {
                if (ref[anno.ns]) {
                    return ref[anno.ns];
                }
            }
            const sc = deref(ref);
            if (sc instanceof NormalizedSchema) {
                return sc;
            }
            if (isMemberSchema(sc)) {
                const [ns, traits] = sc;
                if (ns instanceof NormalizedSchema) {
                    Object.assign(ns.getMergedTraits(), translateTraits(traits));
                    return ns;
                }
                throw new Error(`@smithy/core/schema - may not init unwrapped member schema=${JSON.stringify(ref, null, 2)}.`);
            }
            const ns = new NormalizedSchema(sc);
            if (keyAble) {
                return (ref[anno.ns] = ns);
            }
            if (typeof sc === "string") {
                return (simpleSchemaCacheS[sc] = ns);
            }
            if (typeof sc === "number") {
                return (simpleSchemaCacheN[sc] = ns);
            }
            return ns;
        }
        getSchema() {
            const sc = this.schema;
            if (Array.isArray(sc) && sc[0] === 0) {
                return sc[4];
            }
            return sc;
        }
        getName(withNamespace = false) {
            const { name } = this;
            const short = !withNamespace && name && name.includes("#");
            return short ? name.split("#")[1] : name || undefined;
        }
        getMemberName() {
            return this.memberName;
        }
        isMemberSchema() {
            return this._isMemberSchema;
        }
        isListSchema() {
            const sc = this.getSchema();
            return typeof sc === "number"
                ? sc >= 64 && sc < 128
                : sc[0] === 1;
        }
        isMapSchema() {
            const sc = this.getSchema();
            return typeof sc === "number"
                ? sc >= 128 && sc <= 0b1111_1111
                : sc[0] === 2;
        }
        isStructSchema() {
            const sc = this.getSchema();
            if (typeof sc !== "object") {
                return false;
            }
            const id = sc[0];
            return (id === 3 ||
                id === -3 ||
                id === 4);
        }
        isUnionSchema() {
            const sc = this.getSchema();
            if (typeof sc !== "object") {
                return false;
            }
            return sc[0] === 4;
        }
        isBlobSchema() {
            const sc = this.getSchema();
            return sc === 21 || sc === 42;
        }
        isTimestampSchema() {
            const sc = this.getSchema();
            return (typeof sc === "number" &&
                sc >= 4 &&
                sc <= 7);
        }
        isUnitSchema() {
            return this.getSchema() === "unit";
        }
        isDocumentSchema() {
            return this.getSchema() === 15;
        }
        isStringSchema() {
            return this.getSchema() === 0;
        }
        isBooleanSchema() {
            return this.getSchema() === 2;
        }
        isNumericSchema() {
            return this.getSchema() === 1;
        }
        isBigIntegerSchema() {
            return this.getSchema() === 17;
        }
        isBigDecimalSchema() {
            return this.getSchema() === 19;
        }
        isStreaming() {
            const { streaming } = this.getMergedTraits();
            return !!streaming || this.getSchema() === 42;
        }
        isIdempotencyToken() {
            return !!this.getMergedTraits().idempotencyToken;
        }
        getMergedTraits() {
            return (this.normalizedTraits ??
                (this.normalizedTraits = {
                    ...this.getOwnTraits(),
                    ...this.getMemberTraits(),
                }));
        }
        getMemberTraits() {
            return translateTraits(this.memberTraits);
        }
        getOwnTraits() {
            return translateTraits(this.traits);
        }
        getKeySchema() {
            const [isDoc, isMap] = [this.isDocumentSchema(), this.isMapSchema()];
            if (!isDoc && !isMap) {
                throw new Error(`@smithy/core/schema - cannot get key for non-map: ${this.getName(true)}`);
            }
            const schema = this.getSchema();
            const memberSchema = isDoc
                ? 15
                : (schema[4] ?? 0);
            return member([memberSchema, 0], "key");
        }
        getValueSchema() {
            const sc = this.getSchema();
            const [isDoc, isMap, isList] = [this.isDocumentSchema(), this.isMapSchema(), this.isListSchema()];
            const memberSchema = typeof sc === "number"
                ? 0b0011_1111 & sc
                : sc && typeof sc === "object" && (isMap || isList)
                    ? sc[3 + sc[0]]
                    : isDoc
                        ? 15
                        : void 0;
            if (memberSchema != null) {
                return member([memberSchema, 0], isMap ? "value" : "member");
            }
            throw new Error(`@smithy/core/schema - ${this.getName(true)} has no value member.`);
        }
        getMemberSchema(memberName) {
            const struct = this.getSchema();
            if (this.isStructSchema() && struct[4].includes(memberName)) {
                const i = struct[4].indexOf(memberName);
                const memberSchema = struct[5][i];
                return member(isMemberSchema(memberSchema) ? memberSchema : [memberSchema, 0], memberName);
            }
            if (this.isDocumentSchema()) {
                return member([15, 0], memberName);
            }
            throw new Error(`@smithy/core/schema - ${this.getName(true)} has no member=${memberName}.`);
        }
        getMemberSchemas() {
            const buffer = {};
            try {
                for (const [k, v] of this.structIterator()) {
                    buffer[k] = v;
                }
            }
            catch (ignored) { }
            return buffer;
        }
        getEventStreamMember() {
            if (this.isStructSchema()) {
                for (const [memberName, memberSchema] of this.structIterator()) {
                    if (memberSchema.isStreaming() && memberSchema.isStructSchema()) {
                        return memberName;
                    }
                }
            }
            return "";
        }
        *structIterator() {
            if (this.isUnitSchema()) {
                return;
            }
            if (!this.isStructSchema()) {
                throw new Error("@smithy/core/schema - cannot iterate non-struct schema.");
            }
            const struct = this.getSchema();
            const z = struct[4].length;
            let it = struct[anno.it];
            if (it && z === it.length) {
                yield* it;
                return;
            }
            it = Array(z);
            for (let i = 0; i < z; ++i) {
                const k = struct[4][i];
                const v = member([struct[5][i], 0], k);
                yield (it[i] = [k, v]);
            }
            struct[anno.it] = it;
        }
    }
    function member(memberSchema, memberName) {
        if (memberSchema instanceof NormalizedSchema) {
            return Object.assign(memberSchema, {
                memberName,
                _isMemberSchema: true,
            });
        }
        const internalCtorAccess = NormalizedSchema;
        return new internalCtorAccess(memberSchema, memberName);
    }
    const isMemberSchema = (sc) => Array.isArray(sc) && sc.length === 2;
    const isStaticSchema = (sc) => Array.isArray(sc) && sc.length >= 5;

    class TypeRegistry {
        namespace;
        schemas;
        exceptions;
        static registries = new Map();
        constructor(namespace, schemas = new Map(), exceptions = new Map()) {
            this.namespace = namespace;
            this.schemas = schemas;
            this.exceptions = exceptions;
        }
        static for(namespace) {
            if (!TypeRegistry.registries.has(namespace)) {
                TypeRegistry.registries.set(namespace, new TypeRegistry(namespace));
            }
            return TypeRegistry.registries.get(namespace);
        }
        copyFrom(other) {
            const { schemas, exceptions } = this;
            for (const [k, v] of other.schemas) {
                if (!schemas.has(k)) {
                    schemas.set(k, v);
                }
            }
            for (const [k, v] of other.exceptions) {
                if (!exceptions.has(k)) {
                    exceptions.set(k, v);
                }
            }
        }
        register(shapeId, schema) {
            const qualifiedName = this.normalizeShapeId(shapeId);
            for (const r of [this, TypeRegistry.for(qualifiedName.split("#")[0])]) {
                r.schemas.set(qualifiedName, schema);
            }
        }
        getSchema(shapeId) {
            const id = this.normalizeShapeId(shapeId);
            if (!this.schemas.has(id)) {
                if (!shapeId.includes("#")) {
                    const suffix = "#" + shapeId;
                    const candidates = [];
                    for (const [shapeId, schema] of this.schemas.entries()) {
                        if (shapeId.endsWith(suffix)) {
                            candidates.push(schema);
                        }
                    }
                    if (candidates.length === 1) {
                        return candidates[0];
                    }
                }
                throw new Error(`@smithy/core/schema - schema not found for ${id}`);
            }
            return this.schemas.get(id);
        }
        registerError(es, ctor) {
            const $error = es;
            const ns = $error[1];
            for (const r of [this, TypeRegistry.for(ns)]) {
                r.schemas.set(ns + "#" + $error[2], $error);
                r.exceptions.set($error, ctor);
            }
        }
        getErrorCtor(es) {
            const $error = es;
            if (this.exceptions.has($error)) {
                return this.exceptions.get($error);
            }
            const registry = TypeRegistry.for($error[1]);
            return registry.exceptions.get($error);
        }
        getBaseException() {
            for (const exceptionKey of this.exceptions.keys()) {
                if (Array.isArray(exceptionKey)) {
                    const [, ns, name] = exceptionKey;
                    const id = ns + "#" + name;
                    if (id.startsWith("smithy.ts.sdk.synthetic.") && id.endsWith("ServiceException")) {
                        return exceptionKey;
                    }
                }
            }
            return undefined;
        }
        find(predicate) {
            for (const schema of this.schemas.values()) {
                if (predicate(schema)) {
                    return schema;
                }
            }
            return undefined;
        }
        clear() {
            this.schemas.clear();
            this.exceptions.clear();
        }
        normalizeShapeId(shapeId) {
            if (shapeId.includes("#")) {
                return shapeId;
            }
            return this.namespace + "#" + shapeId;
        }
    }

    const SENSITIVE_STRING = "***SensitiveInformation***";
    function schemaLogFilter(schema, data) {
        if (data == null) {
            return data;
        }
        const ns = NormalizedSchema.of(schema);
        if (ns.getMergedTraits().sensitive) {
            return SENSITIVE_STRING;
        }
        if (ns.isListSchema()) {
            const isSensitive = !!ns.getValueSchema().getMergedTraits().sensitive;
            if (isSensitive) {
                return SENSITIVE_STRING;
            }
        }
        else if (ns.isMapSchema()) {
            const isSensitive = !!ns.getKeySchema().getMergedTraits().sensitive || !!ns.getValueSchema().getMergedTraits().sensitive;
            if (isSensitive) {
                return SENSITIVE_STRING;
            }
        }
        else if (ns.isStructSchema() && typeof data === "object") {
            const object = data;
            const newObject = {};
            for (const [member, memberNs] of ns.structIterator()) {
                if (object[member] != null) {
                    newObject[member] = schemaLogFilter(memberNs, object[member]);
                }
            }
            return newObject;
        }
        return data;
    }

    class Command {
        middlewareStack = constructStack();
        schema;
        static classBuilder() {
            return new ClassBuilder();
        }
        resolveMiddlewareWithContext(clientStack, configuration, options, { middlewareFn, clientName, commandName, inputFilterSensitiveLog, outputFilterSensitiveLog, smithyContext, additionalContext, CommandCtor, }) {
            for (const mw of middlewareFn.bind(this)(CommandCtor, clientStack, configuration, options)) {
                this.middlewareStack.use(mw);
            }
            const stack = clientStack.concat(this.middlewareStack);
            const { logger } = configuration;
            const handlerExecutionContext = {
                logger,
                clientName,
                commandName,
                inputFilterSensitiveLog,
                outputFilterSensitiveLog,
                [SMITHY_CONTEXT_KEY]: {
                    commandInstance: this,
                    ...smithyContext,
                },
                ...additionalContext,
            };
            const { requestHandler } = configuration;
            let requestOptions = options ?? {};
            if (smithyContext.eventStream) {
                requestOptions = {
                    isEventStream: true,
                    ...requestOptions,
                };
            }
            return stack.resolve((request) => requestHandler.handle(request.request, requestOptions), handlerExecutionContext);
        }
    }
    class ClassBuilder {
        _init = () => { };
        _ep = {};
        _middlewareFn = () => [];
        _commandName = "";
        _clientName = "";
        _additionalContext = {};
        _smithyContext = {};
        _inputFilterSensitiveLog = undefined;
        _outputFilterSensitiveLog = undefined;
        _serializer = null;
        _deserializer = null;
        _operationSchema;
        init(cb) {
            this._init = cb;
        }
        ep(endpointParameterInstructions) {
            this._ep = endpointParameterInstructions;
            return this;
        }
        m(middlewareSupplier) {
            this._middlewareFn = middlewareSupplier;
            return this;
        }
        s(service, operation, smithyContext = {}) {
            this._smithyContext = {
                service,
                operation,
                ...smithyContext,
            };
            return this;
        }
        c(additionalContext = {}) {
            this._additionalContext = additionalContext;
            return this;
        }
        n(clientName, commandName) {
            this._clientName = clientName;
            this._commandName = commandName;
            return this;
        }
        f(inputFilter = (_) => _, outputFilter = (_) => _) {
            this._inputFilterSensitiveLog = inputFilter;
            this._outputFilterSensitiveLog = outputFilter;
            return this;
        }
        ser(serializer) {
            this._serializer = serializer;
            return this;
        }
        de(deserializer) {
            this._deserializer = deserializer;
            return this;
        }
        sc(operation) {
            this._operationSchema = operation;
            this._smithyContext.operationSchema = operation;
            return this;
        }
        build() {
            const closure = this;
            let CommandRef;
            return (CommandRef = class extends Command {
                input;
                static getEndpointParameterInstructions() {
                    return closure._ep;
                }
                constructor(...[input]) {
                    super();
                    this.input = input ?? {};
                    closure._init(this);
                    this.schema = closure._operationSchema;
                }
                resolveMiddleware(stack, configuration, options) {
                    const op = closure._operationSchema;
                    const input = op?.[4] ?? op?.input;
                    const output = op?.[5] ?? op?.output;
                    return this.resolveMiddlewareWithContext(stack, configuration, options, {
                        CommandCtor: CommandRef,
                        middlewareFn: closure._middlewareFn,
                        clientName: closure._clientName,
                        commandName: closure._commandName,
                        inputFilterSensitiveLog: closure._inputFilterSensitiveLog ?? (op ? schemaLogFilter.bind(null, input) : (_) => _),
                        outputFilterSensitiveLog: closure._outputFilterSensitiveLog ?? (op ? schemaLogFilter.bind(null, output) : (_) => _),
                        smithyContext: closure._smithyContext,
                        additionalContext: closure._additionalContext,
                    });
                }
                serialize = closure._serializer;
                deserialize = closure._deserializer;
            });
        }
    }

    class ServiceException extends Error {
        $fault;
        $response;
        $retryable;
        $metadata;
        constructor(options) {
            super(options.message);
            Object.setPrototypeOf(this, Object.getPrototypeOf(this).constructor.prototype);
            this.name = options.name;
            this.$fault = options.$fault;
            this.$metadata = options.$metadata;
        }
        static isInstance(value) {
            if (!value)
                return false;
            const candidate = value;
            return (ServiceException.prototype.isPrototypeOf(candidate) ||
                (Boolean(candidate.$fault) &&
                    Boolean(candidate.$metadata) &&
                    (candidate.$fault === "client" || candidate.$fault === "server")));
        }
        static [Symbol.hasInstance](instance) {
            if (!instance)
                return false;
            const candidate = instance;
            if (this === ServiceException) {
                return ServiceException.isInstance(instance);
            }
            if (ServiceException.isInstance(instance)) {
                if (candidate.name && this.name) {
                    return this.prototype.isPrototypeOf(instance) || candidate.name === this.name;
                }
                return this.prototype.isPrototypeOf(instance);
            }
            return false;
        }
    }
    const decorateServiceException = (exception, additions = {}) => {
        Object.entries(additions)
            .filter(([, v]) => v !== undefined)
            .forEach(([k, v]) => {
            if (exception[k] == undefined || exception[k] === "") {
                exception[k] = v;
            }
        });
        const message = exception.message || exception.Message || "UnknownError";
        exception.message = message;
        delete exception.Message;
        return exception;
    };

    const loadConfigsForDefaultMode = (mode) => {
        switch (mode) {
            case "standard":
                return {
                    retryMode: "standard",
                    connectionTimeout: 3100,
                };
            case "in-region":
                return {
                    retryMode: "standard",
                    connectionTimeout: 1100,
                };
            case "cross-region":
                return {
                    retryMode: "standard",
                    connectionTimeout: 3100,
                };
            case "mobile":
                return {
                    retryMode: "standard",
                    connectionTimeout: 30000,
                };
            default:
                return {};
        }
    };

    const knownAlgorithms = Object.values(AlgorithmId);
    const getChecksumConfiguration = (runtimeConfig) => {
        const checksumAlgorithms = [];
        for (const id in AlgorithmId) {
            if (!hasOwn(AlgorithmId, id))
                continue;
            const algorithmId = AlgorithmId[id];
            if (runtimeConfig[algorithmId] === undefined) {
                continue;
            }
            checksumAlgorithms.push({
                algorithmId: () => algorithmId,
                checksumConstructor: () => runtimeConfig[algorithmId],
            });
        }
        for (const [id, ChecksumCtor] of Object.entries(runtimeConfig.checksumAlgorithms ?? {})) {
            checksumAlgorithms.push({
                algorithmId: () => id,
                checksumConstructor: () => ChecksumCtor,
            });
        }
        return {
            addChecksumAlgorithm(algo) {
                runtimeConfig.checksumAlgorithms = runtimeConfig.checksumAlgorithms ?? {};
                const id = algo.algorithmId();
                const ctor = algo.checksumConstructor();
                if (knownAlgorithms.includes(id)) {
                    runtimeConfig.checksumAlgorithms[id.toUpperCase()] = ctor;
                }
                else {
                    runtimeConfig.checksumAlgorithms[id] = ctor;
                }
                checksumAlgorithms.push(algo);
            },
            checksumAlgorithms() {
                return checksumAlgorithms;
            },
        };
    };
    const resolveChecksumRuntimeConfig = (clientConfig) => {
        const runtimeConfig = {};
        clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
            const id = checksumAlgorithm.algorithmId();
            if (knownAlgorithms.includes(id)) {
                runtimeConfig[id] = checksumAlgorithm.checksumConstructor();
            }
        });
        return runtimeConfig;
    };

    const getRetryConfiguration = (runtimeConfig) => {
        return {
            setRetryStrategy(retryStrategy) {
                runtimeConfig.retryStrategy = retryStrategy;
            },
            retryStrategy() {
                return runtimeConfig.retryStrategy;
            },
        };
    };
    const resolveRetryRuntimeConfig = (retryStrategyConfiguration) => {
        const runtimeConfig = {};
        runtimeConfig.retryStrategy = retryStrategyConfiguration.retryStrategy();
        return runtimeConfig;
    };

    const getDefaultExtensionConfiguration = (runtimeConfig) => {
        return Object.assign(getChecksumConfiguration(runtimeConfig), getRetryConfiguration(runtimeConfig));
    };
    const resolveDefaultRuntimeConfig = (config) => {
        return Object.assign(resolveChecksumRuntimeConfig(config), resolveRetryRuntimeConfig(config));
    };

    class NoOpLogger {
        trace() { }
        debug() { }
        info() { }
        warn() { }
        error() { }
    }

    function makeBuilder(common, service, name, ep) {
        return function makeCommand(added, plugins, op, $, smithyContext = {}) {
            const epMerged = Object.assign({}, common, added);
            return Command.classBuilder()
                .ep(epMerged)
                .m(function (CommandCtor, clientStack, config, options) {
                const list = plugins.call(this, CommandCtor, clientStack, config, options);
                list.unshift(ep(config, CommandCtor.getEndpointParameterInstructions()));
                return list;
            })
                .s(service, op, smithyContext)
                .n(name, op.charAt(0).toUpperCase() + op.slice(1) + "Command")
                .sc($)
                .build();
        };
    }

    const chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`;
    const alphabetByEncoding = Object.entries(chars).reduce((acc, [i, c]) => {
        acc[c] = Number(i);
        return acc;
    }, {});
    const alphabetByValue = chars.split("");
    const bitsPerLetter = 6;
    const bitsPerByte = 8;
    const maxLetterValue = 0b111111;

    const fromBase64 = (input) => {
        let totalByteLength = (input.length / 4) * 3;
        if (input.slice(-2) === "==") {
            totalByteLength -= 2;
        }
        else if (input.slice(-1) === "=") {
            totalByteLength--;
        }
        const out = new ArrayBuffer(totalByteLength);
        const dataView = new DataView(out);
        for (let i = 0; i < input.length; i += 4) {
            let bits = 0;
            let bitLength = 0;
            for (let j = i, limit = i + 3; j <= limit; j++) {
                if (input[j] !== "=") {
                    if (!(input[j] in alphabetByEncoding)) {
                        throw new TypeError(`Invalid character ${input[j]} in base64 string.`);
                    }
                    bits |= alphabetByEncoding[input[j]] << ((limit - j) * bitsPerLetter);
                    bitLength += bitsPerLetter;
                }
                else {
                    bits >>= bitsPerLetter;
                }
            }
            const chunkOffset = (i / 4) * 3;
            bits >>= bitLength % bitsPerByte;
            const byteLength = Math.floor(bitLength / bitsPerByte);
            for (let k = 0; k < byteLength; k++) {
                const offset = (byteLength - k - 1) * bitsPerByte;
                dataView.setUint8(chunkOffset + k, (bits & (255 << offset)) >> offset);
            }
        }
        return new Uint8Array(out);
    };

    const fromUtf8 = (input) => new TextEncoder().encode(input);

    function toBase64(_input) {
        let input;
        if (typeof _input === "string") {
            input = fromUtf8(_input);
        }
        else {
            input = _input;
        }
        const isArrayLike = typeof input === "object" && typeof input.length === "number";
        const isUint8Array = typeof input === "object" &&
            typeof input.byteOffset === "number" &&
            typeof input.byteLength === "number";
        if (!isArrayLike && !isUint8Array) {
            throw new Error("@smithy/util-base64: toBase64 encoder function only accepts string | Uint8Array.");
        }
        let str = "";
        for (let i = 0; i < input.length; i += 3) {
            let bits = 0;
            let bitLength = 0;
            for (let j = i, limit = Math.min(i + 3, input.length); j < limit; j++) {
                bits |= input[j] << ((limit - j - 1) * bitsPerByte);
                bitLength += bitsPerByte;
            }
            const bitClusterCount = Math.ceil(bitLength / bitsPerLetter);
            bits <<= bitClusterCount * bitsPerLetter - bitLength;
            for (let k = 1; k <= bitClusterCount; k++) {
                const offset = (bitClusterCount - k) * bitsPerLetter;
                str += alphabetByValue[(bits & (maxLetterValue << offset)) >> offset];
            }
            str += "==".slice(0, 4 - bitClusterCount);
        }
        return str;
    }

    function bindUint8ArrayBlobAdapter(toUtf8, fromUtf8, toBase64, fromBase64) {
        return class Uint8ArrayBlobAdapter extends Uint8Array {
            static fromString(source, encoding = "utf-8") {
                if (typeof source === "string") {
                    if (encoding === "base64") {
                        return Uint8ArrayBlobAdapter.mutate(fromBase64(source));
                    }
                    return Uint8ArrayBlobAdapter.mutate(fromUtf8(source));
                }
                throw new Error(`Unsupported conversion from ${typeof source} to Uint8ArrayBlobAdapter.`);
            }
            static mutate(source) {
                Object.setPrototypeOf(source, Uint8ArrayBlobAdapter.prototype);
                return source;
            }
            transformToString(encoding = "utf-8") {
                if (encoding === "base64") {
                    return toBase64(this);
                }
                return toUtf8(this);
            }
        };
    }

    const toUtf8 = (input) => {
        if (typeof input === "string") {
            return input;
        }
        if (typeof input !== "object" || typeof input.byteOffset !== "number" || typeof input.byteLength !== "number") {
            throw new Error("@smithy/util-utf8: toUtf8 encoder function only accepts string | Uint8Array.");
        }
        return new TextDecoder("utf-8").decode(input);
    };

    const decimalToHex = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    function bindV4(getRandomValues) {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return () => crypto.randomUUID();
        }
        return () => {
            const rnds = new Uint8Array(16);
            getRandomValues(rnds);
            rnds[6] = (rnds[6] & 0x0f) | 0x40;
            rnds[8] = (rnds[8] & 0x3f) | 0x80;
            return (decimalToHex[rnds[0]] +
                decimalToHex[rnds[1]] +
                decimalToHex[rnds[2]] +
                decimalToHex[rnds[3]] +
                "-" +
                decimalToHex[rnds[4]] +
                decimalToHex[rnds[5]] +
                "-" +
                decimalToHex[rnds[6]] +
                decimalToHex[rnds[7]] +
                "-" +
                decimalToHex[rnds[8]] +
                decimalToHex[rnds[9]] +
                "-" +
                decimalToHex[rnds[10]] +
                decimalToHex[rnds[11]] +
                decimalToHex[rnds[12]] +
                decimalToHex[rnds[13]] +
                decimalToHex[rnds[14]] +
                decimalToHex[rnds[15]]);
        };
    }

    const expectNumber = (value) => {
        if (value === null || value === undefined) {
            return undefined;
        }
        if (typeof value === "string") {
            const parsed = parseFloat(value);
            if (!Number.isNaN(parsed)) {
                if (String(parsed) !== String(value)) {
                    logger.warn(stackTraceWarning(`Expected number but observed string: ${value}`));
                }
                return parsed;
            }
        }
        if (typeof value === "number") {
            return value;
        }
        throw new TypeError(`Expected number, got ${typeof value}: ${value}`);
    };
    const MAX_FLOAT = Math.ceil(2 ** 127 * (2 - 2 ** -23));
    const expectFloat32 = (value) => {
        const expected = expectNumber(value);
        if (expected !== undefined && !Number.isNaN(expected) && expected !== Infinity && expected !== -Infinity) {
            if (Math.abs(expected) > MAX_FLOAT) {
                throw new TypeError(`Expected 32-bit float, got ${value}`);
            }
        }
        return expected;
    };
    const expectLong = (value) => {
        if (value === null || value === undefined) {
            return undefined;
        }
        if (Number.isInteger(value) && !Number.isNaN(value)) {
            return value;
        }
        throw new TypeError(`Expected integer, got ${typeof value}: ${value}`);
    };
    const expectShort = (value) => expectSizedInt(value, 16);
    const expectByte = (value) => expectSizedInt(value, 8);
    const expectSizedInt = (value, size) => {
        const expected = expectLong(value);
        if (expected !== undefined && castInt(expected, size) !== expected) {
            throw new TypeError(`Expected ${size}-bit integer, got ${value}`);
        }
        return expected;
    };
    const castInt = (value, size) => {
        switch (size) {
            case 32:
                return Int32Array.of(value)[0];
            case 16:
                return Int16Array.of(value)[0];
            case 8:
                return Int8Array.of(value)[0];
        }
    };
    const strictParseDouble = (value) => {
        if (typeof value == "string") {
            return expectNumber(parseNumber(value));
        }
        return expectNumber(value);
    };
    const strictParseFloat32 = (value) => {
        if (typeof value == "string") {
            return expectFloat32(parseNumber(value));
        }
        return expectFloat32(value);
    };
    const NUMBER_REGEX = /(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|(-?Infinity)|(NaN)/g;
    const parseNumber = (value) => {
        const matches = value.match(NUMBER_REGEX);
        if (matches === null || matches[0].length !== value.length) {
            throw new TypeError(`Expected real number, got implicit NaN`);
        }
        return parseFloat(value);
    };
    const strictParseShort = (value) => {
        if (typeof value === "string") {
            return expectShort(parseNumber(value));
        }
        return expectShort(value);
    };
    const strictParseByte = (value) => {
        if (typeof value === "string") {
            return expectByte(parseNumber(value));
        }
        return expectByte(value);
    };
    const stackTraceWarning = (message) => {
        return String(new TypeError(message).stack || message)
            .split("\n")
            .slice(0, 5)
            .filter((s) => !s.includes("stackTraceWarning"))
            .join("\n");
    };
    const logger = {
        warn: console.warn,
    };

    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function dateToUtcString(date) {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const dayOfWeek = date.getUTCDay();
        const dayOfMonthInt = date.getUTCDate();
        const hoursInt = date.getUTCHours();
        const minutesInt = date.getUTCMinutes();
        const secondsInt = date.getUTCSeconds();
        const dayOfMonthString = dayOfMonthInt < 10 ? `0${dayOfMonthInt}` : `${dayOfMonthInt}`;
        const hoursString = hoursInt < 10 ? `0${hoursInt}` : `${hoursInt}`;
        const minutesString = minutesInt < 10 ? `0${minutesInt}` : `${minutesInt}`;
        const secondsString = secondsInt < 10 ? `0${secondsInt}` : `${secondsInt}`;
        return `${DAYS[dayOfWeek]}, ${dayOfMonthString} ${MONTHS[month]} ${year} ${hoursString}:${minutesString}:${secondsString} GMT`;
    }
    const RFC3339_WITH_OFFSET$1 = new RegExp(/^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(([-+]\d{2}:\d{2})|[zZ])$/);
    const parseRfc3339DateTimeWithOffset = (value) => {
        if (value === null || value === undefined) {
            return undefined;
        }
        if (typeof value !== "string") {
            throw new TypeError("RFC-3339 date-times must be expressed as strings");
        }
        const match = RFC3339_WITH_OFFSET$1.exec(value);
        if (!match) {
            throw new TypeError("Invalid RFC-3339 date-time value");
        }
        const [_, yearStr, monthStr, dayStr, hours, minutes, seconds, fractionalMilliseconds, offsetStr] = match;
        const year = strictParseShort(stripLeadingZeroes(yearStr));
        const month = parseDateValue(monthStr, "month", 1, 12);
        const day = parseDateValue(dayStr, "day", 1, 31);
        const date = buildDate(year, month, day, { hours, minutes, seconds, fractionalMilliseconds });
        if (offsetStr.toUpperCase() != "Z") {
            date.setTime(date.getTime() - parseOffsetToMilliseconds(offsetStr));
        }
        return date;
    };
    const IMF_FIXDATE$1 = new RegExp(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/);
    const RFC_850_DATE$1 = new RegExp(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/);
    const ASC_TIME$1 = new RegExp(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( [1-9]|\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? (\d{4})$/);
    const parseRfc7231DateTime = (value) => {
        if (value === null || value === undefined) {
            return undefined;
        }
        if (typeof value !== "string") {
            throw new TypeError("RFC-7231 date-times must be expressed as strings");
        }
        let match = IMF_FIXDATE$1.exec(value);
        if (match) {
            const [_, dayStr, monthStr, yearStr, hours, minutes, seconds, fractionalMilliseconds] = match;
            return buildDate(strictParseShort(stripLeadingZeroes(yearStr)), parseMonthByShortName(monthStr), parseDateValue(dayStr, "day", 1, 31), { hours, minutes, seconds, fractionalMilliseconds });
        }
        match = RFC_850_DATE$1.exec(value);
        if (match) {
            const [_, dayStr, monthStr, yearStr, hours, minutes, seconds, fractionalMilliseconds] = match;
            return adjustRfc850Year(buildDate(parseTwoDigitYear(yearStr), parseMonthByShortName(monthStr), parseDateValue(dayStr, "day", 1, 31), {
                hours,
                minutes,
                seconds,
                fractionalMilliseconds,
            }));
        }
        match = ASC_TIME$1.exec(value);
        if (match) {
            const [_, monthStr, dayStr, hours, minutes, seconds, fractionalMilliseconds, yearStr] = match;
            return buildDate(strictParseShort(stripLeadingZeroes(yearStr)), parseMonthByShortName(monthStr), parseDateValue(dayStr.trimLeft(), "day", 1, 31), { hours, minutes, seconds, fractionalMilliseconds });
        }
        throw new TypeError("Invalid RFC-7231 date-time value");
    };
    const parseEpochTimestamp = (value) => {
        if (value === null || value === undefined) {
            return undefined;
        }
        let valueAsDouble;
        if (typeof value === "number") {
            valueAsDouble = value;
        }
        else if (typeof value === "string") {
            valueAsDouble = strictParseDouble(value);
        }
        else if (typeof value === "object" && value.tag === 1) {
            valueAsDouble = value.value;
        }
        else {
            throw new TypeError("Epoch timestamps must be expressed as floating point numbers or their string representation");
        }
        if (Number.isNaN(valueAsDouble) || valueAsDouble === Infinity || valueAsDouble === -Infinity) {
            throw new TypeError("Epoch timestamps must be valid, non-Infinite, non-NaN numerics");
        }
        return new Date(Math.round(valueAsDouble * 1000));
    };
    const buildDate = (year, month, day, time) => {
        const adjustedMonth = month - 1;
        validateDayOfMonth(year, adjustedMonth, day);
        return new Date(Date.UTC(year, adjustedMonth, day, parseDateValue(time.hours, "hour", 0, 23), parseDateValue(time.minutes, "minute", 0, 59), parseDateValue(time.seconds, "seconds", 0, 60), parseMilliseconds(time.fractionalMilliseconds)));
    };
    const parseTwoDigitYear = (value) => {
        const thisYear = new Date().getUTCFullYear();
        const valueInThisCentury = Math.floor(thisYear / 100) * 100 + strictParseShort(stripLeadingZeroes(value));
        if (valueInThisCentury < thisYear) {
            return valueInThisCentury + 100;
        }
        return valueInThisCentury;
    };
    const FIFTY_YEARS_IN_MILLIS = 50 * 365 * 24 * 60 * 60 * 1000;
    const adjustRfc850Year = (input) => {
        if (input.getTime() - new Date().getTime() > FIFTY_YEARS_IN_MILLIS) {
            return new Date(Date.UTC(input.getUTCFullYear() - 100, input.getUTCMonth(), input.getUTCDate(), input.getUTCHours(), input.getUTCMinutes(), input.getUTCSeconds(), input.getUTCMilliseconds()));
        }
        return input;
    };
    const parseMonthByShortName = (value) => {
        const monthIdx = MONTHS.indexOf(value);
        if (monthIdx < 0) {
            throw new TypeError(`Invalid month: ${value}`);
        }
        return monthIdx + 1;
    };
    const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const validateDayOfMonth = (year, month, day) => {
        let maxDays = DAYS_IN_MONTH[month];
        if (month === 1 && isLeapYear(year)) {
            maxDays = 29;
        }
        if (day > maxDays) {
            throw new TypeError(`Invalid day for ${MONTHS[month]} in ${year}: ${day}`);
        }
    };
    const isLeapYear = (year) => {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    };
    const parseDateValue = (value, type, lower, upper) => {
        const dateVal = strictParseByte(stripLeadingZeroes(value));
        if (dateVal < lower || dateVal > upper) {
            throw new TypeError(`${type} must be between ${lower} and ${upper}, inclusive`);
        }
        return dateVal;
    };
    const parseMilliseconds = (value) => {
        if (value === null || value === undefined) {
            return 0;
        }
        return strictParseFloat32("0." + value) * 1000;
    };
    const parseOffsetToMilliseconds = (value) => {
        const directionStr = value[0];
        let direction = 1;
        if (directionStr == "+") {
            direction = 1;
        }
        else if (directionStr == "-") {
            direction = -1;
        }
        else {
            throw new TypeError(`Offset direction, ${directionStr}, must be "+" or "-"`);
        }
        const hour = Number(value.substring(1, 3));
        const minute = Number(value.substring(4, 6));
        return direction * (hour * 60 + minute) * 60 * 1000;
    };
    const stripLeadingZeroes = (value) => {
        let idx = 0;
        while (idx < value.length - 1 && value.charAt(idx) === "0") {
            idx++;
        }
        if (idx === 0) {
            return value;
        }
        return value.slice(idx);
    };

    const LazyJsonString = function LazyJsonString(val) {
        const str = Object.assign(new String(val), {
            deserializeJSON() {
                return JSON.parse(String(val));
            },
            toString() {
                return String(val);
            },
            toJSON() {
                return String(val);
            },
        });
        return str;
    };
    LazyJsonString.from = (object) => {
        if (object && typeof object === "object" && (object instanceof LazyJsonString || "deserializeJSON" in object)) {
            return object;
        }
        else if (typeof object === "string" || Object.getPrototypeOf(object) === String.prototype) {
            return LazyJsonString(String(object));
        }
        return LazyJsonString(JSON.stringify(object));
    };
    LazyJsonString.fromObject = LazyJsonString.from;

    function quoteHeader(part) {
        if (part.includes(",") || part.includes('"')) {
            part = `"${part.replace(/"/g, '\\"')}"`;
        }
        return part;
    }

    const ddd = `(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:[ne|u?r]?s?day)?`;
    const mmm = `(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)`;
    const time = `(\\d?\\d):(\\d{2}):(\\d{2})(?:\\.(\\d+))?`;
    const date = `(\\d?\\d)`;
    const year = `(\\d{4})`;
    const RFC3339_WITH_OFFSET = new RegExp(/^(\d{4})-(\d\d)-(\d\d)[tT](\d\d):(\d\d):(\d\d)(\.(\d+))?(([-+]\d\d:\d\d)|[zZ])$/);
    const IMF_FIXDATE = new RegExp(`^${ddd}, ${date} ${mmm} ${year} ${time} GMT$`);
    const RFC_850_DATE = new RegExp(`^${ddd}, ${date}-${mmm}-(\\d\\d) ${time} GMT$`);
    const ASC_TIME = new RegExp(`^${ddd} ${mmm} ( [1-9]|\\d\\d) ${time} ${year}$`);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const _parseEpochTimestamp = (value) => {
        if (value == null) {
            return void 0;
        }
        let num = NaN;
        if (typeof value === "number") {
            num = value;
        }
        else if (typeof value === "string") {
            if (!/^-?\d*\.?\d+$/.test(value)) {
                throw new TypeError(`parseEpochTimestamp - numeric string invalid.`);
            }
            num = Number.parseFloat(value);
        }
        else if (typeof value === "object" && value.tag === 1) {
            num = value.value;
        }
        if (isNaN(num) || Math.abs(num) === Infinity) {
            throw new TypeError("Epoch timestamps must be valid finite numbers.");
        }
        return new Date(Math.round(num * 1000));
    };
    const _parseRfc3339DateTimeWithOffset = (value) => {
        if (value == null) {
            return void 0;
        }
        if (typeof value !== "string") {
            throw new TypeError("RFC3339 timestamps must be strings");
        }
        const matches = RFC3339_WITH_OFFSET.exec(value);
        if (!matches) {
            throw new TypeError(`Invalid RFC3339 timestamp format ${value}`);
        }
        const [, yearStr, monthStr, dayStr, hours, minutes, seconds, , ms, offsetStr] = matches;
        range(monthStr, 1, 12);
        range(dayStr, 1, 31);
        range(hours, 0, 23);
        range(minutes, 0, 59);
        range(seconds, 0, 60);
        const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), Number(hours), Number(minutes), Number(seconds), Number(ms) ? Math.round(parseFloat(`0.${ms}`) * 1000) : 0));
        date.setUTCFullYear(Number(yearStr));
        if (offsetStr.toUpperCase() != "Z") {
            const [, sign, offsetH, offsetM] = /([+-])(\d\d):(\d\d)/.exec(offsetStr) || [void 0, "+", 0, 0];
            const scalar = sign === "-" ? 1 : -1;
            date.setTime(date.getTime() + scalar * (Number(offsetH) * 60 * 60 * 1000 + Number(offsetM) * 60 * 1000));
        }
        return date;
    };
    const _parseRfc7231DateTime = (value) => {
        if (value == null) {
            return void 0;
        }
        if (typeof value !== "string") {
            throw new TypeError("RFC7231 timestamps must be strings.");
        }
        let day;
        let month;
        let year;
        let hour;
        let minute;
        let second;
        let fraction;
        let matches;
        if ((matches = IMF_FIXDATE.exec(value))) {
            [, day, month, year, hour, minute, second, fraction] = matches;
        }
        else if ((matches = RFC_850_DATE.exec(value))) {
            [, day, month, year, hour, minute, second, fraction] = matches;
            year = (Number(year) + 1900).toString();
        }
        else if ((matches = ASC_TIME.exec(value))) {
            [, month, day, hour, minute, second, fraction, year] = matches;
        }
        if (year && second) {
            const timestamp = Date.UTC(Number(year), months.indexOf(month), Number(day), Number(hour), Number(minute), Number(second), fraction ? Math.round(parseFloat(`0.${fraction}`) * 1000) : 0);
            range(day, 1, 31);
            range(hour, 0, 23);
            range(minute, 0, 59);
            range(second, 0, 60);
            const date = new Date(timestamp);
            date.setUTCFullYear(Number(year));
            return date;
        }
        throw new TypeError(`Invalid RFC7231 date-time value ${value}.`);
    };
    function range(v, min, max) {
        const _v = Number(v);
        if (_v < min || _v > max) {
            throw new Error(`Value ${_v} out of range [${min}, ${max}]`);
        }
    }

    function splitEvery(value, delimiter, numDelimiters) {
        if (!Number.isInteger(numDelimiters)) {
            throw new Error("Invalid number of delimiters (" + numDelimiters + ") for splitEvery.");
        }
        const segments = value.split(delimiter);
        const compoundSegments = [];
        let currentSegment = "";
        for (let i = 0; i < segments.length; i++) {
            if (currentSegment === "") {
                currentSegment = segments[i];
            }
            else {
                currentSegment += delimiter + segments[i];
            }
            if ((i + 1) % numDelimiters === 0) {
                compoundSegments.push(currentSegment);
                currentSegment = "";
            }
        }
        if (currentSegment !== "") {
            compoundSegments.push(currentSegment);
        }
        return compoundSegments;
    }

    const splitHeader = (value) => {
        const z = value.length;
        const values = [];
        let withinQuotes = false;
        let prevChar = undefined;
        let anchor = 0;
        for (let i = 0; i < z; ++i) {
            const char = value[i];
            switch (char) {
                case `"`:
                    if (prevChar !== "\\") {
                        withinQuotes = !withinQuotes;
                    }
                    break;
                case ",":
                    if (!withinQuotes) {
                        values.push(value.slice(anchor, i));
                        anchor = i + 1;
                    }
                    break;
            }
            prevChar = char;
        }
        values.push(value.slice(anchor));
        return values.map((v) => {
            v = v.trim();
            const z = v.length;
            if (z < 2) {
                return v;
            }
            if (v[0] === `"` && v[z - 1] === `"`) {
                v = v.slice(1, z - 1);
            }
            return v.replace(/\\"/g, '"');
        });
    };

    const format = /^-?((0|[1-9]\d*)(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;
    class NumericValue {
        string;
        type;
        constructor(string, type) {
            this.string = string;
            this.type = type;
            if (!format.test(string)) {
                throw new Error(`@smithy/core/serde - NumericValue string must conform to the Smithy bigDecimal format. Received: "${string}"`);
            }
        }
        toString() {
            return this.string;
        }
        static [Symbol.hasInstance](object) {
            if (!object || typeof object !== "object") {
                return false;
            }
            const _nv = object;
            return NumericValue.prototype.isPrototypeOf(object) || (_nv.type === "bigDecimal" && format.test(_nv.string));
        }
    }

    const SHORT_TO_HEX = {};
    const HEX_TO_SHORT = {};
    for (let i = 0; i < 256; i++) {
        let encodedByte = i.toString(16).toLowerCase();
        if (encodedByte.length === 1) {
            encodedByte = `0${encodedByte}`;
        }
        SHORT_TO_HEX[i] = encodedByte;
        HEX_TO_SHORT[encodedByte] = i;
    }
    function fromHex(encoded) {
        if (encoded.length % 2 !== 0) {
            throw new Error("Hex encoded strings must have an even number length");
        }
        const out = new Uint8Array(encoded.length / 2);
        for (let i = 0; i < encoded.length; i += 2) {
            const encodedByte = encoded.slice(i, i + 2).toLowerCase();
            if (encodedByte in HEX_TO_SHORT) {
                out[i / 2] = HEX_TO_SHORT[encodedByte];
            }
            else {
                throw new Error(`Cannot decode unrecognized sequence ${encodedByte} as hexadecimal`);
            }
        }
        return out;
    }
    function toHex(bytes) {
        let out = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            out += SHORT_TO_HEX[bytes[i]];
        }
        return out;
    }

    const TEXT_ENCODER = typeof TextEncoder == "function" ? new TextEncoder() : null;
    const calculateBodyLength = (body) => {
        if (typeof body === "string") {
            if (TEXT_ENCODER) {
                return TEXT_ENCODER.encode(body).byteLength;
            }
            let len = body.length;
            for (let i = len - 1; i >= 0; i--) {
                const code = body.charCodeAt(i);
                if (code > 0x7f && code <= 0x7ff)
                    len++;
                else if (code > 0x7ff && code <= 0xffff)
                    len += 2;
                if (code >= 0xdc00 && code <= 0xdfff)
                    i--;
            }
            return len;
        }
        else if (typeof body.byteLength === "number") {
            return body.byteLength;
        }
        else if (typeof body.size === "number") {
            return body.size;
        }
        throw new Error(`Body Length computation failed for ${body}`);
    };

    const toUint8Array = (data) => {
        if (data instanceof Uint8Array) {
            return data;
        }
        if (typeof data === "string") {
            return fromUtf8(data);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
        }
        return new Uint8Array(data);
    };

    function concatBytes(arrays, length) {
        if (length === undefined) {
            length = 0;
            for (const bytes of arrays) {
                length += bytes.byteLength;
            }
        }
        const result = new Uint8Array(length);
        let offset = 0;
        for (const buf of arrays) {
            result.set(buf, offset);
            offset += buf.byteLength;
        }
        return result;
    }

    const isArrayBuffer = (arg) => (typeof ArrayBuffer === "function" && arg instanceof ArrayBuffer) ||
        Object.prototype.toString.call(arg) === "[object ArrayBuffer]";

    const getEndpointFromConfig = async (serviceId) => undefined;

    const resolveParamsForS3 = async (endpointParams) => {
        const bucket = endpointParams?.Bucket || "";
        if (typeof endpointParams.Bucket === "string") {
            endpointParams.Bucket = bucket.replace(/#/g, encodeURIComponent("#")).replace(/\?/g, encodeURIComponent("?"));
        }
        if (isArnBucketName(bucket)) {
            if (endpointParams.ForcePathStyle === true) {
                throw new Error("Path-style addressing cannot be used with ARN buckets");
            }
        }
        else if (!isDnsCompatibleBucketName(bucket) ||
            (bucket.indexOf(".") !== -1 && !String(endpointParams.Endpoint).startsWith("http:")) ||
            bucket.toLowerCase() !== bucket ||
            bucket.length < 3) {
            endpointParams.ForcePathStyle = true;
        }
        if (endpointParams.DisableMultiRegionAccessPoints) {
            endpointParams.disableMultiRegionAccessPoints = true;
            endpointParams.DisableMRAP = true;
        }
        return endpointParams;
    };
    const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
    const IP_ADDRESS_PATTERN = /(\d+\.){3}\d+/;
    const DOTS_PATTERN = /\.\./;
    const isDnsCompatibleBucketName = (bucketName) => DOMAIN_PATTERN.test(bucketName) && !IP_ADDRESS_PATTERN.test(bucketName) && !DOTS_PATTERN.test(bucketName);
    const isArnBucketName = (bucketName) => {
        const [arn, partition, service, , , bucket] = bucketName.split(":");
        const isArn = arn === "arn" && bucketName.split(":").length >= 6;
        const isValidArn = Boolean(isArn && partition && service && bucket);
        if (isArn && !isValidArn) {
            throw new Error(`Invalid ARN: ${bucketName} was an invalid ARN.`);
        }
        return isValidArn;
    };

    const createConfigValueProvider = (configKey, canonicalEndpointParamKey, config, isClientContextParam = false) => {
        const configProvider = async () => {
            let configValue;
            if (isClientContextParam) {
                const clientContextParams = config.clientContextParams;
                const nestedValue = clientContextParams?.[configKey];
                configValue = nestedValue ?? config[configKey] ?? config[canonicalEndpointParamKey];
            }
            else {
                configValue = config[configKey] ?? config[canonicalEndpointParamKey];
            }
            if (typeof configValue === "function") {
                return configValue();
            }
            return configValue;
        };
        if (configKey === "credentialScope" || canonicalEndpointParamKey === "CredentialScope") {
            return async () => {
                const credentials = typeof config.credentials === "function" ? await config.credentials() : config.credentials;
                const configValue = credentials?.credentialScope ?? credentials?.CredentialScope;
                return configValue;
            };
        }
        if (configKey === "accountId" || canonicalEndpointParamKey === "AccountId") {
            return async () => {
                const credentials = typeof config.credentials === "function" ? await config.credentials() : config.credentials;
                const configValue = credentials?.accountId ?? credentials?.AccountId;
                return configValue;
            };
        }
        if (configKey === "endpoint" || canonicalEndpointParamKey === "endpoint") {
            return async () => {
                if (config.isCustomEndpoint === false) {
                    return undefined;
                }
                const endpoint = await configProvider();
                if (endpoint && typeof endpoint === "object") {
                    if ("url" in endpoint) {
                        return endpoint.url.href;
                    }
                    if ("hostname" in endpoint) {
                        const { protocol, hostname, port, path } = endpoint;
                        return `${protocol}//${hostname}${port ? ":" + port : ""}${path}`;
                    }
                }
                return endpoint;
            };
        }
        return configProvider;
    };

    function bindGetEndpointFromInstructions(getEndpointFromConfig) {
        return async (commandInput, instructionsSupplier, clientConfig, context) => {
            if (!clientConfig.isCustomEndpoint && !clientConfig.ignoreConfiguredEndpointUrls) {
                let endpointFromConfig;
                if (clientConfig.serviceConfiguredEndpoint) {
                    endpointFromConfig = await clientConfig.serviceConfiguredEndpoint();
                }
                else {
                    endpointFromConfig = await getEndpointFromConfig(clientConfig.serviceId);
                }
                if (endpointFromConfig) {
                    clientConfig.endpoint = () => Promise.resolve(toEndpointV1(endpointFromConfig));
                    clientConfig.isCustomEndpoint = true;
                    context?.logger?.debug?.(`@smithy/core/endpoints - resolved endpoint from config: ${endpointFromConfig}`);
                }
            }
            const endpointParams = await resolveParams(commandInput, instructionsSupplier, clientConfig);
            if (typeof clientConfig.endpointProvider !== "function") {
                throw new Error("config.endpointProvider is not set.");
            }
            const endpoint = clientConfig.endpointProvider(endpointParams, context);
            if (clientConfig.isCustomEndpoint && clientConfig.endpoint) {
                const customEndpoint = await clientConfig.endpoint();
                if (customEndpoint?.headers) {
                    endpoint.headers ??= {};
                    for (const [name, value] of Object.entries(customEndpoint.headers)) {
                        endpoint.headers[name] = Array.isArray(value) ? value : [value];
                    }
                }
            }
            return endpoint;
        };
    }
    const resolveParams = async (commandInput, instructionsSupplier, clientConfig) => {
        const endpointParams = {};
        const instructions = instructionsSupplier?.getEndpointParameterInstructions?.() || {};
        for (const [name, instruction] of Object.entries(instructions)) {
            switch (instruction.type) {
                case "staticContextParams":
                    endpointParams[name] = instruction.value;
                    break;
                case "contextParams":
                    endpointParams[name] = commandInput[instruction.name];
                    break;
                case "clientContextParams":
                case "builtInParams":
                    endpointParams[name] = await createConfigValueProvider(instruction.name, name, clientConfig, instruction.type !== "builtInParams")();
                    break;
                case "operationContextParams":
                    endpointParams[name] = instruction.get(commandInput);
                    break;
                default:
                    throw new Error("Unrecognized endpoint parameter instruction: " + JSON.stringify(instruction));
            }
        }
        if (Object.keys(instructions).length === 0) {
            Object.assign(endpointParams, clientConfig);
        }
        if (String(clientConfig.serviceId).toLowerCase() === "s3") {
            await resolveParamsForS3(endpointParams);
        }
        return endpointParams;
    };

    function setFeature$1(context, feature, value) {
        if (!context.__smithy_context) {
            context.__smithy_context = { features: {} };
        }
        else if (!context.__smithy_context.features) {
            context.__smithy_context.features = {};
        }
        context.__smithy_context.features[feature] = value;
    }
    function bindEndpointMiddleware(getEndpointFromConfig) {
        const getEndpointFromInstructions = bindGetEndpointFromInstructions(getEndpointFromConfig);
        return ({ config, instructions, }) => {
            return (next, context) => async (args) => {
                if (config.isCustomEndpoint) {
                    setFeature$1(context, "ENDPOINT_OVERRIDE", "N");
                }
                const endpoint = await getEndpointFromInstructions(args.input, {
                    getEndpointParameterInstructions() {
                        return instructions;
                    },
                }, { ...config }, context);
                context.endpointV2 = endpoint;
                context.authSchemes = endpoint.properties?.authSchemes;
                const authScheme = context.authSchemes?.[0];
                if (authScheme) {
                    context["signing_region"] = authScheme.signingRegion;
                    context["signing_service"] = authScheme.signingName;
                    const smithyContext = getSmithyContext(context);
                    const httpAuthOption = smithyContext?.selectedHttpAuthScheme?.httpAuthOption;
                    if (httpAuthOption) {
                        httpAuthOption.signingProperties = Object.assign(httpAuthOption.signingProperties || {}, {
                            signing_region: authScheme.signingRegion,
                            signingRegion: authScheme.signingRegion,
                            signing_service: authScheme.signingName,
                            signingName: authScheme.signingName,
                            signingRegionSet: authScheme.signingRegionSet,
                        }, authScheme.properties);
                    }
                }
                return next({
                    ...args,
                });
            };
        };
    }

    const serializerMiddlewareOption = {
        name: "serializerMiddleware"};
    const endpointMiddlewareOptions = {
        step: "serialize",
        tags: ["ENDPOINT_PARAMETERS", "ENDPOINT_V2", "ENDPOINT"],
        name: "endpointV2Middleware",
        override: true,
        relation: "before",
        toMiddleware: serializerMiddlewareOption.name,
    };
    function bindGetEndpointPlugin(getEndpointFromConfig) {
        const endpointMiddleware = bindEndpointMiddleware(getEndpointFromConfig);
        return (config, instructions) => ({
            applyToStack: (clientStack) => {
                clientStack.addRelativeTo(endpointMiddleware({
                    config,
                    instructions,
                }), endpointMiddlewareOptions);
            },
        });
    }

    function bindResolveEndpointConfig(getEndpointFromConfig) {
        return (input) => {
            const tls = input.tls ?? true;
            const { endpoint, useDualstackEndpoint, useFipsEndpoint } = input;
            const customEndpointProvider = endpoint != null ? async () => toEndpointV1(await normalizeProvider$1(endpoint)()) : undefined;
            const isCustomEndpoint = !!endpoint;
            const resolvedConfig = Object.assign(input, {
                endpoint: customEndpointProvider,
                tls,
                isCustomEndpoint,
                useDualstackEndpoint: normalizeProvider$1(useDualstackEndpoint ?? false),
                useFipsEndpoint: normalizeProvider$1(useFipsEndpoint ?? false),
                ignoreConfiguredEndpointUrls: !!input.ignoreConfiguredEndpointUrls,
            });
            let configuredEndpointPromise = undefined;
            resolvedConfig.serviceConfiguredEndpoint = async () => {
                if (input.serviceId && !configuredEndpointPromise) {
                    configuredEndpointPromise = getEndpointFromConfig(input.serviceId);
                }
                return configuredEndpointPromise;
            };
            return resolvedConfig;
        };
    }

    class BinaryDecisionDiagram {
        nodes;
        root;
        conditions;
        results;
        constructor(bdd, root, conditions, results) {
            this.nodes = bdd;
            this.root = root;
            this.conditions = conditions;
            this.results = results;
        }
        static from(bdd, root, conditions, results) {
            return new BinaryDecisionDiagram(bdd, root, conditions, results);
        }
    }

    class EndpointCache {
        capacity;
        data = new Map();
        parameters = [];
        constructor({ size, params }) {
            this.capacity = size ?? 50;
            if (params) {
                this.parameters = params;
            }
        }
        get(endpointParams, resolver) {
            const key = this.hash(endpointParams);
            if (key === false) {
                return resolver();
            }
            if (!this.data.has(key)) {
                if (this.data.size > this.capacity + 10) {
                    const keys = this.data.keys();
                    let i = 0;
                    while (true) {
                        const { value, done } = keys.next();
                        this.data.delete(value);
                        if (done || ++i > 10) {
                            break;
                        }
                    }
                }
                this.data.set(key, resolver());
            }
            return this.data.get(key);
        }
        size() {
            return this.data.size;
        }
        hash(endpointParams) {
            let buffer = "";
            const { parameters } = this;
            if (parameters.length === 0) {
                return false;
            }
            for (const param of parameters) {
                const val = String(endpointParams[param] ?? "");
                if (val.includes("|;")) {
                    return false;
                }
                buffer += val + "|;";
            }
            return buffer;
        }
    }

    class EndpointError extends Error {
        constructor(message) {
            super(message);
            this.name = "EndpointError";
        }
    }

    const debugId = "endpoints";

    function toDebugString(input) {
        if (typeof input !== "object" || input == null) {
            return input;
        }
        if ("ref" in input) {
            return `$${toDebugString(input.ref)}`;
        }
        if ("fn" in input) {
            return `${input.fn}(${(input.argv || []).map(toDebugString).join(", ")})`;
        }
        return JSON.stringify(input, null, 2);
    }

    const customEndpointFunctions = {};

    const booleanEquals = (value1, value2) => value1 === value2;

    function coalesce(...args) {
        for (const arg of args) {
            if (arg != null) {
                return arg;
            }
        }
        return undefined;
    }

    const getAttrPathList = (path) => {
        const parts = path.split(".");
        const pathList = [];
        for (const part of parts) {
            const squareBracketIndex = part.indexOf("[");
            if (squareBracketIndex !== -1) {
                if (part.indexOf("]") !== part.length - 1) {
                    throw new EndpointError(`Path: '${path}' does not end with ']'`);
                }
                const arrayIndex = part.slice(squareBracketIndex + 1, -1);
                if (Number.isNaN(parseInt(arrayIndex))) {
                    throw new EndpointError(`Invalid array index: '${arrayIndex}' in path: '${path}'`);
                }
                if (squareBracketIndex !== 0) {
                    pathList.push(part.slice(0, squareBracketIndex));
                }
                pathList.push(arrayIndex);
            }
            else {
                pathList.push(part);
            }
        }
        return pathList;
    };

    const getAttr = (value, path) => getAttrPathList(path).reduce((acc, index) => {
        if (typeof acc !== "object") {
            throw new EndpointError(`Index '${index}' in '${path}' not found in '${JSON.stringify(value)}'`);
        }
        else if (Array.isArray(acc)) {
            const i = parseInt(index);
            return acc[i < 0 ? acc.length + i : i];
        }
        return acc[index];
    }, value);

    const isSet = (value) => value != null;

    function ite(condition, trueValue, falseValue) {
        return condition ? trueValue : falseValue;
    }

    const not = (value) => !value;

    const IP_V4_REGEX = new RegExp(`^(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}$`);
    const isIpAddress = (value) => IP_V4_REGEX.test(value) || (value.startsWith("[") && value.endsWith("]"));

    const DEFAULT_PORTS = {
        [EndpointURLScheme.HTTP]: 80,
        [EndpointURLScheme.HTTPS]: 443,
    };
    const parseURL = (value) => {
        const whatwgURL = (() => {
            try {
                if (value instanceof URL) {
                    return value;
                }
                if (typeof value === "object" && "hostname" in value) {
                    const { hostname, port, protocol = "", path = "", query = {} } = value;
                    const url = new URL(`${protocol}//${hostname}${port ? `:${port}` : ""}${path}`);
                    url.search = Object.entries(query)
                        .map(([k, v]) => `${k}=${v}`)
                        .join("&");
                    return url;
                }
                return new URL(value);
            }
            catch (ignored) {
                return null;
            }
        })();
        if (!whatwgURL) {
            console.error(`Unable to parse ${JSON.stringify(value)} as a whatwg URL.`);
            return null;
        }
        const urlString = whatwgURL.href;
        const { host, hostname, pathname, protocol, search } = whatwgURL;
        if (search) {
            return null;
        }
        const scheme = protocol.slice(0, -1);
        if (!Object.values(EndpointURLScheme).includes(scheme)) {
            return null;
        }
        const isIp = isIpAddress(hostname);
        const inputContainsDefaultPort = urlString.includes(`${host}:${DEFAULT_PORTS[scheme]}`) ||
            (typeof value === "string" && value.includes(`${host}:${DEFAULT_PORTS[scheme]}`));
        const authority = `${host}${inputContainsDefaultPort ? `:${DEFAULT_PORTS[scheme]}` : ``}`;
        return {
            scheme,
            authority,
            path: pathname,
            normalizedPath: pathname.endsWith("/") ? pathname : `${pathname}/`,
            isIp,
        };
    };

    function split(value, delimiter, limit) {
        if (limit === 1) {
            return [value];
        }
        if (value === "") {
            return [""];
        }
        const parts = value.split(delimiter);
        if (limit === 0) {
            return parts;
        }
        return parts.slice(0, limit - 1).concat(parts.slice(1).join(delimiter));
    }

    const stringEquals = (value1, value2) => value1 === value2;

    const substring = (input, start, stop, reverse) => {
        if (input == null || start >= stop || input.length < stop || /[^\u0000-\u007f]/.test(input)) {
            return null;
        }
        if (!reverse) {
            return input.substring(start, stop);
        }
        return input.substring(input.length - stop, input.length - start);
    };

    const uriEncode = (value) => encodeURIComponent(value).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

    const endpointFunctions = {
        booleanEquals,
        coalesce,
        getAttr,
        isSet,
        isValidHostLabel,
        ite,
        not,
        parseURL,
        split,
        stringEquals,
        substring,
        uriEncode,
    };

    const evaluateTemplate = (template, options) => {
        const evaluatedTemplateArr = [];
        const { referenceRecord, endpointParams } = options;
        let currentIndex = 0;
        while (currentIndex < template.length) {
            const openingBraceIndex = template.indexOf("{", currentIndex);
            if (openingBraceIndex === -1) {
                evaluatedTemplateArr.push(template.slice(currentIndex));
                break;
            }
            evaluatedTemplateArr.push(template.slice(currentIndex, openingBraceIndex));
            const closingBraceIndex = template.indexOf("}", openingBraceIndex);
            if (closingBraceIndex === -1) {
                evaluatedTemplateArr.push(template.slice(openingBraceIndex));
                break;
            }
            if (template[openingBraceIndex + 1] === "{" && template[closingBraceIndex + 1] === "}") {
                evaluatedTemplateArr.push(template.slice(openingBraceIndex + 1, closingBraceIndex));
                currentIndex = closingBraceIndex + 2;
            }
            const parameterName = template.substring(openingBraceIndex + 1, closingBraceIndex);
            if (parameterName.includes("#")) {
                const [refName, attrName] = parameterName.split("#");
                evaluatedTemplateArr.push(getAttr((referenceRecord[refName] ?? endpointParams[refName]), attrName));
            }
            else {
                evaluatedTemplateArr.push((referenceRecord[parameterName] ?? endpointParams[parameterName]));
            }
            currentIndex = closingBraceIndex + 1;
        }
        return evaluatedTemplateArr.join("");
    };

    const getReferenceValue = ({ ref }, options) => {
        return options.referenceRecord[ref] ?? options.endpointParams[ref];
    };

    const evaluateExpression = (obj, keyName, options) => {
        if (typeof obj === "string") {
            return evaluateTemplate(obj, options);
        }
        else if (obj["fn"]) {
            return group$1.callFunction(obj, options);
        }
        else if (obj["ref"]) {
            return getReferenceValue(obj, options);
        }
        throw new EndpointError(`'${keyName}': ${String(obj)} is not a string, function or reference.`);
    };
    const callFunction = ({ fn, argv }, options) => {
        const evaluatedArgs = Array(argv.length);
        for (let i = 0; i < evaluatedArgs.length; ++i) {
            const arg = argv[i];
            if (typeof arg === "boolean" || typeof arg === "number") {
                evaluatedArgs[i] = arg;
            }
            else {
                evaluatedArgs[i] = group$1.evaluateExpression(arg, "arg", options);
            }
        }
        const namespaceSeparatorIndex = fn.indexOf(".");
        if (namespaceSeparatorIndex !== -1) {
            const namespaceFunctions = customEndpointFunctions[fn.slice(0, namespaceSeparatorIndex)];
            const customFunction = namespaceFunctions?.[fn.slice(namespaceSeparatorIndex + 1)];
            if (typeof customFunction === "function") {
                return customFunction(...evaluatedArgs);
            }
        }
        const callable = endpointFunctions[fn];
        if (typeof callable === "function") {
            return callable(...evaluatedArgs);
        }
        throw new Error(`function ${fn} not loaded in endpointFunctions.`);
    };
    const group$1 = {
        evaluateExpression,
        callFunction,
    };

    const evaluateCondition = (condition, options) => {
        const { assign } = condition;
        if (assign && assign in options.referenceRecord) {
            throw new EndpointError(`'${assign}' is already defined in Reference Record.`);
        }
        const value = callFunction(condition, options);
        options.logger?.debug?.(`${debugId} evaluateCondition: ${toDebugString(condition)} = ${toDebugString(value)}`);
        const result = value === "" ? true : !!value;
        if (assign != null) {
            return { result, toAssign: { name: assign, value } };
        }
        return { result };
    };

    const getEndpointHeaders = (headers, options) => Object.entries(headers ?? {}).reduce((acc, [headerKey, headerVal]) => {
        acc[headerKey] = headerVal.map((headerValEntry) => {
            const processedExpr = evaluateExpression(headerValEntry, "Header value entry", options);
            if (typeof processedExpr !== "string") {
                throw new EndpointError(`Header '${headerKey}' value '${processedExpr}' is not a string`);
            }
            return processedExpr;
        });
        return acc;
    }, {});

    const getEndpointProperties = (properties, options) => Object.entries(properties).reduce((acc, [propertyKey, propertyVal]) => {
        acc[propertyKey] = group.getEndpointProperty(propertyVal, options);
        return acc;
    }, {});
    const getEndpointProperty = (property, options) => {
        if (Array.isArray(property)) {
            return property.map((propertyEntry) => getEndpointProperty(propertyEntry, options));
        }
        switch (typeof property) {
            case "string":
                return evaluateTemplate(property, options);
            case "object":
                if (property === null) {
                    throw new EndpointError(`Unexpected endpoint property: ${property}`);
                }
                return group.getEndpointProperties(property, options);
            case "boolean":
                return property;
            default:
                throw new EndpointError(`Unexpected endpoint property type: ${typeof property}`);
        }
    };
    const group = {
        getEndpointProperty,
        getEndpointProperties,
    };

    const getEndpointUrl = (endpointUrl, options) => {
        const expression = evaluateExpression(endpointUrl, "Endpoint URL", options);
        if (typeof expression === "string") {
            try {
                return new URL(expression);
            }
            catch (error) {
                console.error(`Failed to construct URL with ${expression}`, error);
                throw error;
            }
        }
        throw new EndpointError(`Endpoint URL must be a string, got ${typeof expression}`);
    };

    const RESULT = 100_000_000;
    const decideEndpoint = (bdd, options) => {
        const { nodes, root, results, conditions } = bdd;
        let ref = root;
        const referenceRecord = {};
        const closure = {
            referenceRecord,
            endpointParams: options.endpointParams,
            logger: options.logger,
        };
        while (ref !== 1 && ref !== -1 && ref < RESULT) {
            const node_i = 3 * (Math.abs(ref) - 1);
            const [condition_i, highRef, lowRef] = [nodes[node_i], nodes[node_i + 1], nodes[node_i + 2]];
            const [fn, argv, assign] = conditions[condition_i];
            const evaluation = evaluateCondition({ fn, assign, argv }, closure);
            if (evaluation.toAssign) {
                const { name, value } = evaluation.toAssign;
                referenceRecord[name] = value;
            }
            ref = ref >= 0 === evaluation.result ? highRef : lowRef;
        }
        if (ref >= RESULT) {
            const result = results[ref - RESULT];
            if (result[0] === -1) {
                const [, errorExpression] = result;
                throw new EndpointError(evaluateExpression(errorExpression, "Error", closure));
            }
            const [url, properties, headers] = result;
            return {
                url: getEndpointUrl(url, closure),
                properties: getEndpointProperties(properties, closure),
                headers: getEndpointHeaders(headers ?? {}, closure),
            };
        }
        throw new EndpointError(`No matching endpoint.`);
    };

    const resolveEndpointConfig = bindResolveEndpointConfig(getEndpointFromConfig);
    const getEndpointPlugin = bindGetEndpointPlugin(getEndpointFromConfig);

    const isReadableStream$2 = (stream) => typeof ReadableStream === "function" &&
        (stream?.constructor?.name === ReadableStream.name || stream instanceof ReadableStream);
    const isBlob = (blob) => {
        return typeof Blob === "function" && (blob?.constructor?.name === Blob.name || blob instanceof Blob);
    };

    const streamCollector = async (stream) => {
        if (isBlob(stream)) {
            return collectBlob(stream);
        }
        return collectReadableStream(stream);
    };
    async function collectBlob(blob) {
        return blob.arrayBuffer().then((ab) => new Uint8Array(ab));
    }
    async function collectReadableStream(stream) {
        const chunks = [];
        const reader = stream.getReader();
        let length = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (value) {
                chunks.push(value);
                length += value.length;
            }
            if (done) {
                break;
            }
        }
        return concatBytes(chunks, length);
    }

    const ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED = "The stream has already been transformed.";
    const sdkStreamMixin = (stream) => {
        if (!isBlobInstance(stream) && !isReadableStream$2(stream)) {
            const name = stream?.__proto__?.constructor?.name || stream;
            throw new Error(`Unexpected stream implementation, expect Blob or ReadableStream, got ${name}`);
        }
        let transformed = false;
        const transformToByteArray = async () => {
            if (transformed) {
                throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
            }
            transformed = true;
            return await streamCollector(stream);
        };
        const blobToWebStream = (blob) => {
            if (typeof blob.stream !== "function") {
                throw new Error("Cannot transform payload Blob to web stream. Please make sure the Blob.stream() is polyfilled.\n" +
                    "If you are using React Native, this API is not yet supported, see: https://react-native.canny.io/feature-requests/p/fetch-streaming-body");
            }
            return blob.stream();
        };
        return Object.assign(stream, {
            transformToByteArray: transformToByteArray,
            transformToString: async (encoding) => {
                const buf = await transformToByteArray();
                if (encoding === "base64") {
                    return toBase64(buf);
                }
                else if (encoding === "hex") {
                    return toHex(buf);
                }
                else if (encoding === undefined || encoding === "utf8" || encoding === "utf-8") {
                    return toUtf8(buf);
                }
                else if (typeof TextDecoder === "function") {
                    return new TextDecoder(encoding).decode(buf);
                }
                else {
                    throw new Error("TextDecoder is not available, please make sure polyfill is provided.");
                }
            },
            transformToWebStream: () => {
                if (transformed) {
                    throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
                }
                transformed = true;
                if (isBlobInstance(stream)) {
                    return blobToWebStream(stream);
                }
                else if (isReadableStream$2(stream)) {
                    return stream;
                }
                else {
                    throw new Error(`Cannot transform payload to web stream, got ${stream}`);
                }
            },
        });
    };
    const isBlobInstance = (stream) => typeof Blob === "function" && stream instanceof Blob;

    class Uint8ArrayBlobAdapter extends bindUint8ArrayBlobAdapter(toUtf8, fromUtf8, toBase64, fromBase64) {
    }
    const _getRandomValues = (array) => crypto.getRandomValues(array);
    const v4 = bindV4(_getRandomValues);
    const generateIdempotencyToken = v4;

    const collectBody = async (streamBody = new Uint8Array(), context) => {
        if (streamBody instanceof Uint8Array) {
            return Uint8ArrayBlobAdapter.mutate(streamBody);
        }
        if (!streamBody) {
            return Uint8ArrayBlobAdapter.mutate(new Uint8Array());
        }
        const fromContext = context.streamCollector(streamBody);
        return Uint8ArrayBlobAdapter.mutate(await fromContext);
    };

    function extendedEncodeURIComponent(str) {
        return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
            return "%" + c.charCodeAt(0).toString(16).toUpperCase();
        });
    }

    class SerdeContext {
        serdeContext;
        setSerdeContext(serdeContext) {
            this.serdeContext = serdeContext;
        }
    }

    class HttpProtocol extends SerdeContext {
        options;
        compositeErrorRegistry;
        constructor(options) {
            super();
            this.options = options;
            this.compositeErrorRegistry = TypeRegistry.for(options.defaultNamespace);
            for (const etr of options.errorTypeRegistries ?? []) {
                this.compositeErrorRegistry.copyFrom(etr);
            }
        }
        getRequestType() {
            return HttpRequest;
        }
        getResponseType() {
            return HttpResponse;
        }
        setSerdeContext(serdeContext) {
            this.serdeContext = serdeContext;
            this.serializer.setSerdeContext(serdeContext);
            this.deserializer.setSerdeContext(serdeContext);
            if (this.getPayloadCodec()) {
                this.getPayloadCodec().setSerdeContext(serdeContext);
            }
        }
        updateServiceEndpoint(request, endpoint) {
            if ("url" in endpoint) {
                request.protocol = endpoint.url.protocol;
                request.hostname = endpoint.url.hostname;
                request.port = endpoint.url.port ? Number(endpoint.url.port) : undefined;
                request.path = endpoint.url.pathname;
                request.fragment = endpoint.url.hash || void 0;
                request.username = endpoint.url.username || void 0;
                request.password = endpoint.url.password || void 0;
                if (!request.query) {
                    request.query = {};
                }
                for (const [k, v] of endpoint.url.searchParams.entries()) {
                    request.query[k] = v;
                }
                if (endpoint.headers) {
                    for (const name in endpoint.headers) {
                        if (!hasOwn(endpoint.headers, name))
                            continue;
                        request.headers[name] = endpoint.headers[name].join(", ");
                    }
                }
                return request;
            }
            else {
                request.protocol = endpoint.protocol;
                request.hostname = endpoint.hostname;
                request.port = endpoint.port ? Number(endpoint.port) : undefined;
                request.path = endpoint.path;
                request.query = {
                    ...endpoint.query,
                };
                if (endpoint.headers) {
                    for (const name in endpoint.headers) {
                        if (!hasOwn(endpoint.headers, name))
                            continue;
                        request.headers[name] = endpoint.headers[name];
                    }
                }
                return request;
            }
        }
        setHostPrefix(request, operationSchema, input) {
            if (this.serdeContext?.disableHostPrefix) {
                return;
            }
            const inputNs = NormalizedSchema.of(operationSchema.input);
            const opTraits = translateTraits(operationSchema.traits ?? {});
            if (opTraits.endpoint) {
                let hostPrefix = opTraits.endpoint?.[0];
                if (typeof hostPrefix === "string") {
                    for (const [name, member] of inputNs.structIterator()) {
                        if (!member.getMergedTraits().hostLabel) {
                            continue;
                        }
                        const replacement = input[name];
                        if (typeof replacement !== "string") {
                            throw new Error(`@smithy/core/schema - ${name} in input must be a string as hostLabel.`);
                        }
                        hostPrefix = hostPrefix.replace(`{${name}}`, replacement);
                    }
                    request.hostname = hostPrefix + request.hostname;
                    if (!isValidHostname(request.hostname)) {
                        throw new Error(`[${request.hostname}] is not a valid hostname.`);
                    }
                }
            }
        }
        deserializeMetadata(output) {
            return {
                httpStatusCode: output.statusCode,
                requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
                extendedRequestId: output.headers["x-amz-id-2"],
                cfId: output.headers["x-amz-cf-id"],
            };
        }
        async serializeEventStream({ eventStream, requestSchema, initialRequest, }) {
            const eventStreamSerde = await this.loadEventStreamCapability();
            return eventStreamSerde.serializeEventStream({
                eventStream,
                requestSchema,
                initialRequest,
            });
        }
        async deserializeEventStream({ response, responseSchema, initialResponseContainer, }) {
            const eventStreamSerde = await this.loadEventStreamCapability();
            return eventStreamSerde.deserializeEventStream({
                response,
                responseSchema,
                initialResponseContainer,
            });
        }
        async loadEventStreamCapability() {
            const { EventStreamSerde, eventStreamSerdeProvider } = await Promise.resolve().then(function () { return index_browser; });
            const marshaller = this.resolveEventStreamMarshaller(eventStreamSerdeProvider);
            return new EventStreamSerde({
                marshaller,
                serializer: this.serializer,
                deserializer: this.deserializer,
                serdeContext: this.serdeContext,
                defaultContentType: this.getDefaultContentType(),
                compositeErrorRegistry: this.compositeErrorRegistry,
            });
        }
        resolveEventStreamMarshaller(importedProvider) {
            const context = this.serdeContext;
            if (context.eventStreamMarshaller) {
                return context.eventStreamMarshaller;
            }
            return importedProvider(this.serdeContext);
        }
        getDefaultContentType() {
            throw new Error(`@smithy/core/protocols - ${this.constructor.name} getDefaultContentType() implementation missing.`);
        }
        async deserializeHttpMessage(schema, context, response, arg4, arg5) {
            return [];
        }
        getEventStreamMarshaller() {
            const context = this.serdeContext;
            if (!context.eventStreamMarshaller) {
                throw new Error("@smithy/core - HttpProtocol: eventStreamMarshaller missing in serdeContext.");
            }
            return context.eventStreamMarshaller;
        }
    }

    class HttpBindingProtocol extends HttpProtocol {
        async serializeRequest(operationSchema, _input, context) {
            const input = _input && typeof _input === "object" ? _input : {};
            const serializer = this.serializer;
            const query = {};
            const headers = {};
            const endpoint = await context.endpoint();
            const ns = NormalizedSchema.of(operationSchema?.input);
            const payloadMemberNames = [];
            const payloadMemberSchemas = [];
            let hasNonHttpBindingMember = false;
            let payload;
            const request = new HttpRequest({
                protocol: "",
                hostname: "",
                port: undefined,
                path: "",
                fragment: undefined,
                query: query,
                headers: headers,
                body: undefined,
            });
            if (endpoint) {
                this.updateServiceEndpoint(request, endpoint);
                this.setHostPrefix(request, operationSchema, input);
                const opTraits = translateTraits(operationSchema.traits);
                if (opTraits.http) {
                    request.method = opTraits.http[0];
                    const [path, search] = opTraits.http[1].split("?");
                    if (request.path == "/") {
                        request.path = path;
                    }
                    else {
                        request.path += path;
                    }
                    const traitSearchParams = new URLSearchParams(search ?? "");
                    for (const [key, value] of traitSearchParams) {
                        query[key] = value;
                    }
                }
            }
            for (const [memberName, memberNs] of ns.structIterator()) {
                const memberTraits = memberNs.getMergedTraits() ?? {};
                const inputMemberValue = input[memberName];
                if (inputMemberValue == null && !memberNs.isIdempotencyToken()) {
                    if (memberTraits.httpLabel) {
                        if (request.path.includes(`{${memberName}+}`) || request.path.includes(`{${memberName}}`)) {
                            throw new Error(`No value provided for input HTTP label: ${memberName}.`);
                        }
                    }
                    continue;
                }
                if (memberTraits.httpPayload) {
                    const isStreaming = memberNs.isStreaming();
                    if (isStreaming) {
                        const isEventStream = memberNs.isStructSchema();
                        if (isEventStream) {
                            if (input[memberName]) {
                                payload = await this.serializeEventStream({
                                    eventStream: input[memberName],
                                    requestSchema: ns,
                                });
                            }
                        }
                        else {
                            payload = inputMemberValue;
                        }
                    }
                    else {
                        serializer.write(memberNs, inputMemberValue);
                        payload = serializer.flush();
                    }
                }
                else if (memberTraits.httpLabel) {
                    serializer.write(memberNs, inputMemberValue);
                    const replacement = serializer.flush();
                    if (request.path.includes(`{${memberName}+}`)) {
                        request.path = request.path.replace(`{${memberName}+}`, replacement.split("/").map(extendedEncodeURIComponent).join("/"));
                    }
                    else if (request.path.includes(`{${memberName}}`)) {
                        request.path = request.path.replace(`{${memberName}}`, extendedEncodeURIComponent(replacement));
                    }
                }
                else if (memberTraits.httpHeader) {
                    serializer.write(memberNs, inputMemberValue);
                    headers[memberTraits.httpHeader.toLowerCase()] = String(serializer.flush());
                }
                else if (typeof memberTraits.httpPrefixHeaders === "string") {
                    for (const key in inputMemberValue) {
                        if (!hasOwn(inputMemberValue, key))
                            continue;
                        const val = inputMemberValue[key];
                        const amalgam = memberTraits.httpPrefixHeaders + key;
                        serializer.write([memberNs.getValueSchema(), { httpHeader: amalgam }], val);
                        headers[amalgam.toLowerCase()] = serializer.flush();
                    }
                }
                else if (memberTraits.httpQuery || memberTraits.httpQueryParams) {
                    this.serializeQuery(memberNs, inputMemberValue, query);
                }
                else {
                    hasNonHttpBindingMember = true;
                    payloadMemberNames.push(memberName);
                    payloadMemberSchemas.push(memberNs);
                }
            }
            if (hasNonHttpBindingMember && input) {
                const [namespace, name] = (ns.getName(true) ?? "#Unknown").split("#");
                const requiredMembers = ns.getSchema()[6];
                const payloadSchema = [
                    3,
                    namespace,
                    name,
                    ns.getMergedTraits(),
                    payloadMemberNames,
                    payloadMemberSchemas,
                    undefined,
                ];
                if (requiredMembers) {
                    payloadSchema[6] = requiredMembers;
                }
                else {
                    payloadSchema.pop();
                }
                serializer.write(payloadSchema, input);
                payload = serializer.flush();
            }
            request.headers = headers;
            request.query = query;
            request.body = payload;
            return request;
        }
        serializeQuery(ns, data, query) {
            const serializer = this.serializer;
            const traits = ns.getMergedTraits();
            if (traits.httpQueryParams) {
                for (const key in data) {
                    if (!hasOwn(data, key))
                        continue;
                    if (!(key in query)) {
                        const val = data[key];
                        const valueSchema = ns.getValueSchema();
                        Object.assign(valueSchema.getMergedTraits(), {
                            ...traits,
                            httpQuery: key,
                            httpQueryParams: undefined,
                        });
                        this.serializeQuery(valueSchema, val, query);
                    }
                }
                return;
            }
            if (ns.isListSchema()) {
                const sparse = !!ns.getMergedTraits().sparse;
                const buffer = [];
                for (const item of data) {
                    serializer.write([ns.getValueSchema(), traits], item);
                    const serializable = serializer.flush();
                    if (sparse || serializable !== undefined) {
                        buffer.push(serializable);
                    }
                }
                query[traits.httpQuery] = buffer;
            }
            else {
                serializer.write([ns, traits], data);
                query[traits.httpQuery] = serializer.flush();
            }
        }
        async deserializeResponse(operationSchema, context, response) {
            const deserializer = this.deserializer;
            const ns = NormalizedSchema.of(operationSchema.output);
            const dataObject = {};
            if (response.statusCode >= 300) {
                const bytes = await collectBody(response.body, context);
                if (bytes.byteLength > 0) {
                    Object.assign(dataObject, await deserializer.read(15, bytes));
                }
                await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
                throw new Error("@smithy/core/protocols - HTTP Protocol error handler failed to throw.");
            }
            for (const header in response.headers) {
                if (!hasOwn(response.headers, header))
                    continue;
                const value = response.headers[header];
                delete response.headers[header];
                response.headers[header.toLowerCase()] = value;
            }
            const nonHttpBindingMembers = await this.deserializeHttpMessage(ns, context, response, dataObject);
            if (nonHttpBindingMembers.length) {
                const bytes = await collectBody(response.body, context);
                if (bytes.byteLength > 0) {
                    const dataFromBody = await deserializer.read(ns, bytes);
                    for (const member of nonHttpBindingMembers) {
                        if (dataFromBody[member] != null) {
                            dataObject[member] = dataFromBody[member];
                        }
                    }
                }
            }
            else if (nonHttpBindingMembers.discardResponseBody) {
                await collectBody(response.body, context);
            }
            dataObject.$metadata = this.deserializeMetadata(response);
            return dataObject;
        }
        async deserializeHttpMessage(schema, context, response, arg4, arg5) {
            let dataObject;
            if (arg4 instanceof Set) {
                dataObject = arg5;
            }
            else {
                dataObject = arg4;
            }
            let discardResponseBody = true;
            const deserializer = this.deserializer;
            const ns = NormalizedSchema.of(schema);
            const nonHttpBindingMembers = [];
            for (const [memberName, memberSchema] of ns.structIterator()) {
                const memberTraits = memberSchema.getMemberTraits();
                if (memberTraits.httpPayload) {
                    discardResponseBody = false;
                    const isStreaming = memberSchema.isStreaming();
                    if (isStreaming) {
                        const isEventStream = memberSchema.isStructSchema();
                        if (isEventStream) {
                            dataObject[memberName] = await this.deserializeEventStream({
                                response,
                                responseSchema: ns,
                            });
                        }
                        else {
                            dataObject[memberName] = sdkStreamMixin(response.body);
                        }
                    }
                    else if (response.body) {
                        const bytes = await collectBody(response.body, context);
                        if (bytes.byteLength > 0) {
                            dataObject[memberName] = await deserializer.read(memberSchema, bytes);
                        }
                    }
                }
                else if (memberTraits.httpHeader) {
                    const key = String(memberTraits.httpHeader).toLowerCase();
                    const value = response.headers[key];
                    if (null != value) {
                        if (memberSchema.isListSchema()) {
                            const headerListValueSchema = memberSchema.getValueSchema();
                            headerListValueSchema.getMergedTraits().httpHeader = key;
                            let sections;
                            if (headerListValueSchema.isTimestampSchema() &&
                                headerListValueSchema.getSchema() === 4) {
                                sections = splitEvery(value, ",", 2);
                            }
                            else {
                                sections = splitHeader(value);
                            }
                            const list = [];
                            for (const section of sections) {
                                list.push(await deserializer.read(headerListValueSchema, section.trim()));
                            }
                            dataObject[memberName] = list;
                        }
                        else {
                            dataObject[memberName] = await deserializer.read(memberSchema, value);
                        }
                    }
                }
                else if (memberTraits.httpPrefixHeaders !== undefined) {
                    dataObject[memberName] = {};
                    for (const header in response.headers) {
                        if (!hasOwn(response.headers, header))
                            continue;
                        if (header.startsWith(memberTraits.httpPrefixHeaders)) {
                            const value = response.headers[header];
                            const valueSchema = memberSchema.getValueSchema();
                            valueSchema.getMergedTraits().httpHeader = header;
                            dataObject[memberName][header.slice(memberTraits.httpPrefixHeaders.length)] = await deserializer.read(valueSchema, value);
                        }
                    }
                }
                else if (memberTraits.httpResponseCode) {
                    dataObject[memberName] = response.statusCode;
                }
                else {
                    nonHttpBindingMembers.push(memberName);
                }
            }
            nonHttpBindingMembers.discardResponseBody = discardResponseBody;
            return nonHttpBindingMembers;
        }
    }

    function determineTimestampFormat(ns, settings) {
        if (settings.timestampFormat.useTrait) {
            if (ns.isTimestampSchema() &&
                (ns.getSchema() === 5 ||
                    ns.getSchema() === 6 ||
                    ns.getSchema() === 7)) {
                return ns.getSchema();
            }
        }
        const { httpLabel, httpPrefixHeaders, httpHeader, httpQuery } = ns.getMergedTraits();
        const bindingFormat = settings.httpBindings
            ? typeof httpPrefixHeaders === "string" || Boolean(httpHeader)
                ? 6
                : Boolean(httpQuery) || Boolean(httpLabel)
                    ? 5
                    : undefined
            : undefined;
        return bindingFormat ?? settings.timestampFormat.default;
    }

    class FromStringShapeDeserializer extends SerdeContext {
        settings;
        constructor(settings) {
            super();
            this.settings = settings;
        }
        read(_schema, data) {
            const ns = NormalizedSchema.of(_schema);
            if (ns.isListSchema()) {
                return splitHeader(data).map((item) => this.read(ns.getValueSchema(), item));
            }
            if (ns.isBlobSchema()) {
                return (this.serdeContext?.base64Decoder ?? fromBase64)(data);
            }
            if (ns.isTimestampSchema()) {
                const format = determineTimestampFormat(ns, this.settings);
                switch (format) {
                    case 5:
                        return _parseRfc3339DateTimeWithOffset(data);
                    case 6:
                        return _parseRfc7231DateTime(data);
                    case 7:
                        return _parseEpochTimestamp(data);
                    default:
                        console.warn("Missing timestamp format, parsing value with Date constructor:", data);
                        return new Date(data);
                }
            }
            if (ns.isStringSchema()) {
                const mediaType = ns.getMergedTraits().mediaType;
                let intermediateValue = data;
                if (mediaType) {
                    if (ns.getMergedTraits().httpHeader) {
                        intermediateValue = this.base64ToUtf8(intermediateValue);
                    }
                    const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
                    if (isJson) {
                        intermediateValue = LazyJsonString.from(intermediateValue);
                    }
                    return intermediateValue;
                }
            }
            if (ns.isNumericSchema()) {
                return Number(data);
            }
            if (ns.isBigIntegerSchema()) {
                return BigInt(data);
            }
            if (ns.isBigDecimalSchema()) {
                return new NumericValue(data, "bigDecimal");
            }
            if (ns.isBooleanSchema()) {
                return String(data).toLowerCase() === "true";
            }
            return data;
        }
        base64ToUtf8(base64String) {
            return (this.serdeContext?.utf8Encoder ?? toUtf8)((this.serdeContext?.base64Decoder ?? fromBase64)(base64String));
        }
    }

    class HttpInterceptingShapeDeserializer extends SerdeContext {
        codecDeserializer;
        stringDeserializer;
        constructor(codecDeserializer, codecSettings) {
            super();
            this.codecDeserializer = codecDeserializer;
            this.stringDeserializer = new FromStringShapeDeserializer(codecSettings);
        }
        setSerdeContext(serdeContext) {
            this.stringDeserializer.setSerdeContext(serdeContext);
            this.codecDeserializer.setSerdeContext(serdeContext);
            this.serdeContext = serdeContext;
        }
        read(schema, data) {
            const ns = NormalizedSchema.of(schema);
            const traits = ns.getMergedTraits();
            const toString = this.serdeContext?.utf8Encoder ?? toUtf8;
            if (traits.httpHeader || traits.httpResponseCode) {
                return this.stringDeserializer.read(ns, toString(data));
            }
            if (traits.httpPayload) {
                if (ns.isBlobSchema()) {
                    const toBytes = this.serdeContext?.utf8Decoder ?? fromUtf8;
                    if (typeof data === "string") {
                        return toBytes(data);
                    }
                    return data;
                }
                else if (ns.isStringSchema()) {
                    if ("byteLength" in data) {
                        return toString(data);
                    }
                    return data;
                }
            }
            return this.codecDeserializer.read(ns, data);
        }
    }

    class ToStringShapeSerializer extends SerdeContext {
        settings;
        stringBuffer = "";
        constructor(settings) {
            super();
            this.settings = settings;
        }
        write(schema, value) {
            const ns = NormalizedSchema.of(schema);
            switch (typeof value) {
                case "object":
                    if (value === null) {
                        this.stringBuffer = "null";
                        return;
                    }
                    if (ns.isTimestampSchema()) {
                        if (!(value instanceof Date)) {
                            throw new Error(`@smithy/core/protocols - received non-Date value ${value} when schema expected Date in ${ns.getName(true)}`);
                        }
                        const format = determineTimestampFormat(ns, this.settings);
                        switch (format) {
                            case 5:
                                this.stringBuffer = value.toISOString().replace(".000Z", "Z");
                                break;
                            case 6:
                                this.stringBuffer = dateToUtcString(value);
                                break;
                            case 7:
                                this.stringBuffer = String(value.getTime() / 1000);
                                break;
                            default:
                                console.warn("Missing timestamp format, using epoch seconds", value);
                                this.stringBuffer = String(value.getTime() / 1000);
                        }
                        return;
                    }
                    if (ns.isBlobSchema() && "byteLength" in value) {
                        this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(value);
                        return;
                    }
                    if (ns.isListSchema() && Array.isArray(value)) {
                        let buffer = "";
                        for (const item of value) {
                            this.write([ns.getValueSchema(), ns.getMergedTraits()], item);
                            const headerItem = this.flush();
                            const serialized = ns.getValueSchema().isTimestampSchema() ? headerItem : quoteHeader(headerItem);
                            if (buffer !== "") {
                                buffer += ", ";
                            }
                            buffer += serialized;
                        }
                        this.stringBuffer = buffer;
                        return;
                    }
                    this.stringBuffer = JSON.stringify(value, null, 2);
                    break;
                case "string":
                    const mediaType = ns.getMergedTraits().mediaType;
                    let intermediateValue = value;
                    if (mediaType) {
                        const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
                        if (isJson) {
                            intermediateValue = LazyJsonString.from(intermediateValue);
                        }
                        if (ns.getMergedTraits().httpHeader) {
                            this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(intermediateValue.toString());
                            return;
                        }
                    }
                    this.stringBuffer = value;
                    break;
                default:
                    if (ns.isIdempotencyToken()) {
                        this.stringBuffer = generateIdempotencyToken();
                    }
                    else {
                        this.stringBuffer = String(value);
                    }
            }
        }
        flush() {
            const buffer = this.stringBuffer;
            this.stringBuffer = "";
            return buffer;
        }
    }

    class HttpInterceptingShapeSerializer {
        codecSerializer;
        stringSerializer;
        buffer;
        constructor(codecSerializer, codecSettings, stringSerializer = new ToStringShapeSerializer(codecSettings)) {
            this.codecSerializer = codecSerializer;
            this.stringSerializer = stringSerializer;
        }
        setSerdeContext(serdeContext) {
            this.codecSerializer.setSerdeContext(serdeContext);
            this.stringSerializer.setSerdeContext(serdeContext);
        }
        write(schema, value) {
            const ns = NormalizedSchema.of(schema);
            const traits = ns.getMergedTraits();
            if (traits.httpHeader || traits.httpLabel || traits.httpQuery) {
                this.stringSerializer.write(ns, value);
                this.buffer = this.stringSerializer.flush();
                return;
            }
            return this.codecSerializer.write(ns, value);
        }
        flush() {
            if (this.buffer !== undefined) {
                const buffer = this.buffer;
                this.buffer = undefined;
                return buffer;
            }
            return this.codecSerializer.flush();
        }
    }

    const getHttpHandlerExtensionConfiguration = (runtimeConfig) => {
        if (runtimeConfig.logger && runtimeConfig.logger.constructor?.name !== "NoOpLogger") {
            runtimeConfig.requestHandler?.updateHttpClientConfig?.(Symbol.for("logger"), runtimeConfig.logger);
        }
        return {
            setHttpHandler(handler) {
                runtimeConfig.requestHandler = handler;
            },
            httpHandler() {
                return runtimeConfig.requestHandler;
            },
            updateHttpClientConfig(key, value) {
                runtimeConfig.requestHandler?.updateHttpClientConfig(key, value);
            },
            httpHandlerConfigs() {
                return runtimeConfig.requestHandler.httpHandlerConfigs();
            },
        };
    };
    const resolveHttpHandlerRuntimeConfig = (httpHandlerExtensionConfiguration) => {
        return {
            requestHandler: httpHandlerExtensionConfiguration.httpHandler(),
        };
    };

    const CONTENT_LENGTH_HEADER = "content-length";
    function contentLengthMiddleware(bodyLengthChecker) {
        return (next) => async (args) => {
            const request = args.request;
            if (HttpRequest.isInstance(request)) {
                const { body, headers } = request;
                if (body &&
                    Object.keys(headers)
                        .map((str) => str.toLowerCase())
                        .indexOf(CONTENT_LENGTH_HEADER) === -1) {
                    try {
                        const length = bodyLengthChecker(body);
                        if (length != null) {
                            request.headers = {
                                ...request.headers,
                                [CONTENT_LENGTH_HEADER]: String(length),
                            };
                        }
                    }
                    catch (ignored) {
                    }
                }
            }
            return next({
                ...args,
                request,
            });
        };
    }
    const contentLengthMiddlewareOptions = {
        step: "build",
        tags: ["SET_CONTENT_LENGTH", "CONTENT_LENGTH"],
        name: "contentLengthMiddleware",
        override: true,
    };
    const getContentLengthPlugin = (options) => ({
        applyToStack: (clientStack) => {
            clientStack.add(contentLengthMiddleware(options.bodyLengthChecker), contentLengthMiddlewareOptions);
        },
    });

    const escapeUri = (uri) => encodeURIComponent(uri).replace(/[!'()*]/g, hexEncode);
    const hexEncode = (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`;

    function buildQueryString(query) {
        const parts = [];
        for (let key of Object.keys(query).sort()) {
            const value = query[key];
            key = escapeUri(key);
            if (Array.isArray(value)) {
                for (let i = 0, iLen = value.length; i < iLen; i++) {
                    parts.push(`${key}=${escapeUri(value[i])}`);
                }
            }
            else {
                let qsEntry = key;
                if (value || typeof value === "string") {
                    qsEntry += `=${escapeUri(value)}`;
                }
                parts.push(qsEntry);
            }
        }
        return parts.join("&");
    }

    const THROTTLING_ERROR_CODES = [
        "BandwidthLimitExceeded",
        "EC2ThrottledException",
        "LimitExceededException",
        "PriorRequestNotComplete",
        "ProvisionedThroughputExceededException",
        "RequestLimitExceeded",
        "RequestThrottled",
        "RequestThrottledException",
        "SlowDown",
        "ThrottledException",
        "Throttling",
        "ThrottlingException",
        "TooManyRequestsException",
        "TransactionInProgressException",
    ];
    const TRANSIENT_ERROR_CODES = ["TimeoutError", "RequestTimeout", "RequestTimeoutException"];
    const TRANSIENT_ERROR_STATUS_CODES = [500, 502, 503, 504];
    const NODEJS_TIMEOUT_ERROR_CODES = ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"];
    const NODEJS_NETWORK_ERROR_CODES = ["EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN"];

    const isRetryableByTrait = (error) => error?.$retryable !== undefined;
    const isClockSkewCorrectedError = (error) => error.$metadata?.clockSkewCorrected;
    const isBrowserNetworkError = (error) => {
        const errorMessages = new Set([
            "Failed to fetch",
            "NetworkError when attempting to fetch resource",
            "The Internet connection appears to be offline",
            "Load failed",
            "Network request failed",
        ]);
        const isValid = error && error instanceof TypeError;
        if (!isValid) {
            return false;
        }
        return errorMessages.has(error.message);
    };
    const isThrottlingError = (error) => error.$metadata?.httpStatusCode === 429 ||
        THROTTLING_ERROR_CODES.includes(error.name) ||
        error.$retryable?.throttling == true;
    const isTransientError = (error, depth = 0) => isRetryableByTrait(error) ||
        isClockSkewCorrectedError(error) ||
        (error.name === "InvalidSignatureException" && error.message?.includes("Signature expired")) ||
        TRANSIENT_ERROR_CODES.includes(error.name) ||
        NODEJS_TIMEOUT_ERROR_CODES.includes(error?.code || "") ||
        NODEJS_NETWORK_ERROR_CODES.includes(error?.code || "") ||
        TRANSIENT_ERROR_STATUS_CODES.includes(error.$metadata?.httpStatusCode || 0) ||
        isBrowserNetworkError(error) ||
        isNodeJsHttp2TransientError(error) ||
        (error.cause !== undefined && depth <= 10 && isTransientError(error.cause, depth + 1));
    const isServerError = (error) => {
        if (error.$metadata?.httpStatusCode !== undefined) {
            const statusCode = error.$metadata.httpStatusCode;
            if (500 <= statusCode && statusCode <= 599 && !isTransientError(error)) {
                return true;
            }
            return false;
        }
        return false;
    };
    function isNodeJsHttp2TransientError(error) {
        return error.code === "ERR_HTTP2_STREAM_ERROR" && error.message.includes("NGHTTP2_REFUSED_STREAM");
    }

    const MAXIMUM_RETRY_DELAY = 20 * 1000;
    const INITIAL_RETRY_TOKENS = 500;
    const NO_RETRY_INCREMENT = 1;
    const INVOCATION_ID_HEADER = "amz-sdk-invocation-id";
    const REQUEST_HEADER = "amz-sdk-request";

    function parseRetryAfterHeader(response, logger) {
        if (!HttpResponse.isInstance(response)) {
            return;
        }
        for (const header in response.headers) {
            if (!hasOwn(response.headers, header))
                continue;
            const h = header.toLowerCase();
            if (h === "retry-after") {
                const retryAfter = response.headers[header];
                let retryAfterSeconds = NaN;
                if (retryAfter.endsWith("GMT")) {
                    try {
                        const date = parseRfc7231DateTime(retryAfter);
                        retryAfterSeconds = (date.getTime() - Date.now()) / 1000;
                    }
                    catch (e) {
                        logger?.trace?.("Failed to parse retry-after header");
                        logger?.trace?.(e);
                    }
                }
                else if (retryAfter.match(/ GMT, ((\d+)|(\d+\.\d+))$/)) {
                    retryAfterSeconds = Number(retryAfter.match(/ GMT, ([\d.]+)$/)?.[1]);
                }
                else if (retryAfter.match(/^((\d+)|(\d+\.\d+))$/)) {
                    retryAfterSeconds = Number(retryAfter);
                }
                else if (Date.parse(retryAfter) >= Date.now()) {
                    retryAfterSeconds = (Date.parse(retryAfter) - Date.now()) / 1000;
                }
                if (isNaN(retryAfterSeconds)) {
                    return;
                }
                return new Date(Date.now() + retryAfterSeconds * 1000);
            }
            else if (h === "x-amz-retry-after") {
                const v = response.headers[header];
                const backoffMilliseconds = Number(v);
                if (isNaN(backoffMilliseconds)) {
                    logger?.trace?.(`Failed to parse x-amz-retry-after=${v}`);
                    return;
                }
                return new Date(Date.now() + backoffMilliseconds);
            }
        }
    }

    const asSdkError = (error) => {
        if (error instanceof Error)
            return error;
        if (error instanceof Object)
            return Object.assign(new Error(), error);
        if (typeof error === "string")
            return new Error(error);
        return new Error(`AWS SDK error wrapper for ${error}`);
    };

    function bindRetryMiddleware(isStreamingPayload) {
        return (options) => (next, context) => async (args) => {
            let retryStrategy = await options.retryStrategy();
            const maxAttempts = await options.maxAttempts();
            if (isRetryStrategyV2(retryStrategy)) {
                retryStrategy = retryStrategy;
                let retryToken = await retryStrategy.acquireInitialRetryToken((context["partition_id"] ?? "") + (context.__retryLongPoll ? ":longpoll" : ""));
                let lastError = new Error();
                let attempts = 0;
                let totalRetryDelay = 0;
                const { request } = args;
                const isRequest = HttpRequest.isInstance(request);
                if (isRequest) {
                    request.headers[INVOCATION_ID_HEADER] = v4();
                }
                while (true) {
                    try {
                        if (isRequest) {
                            request.headers[REQUEST_HEADER] = `attempt=${attempts + 1}; max=${maxAttempts}`;
                        }
                        const { response, output } = await next(args);
                        retryStrategy.recordSuccess(retryToken);
                        output.$metadata.attempts = attempts + 1;
                        output.$metadata.totalRetryDelay = totalRetryDelay;
                        return { response, output };
                    }
                    catch (e) {
                        const retryErrorInfo = getRetryErrorInfo(e, options.logger);
                        lastError = asSdkError(e);
                        if (isRequest && isStreamingPayload(request)) {
                            (context.logger instanceof NoOpLogger ? console : context.logger)?.warn("An error was encountered in a non-retryable streaming request.");
                            throw lastError;
                        }
                        try {
                            retryToken = await retryStrategy.refreshRetryTokenForRetry(retryToken, retryErrorInfo);
                        }
                        catch (ignoredRefreshError) {
                            if (!lastError.$metadata) {
                                lastError.$metadata = {};
                            }
                            lastError.$metadata.attempts = attempts + 1;
                            lastError.$metadata.totalRetryDelay = totalRetryDelay;
                            throw lastError;
                        }
                        attempts = retryToken.getRetryCount();
                        const delay = retryToken.getRetryDelay();
                        totalRetryDelay += (retryToken?.$retryLog?.acquisitionDelay ?? 0) + delay;
                        if (delay > 0) {
                            await cooldown(delay);
                        }
                    }
                }
            }
            else {
                retryStrategy = retryStrategy;
                if (retryStrategy?.mode) {
                    context.userAgent = [...(context.userAgent || []), ["cfg/retry-mode", retryStrategy.mode]];
                }
                return retryStrategy.retry(next, args);
            }
        };
    }
    const cooldown = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isRetryStrategyV2 = (retryStrategy) => typeof retryStrategy.acquireInitialRetryToken !== "undefined" &&
        typeof retryStrategy.refreshRetryTokenForRetry !== "undefined" &&
        typeof retryStrategy.recordSuccess !== "undefined";
    const getRetryErrorInfo = (error, logger) => {
        const errorInfo = {
            error,
            errorType: getRetryErrorType(error),
        };
        const retryAfterHint = parseRetryAfterHeader(error.$response, logger);
        if (retryAfterHint) {
            errorInfo.retryAfterHint = retryAfterHint;
        }
        return errorInfo;
    };
    const getRetryErrorType = (error) => {
        if (isThrottlingError(error))
            return "THROTTLING";
        if (isTransientError(error))
            return "TRANSIENT";
        if (isServerError(error))
            return "SERVER_ERROR";
        return "CLIENT_ERROR";
    };
    const retryMiddlewareOptions = {
        name: "retryMiddleware",
        tags: ["RETRY"],
        step: "finalizeRequest",
        priority: "high",
        override: true,
    };
    function bindGetRetryPlugin(isStreamingPayload) {
        const retryMiddleware = bindRetryMiddleware(isStreamingPayload);
        return (options) => ({
            applyToStack: (clientStack) => {
                clientStack.add(retryMiddleware(options), retryMiddlewareOptions);
            },
        });
    }

    class DefaultRateLimiter {
        static setTimeoutFn = (fn, delay) => setTimeout(fn, delay);
        beta;
        minCapacity;
        minFillRate;
        scaleConstant;
        smooth;
        enabled = false;
        availableTokens = 0;
        lastMaxRate = 0;
        measuredTxRate = 0;
        requestCount = 0;
        fillRate;
        lastThrottleTime;
        lastTimestamp = 0;
        lastTxRateBucket;
        maxCapacity;
        timeWindow = 0;
        constructor(options) {
            this.beta = options?.beta ?? 0.7;
            this.minCapacity = options?.minCapacity ?? 1;
            this.minFillRate = options?.minFillRate ?? 0.5;
            this.scaleConstant = options?.scaleConstant ?? 0.4;
            this.smooth = options?.smooth ?? 0.8;
            this.lastThrottleTime = this.getCurrentTimeInSeconds();
            this.lastTxRateBucket = Math.floor(this.getCurrentTimeInSeconds());
            this.fillRate = this.minFillRate;
            this.maxCapacity = this.minCapacity;
        }
        async getSendToken() {
            return this.acquireTokenBucket(1);
        }
        updateClientSendingRate(response) {
            let calculatedRate;
            this.updateMeasuredRate();
            const retryErrorInfo = response;
            const isThrottling = retryErrorInfo?.errorType === "THROTTLING" || isThrottlingError(retryErrorInfo?.error ?? response);
            if (isThrottling) {
                const rateToUse = !this.enabled ? this.measuredTxRate : Math.min(this.measuredTxRate, this.fillRate);
                this.lastMaxRate = rateToUse;
                this.calculateTimeWindow();
                this.lastThrottleTime = this.getCurrentTimeInSeconds();
                calculatedRate = this.cubicThrottle(rateToUse);
                this.enableTokenBucket();
            }
            else {
                this.calculateTimeWindow();
                calculatedRate = this.cubicSuccess(this.getCurrentTimeInSeconds());
            }
            const newRate = Math.min(calculatedRate, 2 * this.measuredTxRate);
            this.updateTokenBucketRate(newRate);
        }
        getCurrentTimeInSeconds() {
            return Date.now() / 1000;
        }
        async acquireTokenBucket(amount) {
            if (!this.enabled) {
                return;
            }
            this.refillTokenBucket();
            while (amount > this.availableTokens) {
                const delay = ((amount - this.availableTokens) / this.fillRate) * 1000;
                await new Promise((resolve) => DefaultRateLimiter.setTimeoutFn(resolve, delay));
                this.refillTokenBucket();
            }
            this.availableTokens = this.availableTokens - amount;
        }
        refillTokenBucket() {
            const timestamp = this.getCurrentTimeInSeconds();
            if (!this.lastTimestamp) {
                this.lastTimestamp = timestamp;
                return;
            }
            const fillAmount = (timestamp - this.lastTimestamp) * this.fillRate;
            this.availableTokens = Math.min(this.maxCapacity, this.availableTokens + fillAmount);
            this.lastTimestamp = timestamp;
        }
        calculateTimeWindow() {
            this.timeWindow = this.getPrecise(Math.pow((this.lastMaxRate * (1 - this.beta)) / this.scaleConstant, 1 / 3));
        }
        cubicThrottle(rateToUse) {
            return this.getPrecise(rateToUse * this.beta);
        }
        cubicSuccess(timestamp) {
            return this.getPrecise(this.scaleConstant * Math.pow(timestamp - this.lastThrottleTime - this.timeWindow, 3) + this.lastMaxRate);
        }
        enableTokenBucket() {
            this.enabled = true;
        }
        updateTokenBucketRate(newRate) {
            this.refillTokenBucket();
            this.fillRate = Math.max(newRate, this.minFillRate);
            this.maxCapacity = Math.max(newRate, this.minCapacity);
            this.availableTokens = Math.min(this.availableTokens, this.maxCapacity);
        }
        updateMeasuredRate() {
            const t = this.getCurrentTimeInSeconds();
            const timeBucket = Math.floor(t * 2) / 2;
            this.requestCount++;
            if (timeBucket > this.lastTxRateBucket) {
                const currentRate = this.requestCount / (timeBucket - this.lastTxRateBucket);
                this.measuredTxRate = this.getPrecise(currentRate * this.smooth + this.measuredTxRate * (1 - this.smooth));
                this.requestCount = 0;
                this.lastTxRateBucket = timeBucket;
            }
        }
        getPrecise(num) {
            return parseFloat(num.toFixed(8));
        }
    }

    class Retry {
        static v2026 = typeof process !== "undefined" && process.env?.SMITHY_NEW_RETRIES_2026 === "true";
        static delay() {
            return Retry.v2026 ? 50 : 100;
        }
        static throttlingDelay() {
            return Retry.v2026 ? 1_000 : 500;
        }
        static cost() {
            return Retry.v2026 ? 14 : 5;
        }
        static throttlingCost() {
            return Retry.v2026 ? 5 : 10;
        }
        static modifiedCostType() {
            return Retry.v2026 ? "THROTTLING" : "TRANSIENT";
        }
    }

    class DefaultRetryBackoffStrategy {
        x = Retry.delay();
        computeNextBackoffDelay(i) {
            const b = Math.random();
            const r = 2;
            const t_i = b * Math.min(this.x * r ** i, MAXIMUM_RETRY_DELAY);
            return Math.floor(t_i);
        }
        setDelayBase(delay) {
            this.x = delay;
        }
    }

    class DefaultRetryToken {
        delay;
        count;
        cost;
        longPoll;
        $retryLog = {
            acquisitionDelay: 0,
        };
        constructor(delay, count, cost, longPoll) {
            this.delay = delay;
            this.count = count;
            this.cost = cost;
            this.longPoll = longPoll;
        }
        getRetryCount() {
            return this.count;
        }
        getRetryDelay() {
            return Math.min(MAXIMUM_RETRY_DELAY, this.delay);
        }
        getRetryCost() {
            return this.cost;
        }
        isLongPoll() {
            return this.longPoll;
        }
    }

    var RETRY_MODES;
    (function (RETRY_MODES) {
        RETRY_MODES["STANDARD"] = "standard";
        RETRY_MODES["ADAPTIVE"] = "adaptive";
    })(RETRY_MODES || (RETRY_MODES = {}));
    const DEFAULT_MAX_ATTEMPTS = 3;
    const DEFAULT_RETRY_MODE = RETRY_MODES.STANDARD;

    const refusal = {
        incompatible: 1,
        attempts: 2,
        capacity: 3,
    };
    class StandardRetryStrategy {
        mode = RETRY_MODES.STANDARD;
        retryBackoffStrategy;
        capacity = INITIAL_RETRY_TOKENS;
        maxAttemptsProvider;
        baseDelay;
        constructor(arg1) {
            if (typeof arg1 === "number") {
                this.maxAttemptsProvider = async () => arg1;
            }
            else if (typeof arg1 === "function") {
                this.maxAttemptsProvider = arg1;
            }
            else if (arg1 && typeof arg1 === "object") {
                this.maxAttemptsProvider = async () => arg1.maxAttempts;
                this.baseDelay = arg1.baseDelay;
                this.retryBackoffStrategy = arg1.backoff;
            }
            this.maxAttemptsProvider ??= async () => DEFAULT_MAX_ATTEMPTS;
            this.baseDelay ??= Retry.delay();
            this.retryBackoffStrategy ??= new DefaultRetryBackoffStrategy();
        }
        async acquireInitialRetryToken(retryTokenScope) {
            return new DefaultRetryToken(Retry.delay(), 0, undefined, Retry.v2026 && retryTokenScope.includes(":longpoll"));
        }
        async refreshRetryTokenForRetry(token, errorInfo) {
            const maxAttempts = await this.getMaxAttempts();
            const retryCode = this.retryCode(token, errorInfo, maxAttempts);
            const shouldRetry = retryCode === 0;
            const isLongPoll = token.isLongPoll?.();
            if (shouldRetry || isLongPoll) {
                const errorType = errorInfo.errorType;
                this.retryBackoffStrategy.setDelayBase(errorType === "THROTTLING" ? Retry.throttlingDelay() : this.baseDelay);
                const delayFromErrorType = this.retryBackoffStrategy.computeNextBackoffDelay(token.getRetryCount());
                let retryDelay = delayFromErrorType;
                if (errorInfo.retryAfterHint instanceof Date) {
                    retryDelay = Math.max(delayFromErrorType, Math.min(errorInfo.retryAfterHint.getTime() - Date.now(), delayFromErrorType + 5_000));
                }
                if (!shouldRetry) {
                    const longPollBackoff = Retry.v2026 && retryCode === refusal.capacity && isLongPoll ? retryDelay : 0;
                    if (longPollBackoff > 0) {
                        await new Promise((r) => setTimeout(r, longPollBackoff));
                    }
                }
                else {
                    const capacityCost = this.getCapacityCost(errorType);
                    this.capacity -= capacityCost;
                    const nextToken = new DefaultRetryToken(0, token.getRetryCount() + 1, capacityCost, token.isLongPoll?.() ?? false);
                    await new Promise((r) => setTimeout(r, retryDelay));
                    nextToken.$retryLog.acquisitionDelay = retryDelay;
                    return nextToken;
                }
            }
            throw new Error("No retry token available");
        }
        recordSuccess(token) {
            this.capacity = Math.min(INITIAL_RETRY_TOKENS, this.capacity + (token.getRetryCost() ?? NO_RETRY_INCREMENT));
        }
        getCapacity() {
            return this.capacity;
        }
        async maxAttempts() {
            return this.maxAttemptsProvider();
        }
        async getMaxAttempts() {
            try {
                return await this.maxAttemptsProvider();
            }
            catch (ignored) {
                console.warn(`Max attempts provider could not resolve. Using default of ${DEFAULT_MAX_ATTEMPTS}`);
                return DEFAULT_MAX_ATTEMPTS;
            }
        }
        retryCode(tokenToRenew, errorInfo, maxAttempts) {
            const attempts = tokenToRenew.getRetryCount() + 1;
            const retryableStatus = this.isRetryableError(errorInfo.errorType) ? 0 : refusal.incompatible;
            const attemptStatus = attempts < maxAttempts ? 0 : refusal.attempts;
            const capacityStatus = this.capacity >= this.getCapacityCost(errorInfo.errorType) ? 0 : refusal.capacity;
            return retryableStatus || attemptStatus || capacityStatus;
        }
        getCapacityCost(errorType) {
            return errorType === Retry.modifiedCostType() ? Retry.throttlingCost() : Retry.cost();
        }
        isRetryableError(errorType) {
            return errorType === "THROTTLING" || errorType === "TRANSIENT";
        }
    }

    class AdaptiveRetryStrategy {
        mode = RETRY_MODES.ADAPTIVE;
        rateLimiter;
        standardRetryStrategy;
        constructor(maxAttemptsProvider, options) {
            const { rateLimiter } = options ?? {};
            this.rateLimiter = rateLimiter ?? new DefaultRateLimiter();
            this.standardRetryStrategy = options
                ? new StandardRetryStrategy({
                    maxAttempts: typeof maxAttemptsProvider === "number" ? maxAttemptsProvider : 3,
                    ...options,
                })
                : new StandardRetryStrategy(maxAttemptsProvider);
        }
        async acquireInitialRetryToken(retryTokenScope) {
            const token = await this.standardRetryStrategy.acquireInitialRetryToken(retryTokenScope);
            await this.rateLimiter.getSendToken();
            return token;
        }
        async refreshRetryTokenForRetry(tokenToRenew, errorInfo) {
            this.rateLimiter.updateClientSendingRate(errorInfo);
            const token = await this.standardRetryStrategy.refreshRetryTokenForRetry(tokenToRenew, errorInfo);
            await this.rateLimiter.getSendToken();
            return token;
        }
        recordSuccess(token) {
            this.rateLimiter.updateClientSendingRate({});
            this.standardRetryStrategy.recordSuccess(token);
        }
        async maxAttemptsProvider() {
            return this.standardRetryStrategy.maxAttempts();
        }
    }

    const resolveRetryConfig = (input, defaults) => {
        const { retryStrategy, retryMode } = input;
        const { defaultMaxAttempts = DEFAULT_MAX_ATTEMPTS, defaultBaseDelay = Retry.delay() } = {};
        const maxAttemptsProvider = normalizeProvider$1(input.maxAttempts ?? defaultMaxAttempts);
        let controller = retryStrategy
            ? Promise.resolve(retryStrategy)
            : undefined;
        const getDefault = async () => {
            const maxAttempts = await maxAttemptsProvider();
            const adaptive = (await normalizeProvider$1(retryMode)()) === RETRY_MODES.ADAPTIVE;
            if (adaptive) {
                return new AdaptiveRetryStrategy(maxAttemptsProvider, {
                    maxAttempts,
                    baseDelay: defaultBaseDelay,
                });
            }
            return new StandardRetryStrategy({
                maxAttempts,
                baseDelay: defaultBaseDelay,
            });
        };
        return Object.assign(input, {
            maxAttempts: maxAttemptsProvider,
            retryStrategy: () => (controller ??= getDefault()),
        });
    };

    const getRetryPlugin = bindGetRetryPlugin(isStreamingPayload);

    Retry.v2026 ||= typeof process === "object" && process.env?.AWS_NEW_RETRIES_2026 === "true";
    function setFeature(context, feature, value) {
        if (!context.__aws_sdk_context) {
            context.__aws_sdk_context = {
                features: {},
            };
        }
        else if (!context.__aws_sdk_context.features) {
            context.__aws_sdk_context.features = {};
        }
        context.__aws_sdk_context.features[feature] = value;
    }

    function resolveHostHeaderConfig(input) {
        return input;
    }
    const hostHeaderMiddleware = (options) => (next) => async (args) => {
        if (!HttpRequest.isInstance(args.request))
            return next(args);
        const { request } = args;
        const { handlerProtocol = "" } = options.requestHandler.metadata || {};
        if (handlerProtocol.indexOf("h2") >= 0 && !request.headers[":authority"]) {
            delete request.headers["host"];
            request.headers[":authority"] = request.hostname + (request.port ? ":" + request.port : "");
        }
        else if (!request.headers["host"]) {
            let host = request.hostname;
            if (request.port != null)
                host += `:${request.port}`;
            request.headers["host"] = host;
        }
        return next(args);
    };
    const hostHeaderMiddlewareOptions = {
        name: "hostHeaderMiddleware",
        step: "build",
        priority: "low",
        tags: ["HOST"],
        override: true,
    };
    const getHostHeaderPlugin = (options) => ({
        applyToStack: (clientStack) => {
            clientStack.add(hostHeaderMiddleware(options), hostHeaderMiddlewareOptions);
        },
    });

    const loggerMiddleware = () => (next, context) => async (args) => {
        try {
            const response = await next(args);
            const { clientName, commandName, logger, dynamoDbDocumentClientOptions = {} } = context;
            const { overrideInputFilterSensitiveLog, overrideOutputFilterSensitiveLog } = dynamoDbDocumentClientOptions;
            const inputFilterSensitiveLog = overrideInputFilterSensitiveLog ?? context.inputFilterSensitiveLog;
            const outputFilterSensitiveLog = overrideOutputFilterSensitiveLog ?? context.outputFilterSensitiveLog;
            const { $metadata, ...outputWithoutMetadata } = response.output;
            logger?.info?.({
                clientName,
                commandName,
                input: inputFilterSensitiveLog(args.input),
                output: outputFilterSensitiveLog(outputWithoutMetadata),
                metadata: $metadata,
            });
            return response;
        }
        catch (error) {
            const { clientName, commandName, logger, dynamoDbDocumentClientOptions = {} } = context;
            const { overrideInputFilterSensitiveLog } = dynamoDbDocumentClientOptions;
            const inputFilterSensitiveLog = overrideInputFilterSensitiveLog ?? context.inputFilterSensitiveLog;
            logger?.error?.({
                clientName,
                commandName,
                input: inputFilterSensitiveLog(args.input),
                error,
                metadata: error.$metadata,
            });
            throw error;
        }
    };
    const loggerMiddlewareOptions = {
        name: "loggerMiddleware",
        tags: ["LOGGER"],
        step: "initialize",
        override: true,
    };
    const getLoggerPlugin = (options) => ({
        applyToStack: (clientStack) => {
            clientStack.add(loggerMiddleware(), loggerMiddlewareOptions);
        },
    });

    const getRecursionDetectionPlugin = (options) => ({
        applyToStack: (clientStack) => { },
    });

    const resolveAuthOptions = (candidateAuthOptions, authSchemePreference) => {
        if (!authSchemePreference || authSchemePreference.length === 0) {
            return candidateAuthOptions;
        }
        const preferredAuthOptions = [];
        for (const preferredSchemeName of authSchemePreference) {
            for (const candidateAuthOption of candidateAuthOptions) {
                const candidateAuthSchemeName = candidateAuthOption.schemeId.split("#")[1];
                if (candidateAuthSchemeName === preferredSchemeName) {
                    preferredAuthOptions.push(candidateAuthOption);
                }
            }
        }
        for (const candidateAuthOption of candidateAuthOptions) {
            if (!preferredAuthOptions.find(({ schemeId }) => schemeId === candidateAuthOption.schemeId)) {
                preferredAuthOptions.push(candidateAuthOption);
            }
        }
        return preferredAuthOptions;
    };

    function convertHttpAuthSchemesToMap(httpAuthSchemes) {
        const map = new Map();
        for (const scheme of httpAuthSchemes) {
            map.set(scheme.schemeId, scheme);
        }
        return map;
    }
    const httpAuthSchemeMiddleware = (config, mwOptions) => (next, context) => async (args) => {
        const options = config.httpAuthSchemeProvider(await mwOptions.httpAuthSchemeParametersProvider(config, context, args.input));
        const authSchemePreference = config.authSchemePreference ? await config.authSchemePreference() : [];
        const resolvedOptions = resolveAuthOptions(options, authSchemePreference);
        const authSchemes = convertHttpAuthSchemesToMap(config.httpAuthSchemes);
        const smithyContext = getSmithyContext(context);
        const failureReasons = [];
        for (const option of resolvedOptions) {
            const scheme = authSchemes.get(option.schemeId);
            if (!scheme) {
                failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` was not enabled for this service.`);
                continue;
            }
            const identityProvider = scheme.identityProvider(await mwOptions.identityProviderConfigProvider(config));
            if (!identityProvider) {
                failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` did not have an IdentityProvider configured.`);
                continue;
            }
            const { identityProperties = {}, signingProperties = {} } = option.propertiesExtractor?.(config, context) || {};
            option.identityProperties = Object.assign(option.identityProperties || {}, identityProperties);
            option.signingProperties = Object.assign(option.signingProperties || {}, signingProperties);
            smithyContext.selectedHttpAuthScheme = {
                httpAuthOption: option,
                identity: await identityProvider(option.identityProperties),
                signer: scheme.signer,
            };
            break;
        }
        if (!smithyContext.selectedHttpAuthScheme) {
            throw new Error(failureReasons.join("\n"));
        }
        return next(args);
    };

    const httpAuthSchemeEndpointRuleSetMiddlewareOptions = {
        step: "serialize",
        tags: ["HTTP_AUTH_SCHEME"],
        name: "httpAuthSchemeMiddleware",
        override: true,
        relation: "before",
        toMiddleware: "endpointV2Middleware",
    };
    const getHttpAuthSchemeEndpointRuleSetPlugin = (config, { httpAuthSchemeParametersProvider, identityProviderConfigProvider, }) => ({
        applyToStack: (clientStack) => {
            clientStack.addRelativeTo(httpAuthSchemeMiddleware(config, {
                httpAuthSchemeParametersProvider,
                identityProviderConfigProvider,
            }), httpAuthSchemeEndpointRuleSetMiddlewareOptions);
        },
    });

    const defaultErrorHandler = (signingProperties) => (error) => {
        throw error;
    };
    const defaultSuccessHandler = (httpResponse, signingProperties) => { };
    const httpSigningMiddleware = (config) => (next, context) => async (args) => {
        if (!HttpRequest.isInstance(args.request)) {
            return next(args);
        }
        const smithyContext = getSmithyContext(context);
        const scheme = smithyContext.selectedHttpAuthScheme;
        if (!scheme) {
            throw new Error(`No HttpAuthScheme was selected: unable to sign request`);
        }
        const { httpAuthOption: { signingProperties = {} }, identity, signer, } = scheme;
        const output = await next({
            ...args,
            request: await signer.sign(args.request, identity, signingProperties),
        }).catch((signer.errorHandler || defaultErrorHandler)(signingProperties));
        (signer.successHandler || defaultSuccessHandler)(output.response, signingProperties);
        return output;
    };

    const httpSigningMiddlewareOptions = {
        step: "finalizeRequest",
        tags: ["HTTP_SIGNING"],
        name: "httpSigningMiddleware",
        aliases: ["apiKeyMiddleware", "tokenMiddleware", "awsAuthMiddleware"],
        override: true,
        relation: "after",
        toMiddleware: "retryMiddleware",
    };
    const getHttpSigningPlugin = (config) => ({
        applyToStack: (clientStack) => {
            clientStack.addRelativeTo(httpSigningMiddleware(), httpSigningMiddlewareOptions);
        },
    });

    const normalizeProvider = (input) => {
        if (typeof input === "function")
            return input;
        const promisified = Promise.resolve(input);
        return () => promisified;
    };

    class DefaultIdentityProviderConfig {
        authSchemes = new Map();
        constructor(config) {
            for (const key in config) {
                if (!hasOwn(config, key))
                    continue;
                const value = config[key];
                if (value !== undefined) {
                    this.authSchemes.set(key, value);
                }
            }
        }
        getIdentityProvider(schemeId) {
            return this.authSchemes.get(schemeId);
        }
    }

    const createIsIdentityExpiredFunction = (expirationMs) => function isIdentityExpired(identity) {
        return doesIdentityRequireRefresh(identity) && identity.expiration.getTime() - Date.now() < expirationMs;
    };
    const EXPIRATION_MS = 300_000;
    const isIdentityExpired = createIsIdentityExpiredFunction(EXPIRATION_MS);
    const doesIdentityRequireRefresh = (identity) => identity.expiration !== undefined;
    const memoizeIdentityProvider = (provider, isExpired, requiresRefresh) => {
        if (provider === undefined) {
            return undefined;
        }
        const normalizedProvider = typeof provider !== "function" ? async () => Promise.resolve(provider) : provider;
        let resolved;
        let pending;
        let hasResult;
        let isConstant = false;
        const coalesceProvider = async (options) => {
            if (!pending) {
                pending = normalizedProvider(options);
            }
            try {
                resolved = await pending;
                hasResult = true;
                isConstant = false;
            }
            finally {
                pending = undefined;
            }
            return resolved;
        };
        if (isExpired === undefined) {
            return async (options) => {
                if (!hasResult || options?.forceRefresh) {
                    resolved = await coalesceProvider(options);
                }
                return resolved;
            };
        }
        return async (options) => {
            if (!hasResult || options?.forceRefresh) {
                resolved = await coalesceProvider(options);
            }
            if (isConstant) {
                return resolved;
            }
            if (!requiresRefresh(resolved)) {
                isConstant = true;
                return resolved;
            }
            if (isExpired(resolved)) {
                await coalesceProvider(options);
                return resolved;
            }
            return resolved;
        };
    };

    const DEFAULT_UA_APP_ID = undefined;
    function isValidUserAgentAppId(appId) {
        if (appId === undefined) {
            return true;
        }
        return typeof appId === "string" && appId.length <= 50;
    }
    function resolveUserAgentConfig(input) {
        const normalizedAppIdProvider = normalizeProvider(input.userAgentAppId ?? DEFAULT_UA_APP_ID);
        const { customUserAgent } = input;
        return Object.assign(input, {
            customUserAgent: typeof customUserAgent === "string" ? [[customUserAgent]] : customUserAgent,
            userAgentAppId: async () => {
                const appId = await normalizedAppIdProvider();
                if (!isValidUserAgentAppId(appId)) {
                    const logger = input.logger?.constructor?.name === "NoOpLogger" || !input.logger ? console : input.logger;
                    if (typeof appId !== "string") {
                        logger?.warn("userAgentAppId must be a string or undefined.");
                    }
                    else if (appId.length > 50) {
                        logger?.warn("The provided userAgentAppId exceeds the maximum length of 50 characters.");
                    }
                }
                return appId;
            },
        });
    }

    const partitionsInfo = {
        "partitions": [
            {
                "id": "aws",
                "outputs": {
                    "dnsSuffix": "amazonaws.com",
                    "dualStackDnsSuffix": "api.aws",
                    "implicitGlobalRegion": "us-east-1",
                    "name": "aws",
                    "supportsDualStack": true,
                    "supportsFIPS": true
                },
                "regionRegex": "^(us|eu|ap|sa|ca|me|af|il|mx)\\-\\w+\\-\\d+$",
                "regions": {
                    "af-south-1": {
                        "description": "Africa (Cape Town)"
                    },
                    "ap-east-1": {
                        "description": "Asia Pacific (Hong Kong)"
                    },
                    "ap-east-2": {
                        "description": "Asia Pacific (Taipei)"
                    },
                    "ap-northeast-1": {
                        "description": "Asia Pacific (Tokyo)"
                    },
                    "ap-northeast-2": {
                        "description": "Asia Pacific (Seoul)"
                    },
                    "ap-northeast-3": {
                        "description": "Asia Pacific (Osaka)"
                    },
                    "ap-south-1": {
                        "description": "Asia Pacific (Mumbai)"
                    },
                    "ap-south-2": {
                        "description": "Asia Pacific (Hyderabad)"
                    },
                    "ap-southeast-1": {
                        "description": "Asia Pacific (Singapore)"
                    },
                    "ap-southeast-2": {
                        "description": "Asia Pacific (Sydney)"
                    },
                    "ap-southeast-3": {
                        "description": "Asia Pacific (Jakarta)"
                    },
                    "ap-southeast-4": {
                        "description": "Asia Pacific (Melbourne)"
                    },
                    "ap-southeast-5": {
                        "description": "Asia Pacific (Malaysia)"
                    },
                    "ap-southeast-6": {
                        "description": "Asia Pacific (New Zealand)"
                    },
                    "ap-southeast-7": {
                        "description": "Asia Pacific (Thailand)"
                    },
                    "aws-global": {
                        "description": "aws global region"
                    },
                    "ca-central-1": {
                        "description": "Canada (Central)"
                    },
                    "ca-west-1": {
                        "description": "Canada West (Calgary)"
                    },
                    "eu-central-1": {
                        "description": "Europe (Frankfurt)"
                    },
                    "eu-central-2": {
                        "description": "Europe (Zurich)"
                    },
                    "eu-north-1": {
                        "description": "Europe (Stockholm)"
                    },
                    "eu-south-1": {
                        "description": "Europe (Milan)"
                    },
                    "eu-south-2": {
                        "description": "Europe (Spain)"
                    },
                    "eu-west-1": {
                        "description": "Europe (Ireland)"
                    },
                    "eu-west-2": {
                        "description": "Europe (London)"
                    },
                    "eu-west-3": {
                        "description": "Europe (Paris)"
                    },
                    "il-central-1": {
                        "description": "Israel (Tel Aviv)"
                    },
                    "me-central-1": {
                        "description": "Middle East (UAE)"
                    },
                    "me-south-1": {
                        "description": "Middle East (Bahrain)"
                    },
                    "mx-central-1": {
                        "description": "Mexico (Central)"
                    },
                    "sa-east-1": {
                        "description": "South America (Sao Paulo)"
                    },
                    "us-east-1": {
                        "description": "US East (N. Virginia)"
                    },
                    "us-east-2": {
                        "description": "US East (Ohio)"
                    },
                    "us-west-1": {
                        "description": "US West (N. California)"
                    },
                    "us-west-2": {
                        "description": "US West (Oregon)"
                    }
                }
            },
            {
                "id": "aws-cn",
                "outputs": {
                    "dnsSuffix": "amazonaws.com.cn",
                    "dualStackDnsSuffix": "api.amazonwebservices.com.cn",
                    "implicitGlobalRegion": "cn-northwest-1",
                    "name": "aws-cn",
                    "supportsDualStack": true,
                    "supportsFIPS": true
                },
                "regionRegex": "^cn\\-\\w+\\-\\d+$",
                "regions": {
                    "aws-cn-global": {
                        "description": "aws-cn global region"
                    },
                    "cn-north-1": {
                        "description": "China (Beijing)"
                    },
                    "cn-northwest-1": {
                        "description": "China (Ningxia)"
                    }
                }
            },
            {
                "id": "aws-eusc",
                "outputs": {
                    "dnsSuffix": "amazonaws.eu",
                    "dualStackDnsSuffix": "api.amazonwebservices.eu",
                    "implicitGlobalRegion": "eusc-de-east-1",
                    "name": "aws-eusc",
                    "supportsDualStack": true,
                    "supportsFIPS": true
                },
                "regionRegex": "^eusc\\-(de)\\-\\w+\\-\\d+$",
                "regions": {
                    "eusc-de-east-1": {
                        "description": "AWS European Sovereign Cloud (Germany)"
                    }
                }
            },
            {
                "id": "aws-iso",
                "outputs": {
                    "dnsSuffix": "c2s.ic.gov",
                    "dualStackDnsSuffix": "api.aws.ic.gov",
                    "implicitGlobalRegion": "us-iso-east-1",
                    "name": "aws-iso",
                    "supportsDualStack": true,
                    "supportsFIPS": true
                },
                "regionRegex": "^us\\-iso\\-\\w+\\-\\d+$",
                "regions": {
                    "aws-iso-global": {
                        "description": "aws-iso global region"
                    },
                    "us-iso-east-1": {
                        "description": "US ISO East"
                    },
                    "us-iso-west-1": {
                        "description": "US ISO WEST"
                    }
                }
            },
            {
                "id": "aws-iso-b",
                "outputs": {
                    "dnsSuffix": "sc2s.sgov.gov",
                    "dualStackDnsSuffix": "api.aws.scloud",
                    "implicitGlobalRegion": "us-isob-east-1",
                    "name": "aws-iso-b",
                    "supportsDualStack": true,
                    "supportsFIPS": true
                },
                "regionRegex": "^us\\-isob\\-\\w+\\-\\d+$",
                "regions": {
                    "aws-iso-b-global": {
                        "description": "aws-iso-b global region"
                    },
                    "us-isob-east-1": {
                        "description": "US ISOB East (Ohio)"
                    },
                    "us-isob-west-1": {
                        "description": "US ISOB West"
                    }
                }
            },
            {
                "id": "aws-iso-e",
                "outputs": {
                    "dnsSuffix": "cloud.adc-e.uk",
                    "dualStackDnsSuffix": "api.cloud-aws.adc-e.uk",
                    "implicitGlobalRegion": "eu-isoe-west-1",
                    "name": "aws-iso-e",
                    "supportsDualStack": true,
                    "supportsFIPS": true
                },
                "regionRegex": "^eu\\-isoe\\-\\w+\\-\\d+$",
                "regions": {
                    "aws-iso-e-global": {
                        "description": "aws-iso-e global region"
                    },
                    "eu-isoe-west-1": {
                        "description": "EU ISOE West"
                    }
                }
            },
            {
                "id": "aws-iso-f",
                "outputs": {
                    "dnsSuffix": "csp.hci.ic.gov",
                    "dualStackDnsSuffix": "api.aws.hci.ic.gov",
                    "implicitGlobalRegion": "us-isof-south-1",
                    "name": "aws-iso-f",
                    "supportsDualStack": true,
                    "supportsFIPS": true
                },
                "regionRegex": "^us\\-isof\\-\\w+\\-\\d+$",
                "regions": {
                    "aws-iso-f-global": {
                        "description": "aws-iso-f global region"
                    },
                    "us-isof-east-1": {
                        "description": "US ISOF EAST"
                    },
                    "us-isof-south-1": {
                        "description": "US ISOF SOUTH"
                    }
                }
            },
            {
                "id": "aws-us-gov",
                "outputs": {
                    "dnsSuffix": "amazonaws.com",
                    "dualStackDnsSuffix": "api.aws",
                    "implicitGlobalRegion": "us-gov-west-1",
                    "name": "aws-us-gov",
                    "supportsDualStack": true,
                    "supportsFIPS": true
                },
                "regionRegex": "^us\\-gov\\-\\w+\\-\\d+$",
                "regions": {
                    "aws-us-gov-global": {
                        "description": "aws-us-gov global region"
                    },
                    "us-gov-east-1": {
                        "description": "AWS GovCloud (US-East)"
                    },
                    "us-gov-west-1": {
                        "description": "AWS GovCloud (US-West)"
                    }
                }
            }
        ]};

    let selectedPartitionsInfo = partitionsInfo;
    const partition = (value) => {
        const { partitions } = selectedPartitionsInfo;
        for (const partition of partitions) {
            const { regions, outputs } = partition;
            for (const [region, regionData] of Object.entries(regions)) {
                if (region === value) {
                    return {
                        ...outputs,
                        ...regionData,
                    };
                }
            }
        }
        for (const partition of partitions) {
            const { regionRegex, outputs } = partition;
            if (new RegExp(regionRegex).test(value)) {
                return {
                    ...outputs,
                };
            }
        }
        const DEFAULT_PARTITION = partitions.find((partition) => partition.id === "aws");
        if (!DEFAULT_PARTITION) {
            throw new Error("Provided region was not found in the partition array or regex," +
                " and default partition with id 'aws' doesn't exist.");
        }
        return {
            ...DEFAULT_PARTITION.outputs,
        };
    };

    const ACCOUNT_ID_ENDPOINT_REGEX = /\d{12}\.ddb/;
    async function checkFeatures(context, config, args) {
        const request = args.request;
        if (request?.headers?.["smithy-protocol"] === "rpc-v2-cbor") {
            setFeature(context, "PROTOCOL_RPC_V2_CBOR", "M");
        }
        if (typeof config.retryStrategy === "function") {
            const retryStrategy = await config.retryStrategy();
            if (typeof retryStrategy.mode === "string") {
                switch (retryStrategy.mode) {
                    case RETRY_MODES.ADAPTIVE:
                        setFeature(context, "RETRY_MODE_ADAPTIVE", "F");
                        break;
                    case RETRY_MODES.STANDARD:
                        setFeature(context, "RETRY_MODE_STANDARD", "E");
                        break;
                }
            }
        }
        if (typeof config.accountIdEndpointMode === "function") {
            const endpointV2 = context.endpointV2;
            if (String(endpointV2?.url?.hostname).match(ACCOUNT_ID_ENDPOINT_REGEX)) {
                setFeature(context, "ACCOUNT_ID_ENDPOINT", "O");
            }
            switch (await config.accountIdEndpointMode?.()) {
                case "disabled":
                    setFeature(context, "ACCOUNT_ID_MODE_DISABLED", "Q");
                    break;
                case "preferred":
                    setFeature(context, "ACCOUNT_ID_MODE_PREFERRED", "P");
                    break;
                case "required":
                    setFeature(context, "ACCOUNT_ID_MODE_REQUIRED", "R");
                    break;
            }
        }
        const identity = context.__smithy_context?.selectedHttpAuthScheme?.identity;
        if (identity?.$source) {
            const credentials = identity;
            if (credentials.accountId) {
                setFeature(context, "RESOLVED_ACCOUNT_ID", "T");
            }
            for (const [key, value] of Object.entries(credentials.$source ?? {})) {
                setFeature(context, key, value);
            }
        }
    }

    const USER_AGENT = "user-agent";
    const X_AMZ_USER_AGENT = "x-amz-user-agent";
    const SPACE = " ";
    const UA_NAME_SEPARATOR = "/";
    const UA_NAME_ESCAPE_REGEX = /[^!$%&'*+\-.^_`|~\w]/g;
    const UA_VALUE_ESCAPE_REGEX = /[^!$%&'*+\-.^_`|~\w#]/g;
    const UA_ESCAPE_CHAR = "-";

    const BYTE_LIMIT = 1024;
    function encodeFeatures(features) {
        let buffer = "";
        for (const key in features) {
            const val = features[key];
            if (buffer.length + val.length + 1 <= BYTE_LIMIT) {
                if (buffer.length) {
                    buffer += "," + val;
                }
                else {
                    buffer += val;
                }
                continue;
            }
            break;
        }
        return buffer;
    }

    const userAgentMiddleware = (options) => (next, context) => async (args) => {
        const { request } = args;
        if (!HttpRequest.isInstance(request)) {
            return next(args);
        }
        const { headers } = request;
        const userAgent = context?.userAgent?.map(escapeUserAgent) || [];
        const defaultUserAgent = (await options.defaultUserAgentProvider()).map(escapeUserAgent);
        await checkFeatures(context, options, args);
        const awsContext = context;
        defaultUserAgent.push(`m/${encodeFeatures(Object.assign({}, context.__smithy_context?.features, awsContext.__aws_sdk_context?.features))}`);
        const customUserAgent = options?.customUserAgent?.map(escapeUserAgent) || [];
        const appId = await options.userAgentAppId();
        if (appId) {
            defaultUserAgent.push(escapeUserAgent([`app`, `${appId}`]));
        }
        const sdkUserAgentValue = ([])
            .concat([...defaultUserAgent, ...userAgent, ...customUserAgent])
            .join(SPACE);
        const normalUAValue = [
            ...defaultUserAgent.filter((section) => section.startsWith("aws-sdk-")),
            ...customUserAgent,
        ].join(SPACE);
        if (options.runtime !== "browser") {
            if (normalUAValue) {
                headers[X_AMZ_USER_AGENT] = headers[X_AMZ_USER_AGENT]
                    ? `${headers[USER_AGENT]} ${normalUAValue}`
                    : normalUAValue;
            }
            headers[USER_AGENT] = sdkUserAgentValue;
        }
        else {
            headers[X_AMZ_USER_AGENT] = sdkUserAgentValue;
        }
        return next({
            ...args,
            request,
        });
    };
    const escapeUserAgent = (userAgentPair) => {
        const name = userAgentPair[0]
            .split(UA_NAME_SEPARATOR)
            .map((part) => part.replace(UA_NAME_ESCAPE_REGEX, UA_ESCAPE_CHAR))
            .join(UA_NAME_SEPARATOR);
        const version = userAgentPair[1]?.replace(UA_VALUE_ESCAPE_REGEX, UA_ESCAPE_CHAR);
        const prefixSeparatorIndex = name.indexOf(UA_NAME_SEPARATOR);
        const prefix = name.substring(0, prefixSeparatorIndex);
        let uaName = name.substring(prefixSeparatorIndex + 1);
        if (prefix === "api") {
            uaName = uaName.toLowerCase();
        }
        return [prefix, uaName, version]
            .filter((item) => item && item.length > 0)
            .reduce((acc, item, index) => {
            switch (index) {
                case 0:
                    return item;
                case 1:
                    return `${acc}/${item}`;
                default:
                    return `${acc}#${item}`;
            }
        }, "");
    };
    const getUserAgentMiddlewareOptions = {
        name: "getUserAgentMiddleware",
        step: "build",
        priority: "low",
        tags: ["SET_USER_AGENT", "USER_AGENT"],
        override: true,
    };
    const getUserAgentPlugin = (config) => ({
        applyToStack: (clientStack) => {
            clientStack.add(userAgentMiddleware(config), getUserAgentMiddlewareOptions);
        },
    });

    const createDefaultUserAgentProvider = ({ serviceId, clientVersion }) => async (config) => {
        const navigator = typeof window !== "undefined" ? window.navigator : undefined;
        const uaString = navigator?.userAgent ?? "";
        const osName = navigator?.userAgentData?.platform ?? fallback.os(uaString) ?? "other";
        const osVersion = undefined;
        const brands = navigator?.userAgentData?.brands ?? [];
        const brand = brands[brands.length - 1];
        const browserName = brand?.brand ?? fallback.browser(uaString) ?? "unknown";
        const browserVersion = brand?.version ?? "unknown";
        const sections = [
            ["aws-sdk-js", clientVersion],
            ["ua", "2.1"],
            [`os/${osName}`, osVersion],
            ["lang/js"],
            ["md/browser", `${browserName}_${browserVersion}`],
        ];
        if (serviceId) {
            sections.push([`api/${serviceId}`, clientVersion]);
        }
        const appId = await config?.userAgentAppId?.();
        if (appId) {
            sections.push([`app/${appId}`]);
        }
        return sections;
    };
    const fallback = {
        os(ua) {
            if (/iPhone|iPad|iPod/.test(ua))
                return "iOS";
            if (/Macintosh|Mac OS X/.test(ua))
                return "macOS";
            if (/Windows NT/.test(ua))
                return "Windows";
            if (/Android/.test(ua))
                return "Android";
            if (/Linux/.test(ua))
                return "Linux";
            return undefined;
        },
        browser(ua) {
            if (/EdgiOS|EdgA|Edg\//.test(ua))
                return "Microsoft Edge";
            if (/Firefox\//.test(ua))
                return "Firefox";
            if (/Chrome\//.test(ua))
                return "Chrome";
            if (/Safari\//.test(ua))
                return "Safari";
            return undefined;
        },
    };

    const isVirtualHostableS3Bucket = (value, allowSubDomains = false) => {
        if (allowSubDomains) {
            for (const label of value.split(".")) {
                if (!isVirtualHostableS3Bucket(label)) {
                    return false;
                }
            }
            return true;
        }
        if (!isValidHostLabel(value)) {
            return false;
        }
        if (value.length < 3 || value.length > 63) {
            return false;
        }
        if (value !== value.toLowerCase()) {
            return false;
        }
        if (isIpAddress(value)) {
            return false;
        }
        return true;
    };

    const ARN_DELIMITER = ":";
    const RESOURCE_DELIMITER = "/";
    const parseArn = (value) => {
        const segments = value.split(ARN_DELIMITER);
        if (segments.length < 6)
            return null;
        const [arn, partition, service, region, accountId, ...resourcePath] = segments;
        if (arn !== "arn" || partition === "" || service === "" || resourcePath.join(ARN_DELIMITER) === "")
            return null;
        const resourceId = resourcePath.map((resource) => resource.split(RESOURCE_DELIMITER)).flat();
        return {
            partition,
            service,
            region,
            accountId,
            resourceId,
        };
    };

    const awsEndpointFunctions = {
        isVirtualHostableS3Bucket: isVirtualHostableS3Bucket,
        parseArn: parseArn,
        partition: partition,
    };
    customEndpointFunctions.aws = awsEndpointFunctions;

    const memoize = (provider, isExpired, requiresRefresh) => {
        let resolved;
        let pending;
        let hasResult;
        let isConstant = false;
        const coalesceProvider = async () => {
            if (!pending) {
                pending = provider();
            }
            try {
                resolved = await pending;
                hasResult = true;
                isConstant = false;
            }
            finally {
                pending = undefined;
            }
            return resolved;
        };
        {
            return async (options) => {
                if (!hasResult || options?.forceRefresh) {
                    resolved = await coalesceProvider();
                }
                return resolved;
            };
        }
    };

    const validRegions = new Set();
    const checkRegion = (region, check = isValidHostLabel) => {
        if (!validRegions.has(region) && !check(region)) {
            if (region === "*") {
                console.warn(`@smithy/config-resolver WARN - Please use the caller region instead of "*". See "sigv4a" in https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/CLIENTS.md.`);
            }
            else {
                throw new Error(`Region not accepted: region="${region}" is not a valid hostname component.`);
            }
        }
        else {
            validRegions.add(region);
        }
    };

    const isFipsRegion = (region) => typeof region === "string" && (region.startsWith("fips-") || region.endsWith("-fips"));

    const getRealRegion = (region) => isFipsRegion(region)
        ? ["fips-aws-global", "aws-fips"].includes(region)
            ? "us-east-1"
            : region.replace(/fips-(dkr-|prod-)?|-fips/, "")
        : region;

    const resolveRegionConfig = (input) => {
        const { region, useFipsEndpoint } = input;
        if (!region) {
            throw new Error("Region is missing");
        }
        return Object.assign(input, {
            region: async () => {
                const providedRegion = typeof region === "function" ? await region() : region;
                const realRegion = getRealRegion(providedRegion);
                checkRegion(realRegion);
                return realRegion;
            },
            useFipsEndpoint: async () => {
                const providedRegion = typeof region === "string" ? region : await region();
                if (isFipsRegion(providedRegion)) {
                    return true;
                }
                return typeof useFipsEndpoint !== "function" ? Promise.resolve(!!useFipsEndpoint) : useFipsEndpoint();
            },
        });
    };

    const DEFAULTS_MODE_OPTIONS = ["in-region", "cross-region", "mobile", "standard", "legacy"];

    const resolveDefaultsModeConfig = ({ defaultsMode, } = {}) => memoize(async () => {
        const mode = typeof defaultsMode === "function" ? await defaultsMode() : defaultsMode;
        switch (mode?.toLowerCase()) {
            case "auto":
                return Promise.resolve(useMobileConfiguration() ? "mobile" : "standard");
            case "mobile":
            case "in-region":
            case "cross-region":
            case "standard":
            case "legacy":
                return Promise.resolve(mode?.toLocaleLowerCase());
            case undefined:
                return Promise.resolve("legacy");
            default:
                throw new Error(`Invalid parameter for "defaultsMode", expect ${DEFAULTS_MODE_OPTIONS.join(", ")}, got ${mode}`);
        }
    });
    const useMobileConfiguration = () => {
        const navigator = window?.navigator;
        if (navigator?.connection) {
            const { effectiveType, rtt, downlink } = navigator.connection;
            const slow = (typeof effectiveType === "string" && effectiveType !== "4g") || Number(rtt) > 100 || Number(downlink) < 10;
            if (slow) {
                return true;
            }
        }
        return (navigator?.userAgentData?.mobile || (typeof navigator?.maxTouchPoints === "number" && navigator?.maxTouchPoints > 1));
    };

    const DEFAULT_USE_DUALSTACK_ENDPOINT = false;
    const DEFAULT_USE_FIPS_ENDPOINT = false;

    const getAwsRegionExtensionConfiguration = (runtimeConfig) => {
        return {
            setRegion(region) {
                runtimeConfig.region = region;
            },
            region() {
                return runtimeConfig.region;
            },
        };
    };
    const resolveAwsRegionExtensionConfiguration = (awsRegionExtensionConfiguration) => {
        return {
            region: awsRegionExtensionConfiguration.region(),
        };
    };

    function resolveEventStreamConfig(input) {
        const eventSigner = input.signer;
        const messageSigner = input.signer;
        const newInput = Object.assign(input, {
            eventSigner,
            messageSigner,
        });
        const eventStreamPayloadHandler = newInput.eventStreamPayloadHandlerProvider(newInput);
        return Object.assign(newInput, {
            eventStreamPayloadHandler,
        });
    }

    const eventStreamHandlingMiddleware = (options) => (next, context) => async (args) => {
        const { request } = args;
        if (!HttpRequest.isInstance(request))
            return next(args);
        return options.eventStreamPayloadHandler.handle(next, args, context);
    };
    const eventStreamHandlingMiddlewareOptions = {
        tags: ["EVENT_STREAM", "SIGNATURE", "HANDLE"],
        name: "eventStreamHandlingMiddleware",
        relation: "after",
        toMiddleware: "awsAuthMiddleware",
        override: true,
    };

    const eventStreamHeaderMiddleware = (next) => async (args) => {
        const { request } = args;
        if (!HttpRequest.isInstance(request))
            return next(args);
        request.headers = {
            ...request.headers,
            "content-type": "application/vnd.amazon.eventstream",
            "x-amz-content-sha256": "STREAMING-AWS4-HMAC-SHA256-EVENTS",
        };
        return next({
            ...args,
            request,
        });
    };
    const eventStreamHeaderMiddlewareOptions = {
        step: "build",
        tags: ["EVENT_STREAM", "HEADER", "CONTENT_TYPE", "CONTENT_SHA256"],
        name: "eventStreamHeaderMiddleware",
        override: true,
    };

    const getEventStreamPlugin = (options) => ({
        applyToStack: (clientStack) => {
            clientStack.addRelativeTo(eventStreamHandlingMiddleware(options), eventStreamHandlingMiddlewareOptions);
            clientStack.add(eventStreamHeaderMiddleware, eventStreamHeaderMiddlewareOptions);
        },
    });

    function formatUrl(request) {
        const { port, query } = request;
        let { protocol, path, hostname } = request;
        if (protocol && protocol.slice(-1) !== ":") {
            protocol += ":";
        }
        if (port) {
            hostname += `:${port}`;
        }
        if (path && path.charAt(0) !== "/") {
            path = `/${path}`;
        }
        let queryString = query ? buildQueryString(query) : "";
        if (queryString && queryString[0] !== "?") {
            queryString = `?${queryString}`;
        }
        let auth = "";
        if (request.username != null || request.password != null) {
            const username = request.username ?? "";
            const password = request.password ?? "";
            auth = `${username}:${password}@`;
        }
        let fragment = "";
        if (request.fragment) {
            fragment = `#${request.fragment}`;
        }
        return `${protocol}//${auth}${hostname}${path}${queryString}${fragment}`;
    }

    const CRC32_TABLE = new Uint32Array(256);
    for (let i = 0; i < 256; ++i) {
        let c = i;
        for (let j = 0; j < 8; ++j) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        CRC32_TABLE[i] = c >>> 0;
    }
    const ONES = 0xffff_ffff;
    class Crc32Js {
        digestLength = 4;
        checksum = ONES;
        update(data) {
            for (let i = 0; i < data.length; ++i) {
                this.checksum = (this.checksum >>> 8) ^ CRC32_TABLE[(this.checksum ^ data[i]) & 0xff];
            }
        }
        digestSync() {
            return (this.checksum ^ ONES) >>> 0;
        }
        async digest() {
            const value = this.digestSync();
            const out = new Uint8Array(4);
            new DataView(out.buffer).setUint32(0, value, false);
            return out;
        }
        reset() {
            this.checksum = ONES;
        }
    }

    const BLOCK = 64;
    const DIGEST_LENGTH = 32;
    const MAX_HASHABLE_LENGTH = 2 ** 53 - 1;
    class Sha256Js {
        digestLength = DIGEST_LENGTH;
        state = Int32Array.from(INIT);
        w;
        buffer = new Uint8Array(64);
        bufferLength = 0;
        bytesHashed = 0;
        finished = false;
        inner;
        outer;
        constructor(secret) {
            if (secret) {
                const key = Sha256Js.normalizeKey(secret);
                this.inner = new Sha256Js();
                this.outer = new Sha256Js();
                const { inner, outer } = this;
                const pad = new Uint8Array(BLOCK * 2);
                for (let i = 0; i < BLOCK; ++i) {
                    pad[i] = 0x36 ^ key[i];
                    pad[i + BLOCK] = 0x5c ^ key[i];
                }
                inner.update(pad.subarray(0, BLOCK));
                outer.update(pad.subarray(BLOCK));
            }
        }
        update(data) {
            if (this.finished) {
                throw new Error("Attempted to update an already finished HMAC.");
            }
            if (this.inner) {
                this.inner.update(data);
                return;
            }
            const chunk = toUint8Array(data);
            let position = 0;
            let { byteLength } = chunk;
            this.bytesHashed += byteLength;
            if (this.bytesHashed * 8 > MAX_HASHABLE_LENGTH) {
                throw new Error("Cannot hash more than 2^53 - 1 bits");
            }
            while (byteLength > 0) {
                this.buffer[this.bufferLength++] = chunk[position++];
                byteLength--;
                if (this.bufferLength === BLOCK) {
                    this.hashBuffer();
                    this.bufferLength = 0;
                }
            }
        }
        async digest() {
            const { inner, outer } = this;
            if (inner && outer) {
                if (this.finished) {
                    throw new Error("Attempted to digest an already finished HMAC.");
                }
                this.finished = true;
                const innerDigest = inner.digestSync();
                outer.update(innerDigest);
                return outer.digestSync();
            }
            return this.digestSync();
        }
        reset() {
            this.state = Int32Array.from(INIT);
            this.buffer = new Uint8Array(64);
            this.bufferLength = 0;
            this.bytesHashed = 0;
        }
        digestSync() {
            const state = this.state.slice();
            const buffer = this.buffer.slice();
            let bufferLength = this.bufferLength;
            const bitsHashed = this.bytesHashed * 8;
            const bufferView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            bufferView.setUint8(bufferLength++, 0x80);
            if ((bufferLength - 1) % BLOCK >= BLOCK - 8) {
                for (let i = bufferLength; i < BLOCK; ++i) {
                    bufferView.setUint8(i, 0);
                }
                this.hashBufferWith(state, buffer);
                bufferLength = 0;
            }
            for (let i = bufferLength; i < BLOCK - 8; ++i) {
                bufferView.setUint8(i, 0);
            }
            bufferView.setUint32(BLOCK - 8, Math.floor(bitsHashed / 0x100000000), false);
            bufferView.setUint32(BLOCK - 4, bitsHashed, false);
            this.hashBufferWith(state, buffer);
            const out = new Uint8Array(DIGEST_LENGTH);
            for (let i = 0; i < 8; ++i) {
                out[i * 4] = (state[i] >>> 24) & 0xff;
                out[i * 4 + 1] = (state[i] >>> 16) & 0xff;
                out[i * 4 + 2] = (state[i] >>> 8) & 0xff;
                out[i * 4 + 3] = (state[i] >>> 0) & 0xff;
            }
            return out;
        }
        static normalizeKey(secret) {
            const key = toUint8Array(secret);
            if (key.byteLength > BLOCK) {
                const h = new Sha256Js();
                h.update(key);
                const out = h.digestSync();
                const padded = new Uint8Array(BLOCK);
                padded.set(out);
                return padded;
            }
            if (key.byteLength < BLOCK) {
                const padded = new Uint8Array(BLOCK);
                padded.set(key);
                return padded;
            }
            return key;
        }
        hashBuffer() {
            this.hashBufferWith(this.state, this.buffer);
        }
        hashBufferWith(state, buffer) {
            const w = (this.w ??= new Int32Array(64));
            let s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3], s4 = state[4], s5 = state[5], s6 = state[6], s7 = state[7];
            for (let i = 0; i < BLOCK; ++i) {
                if (i < 16) {
                    w[i] =
                        ((buffer[i * 4] & 0xff) << 24) |
                            ((buffer[i * 4 + 1] & 0xff) << 16) |
                            ((buffer[i * 4 + 2] & 0xff) << 8) |
                            (buffer[i * 4 + 3] & 0xff);
                }
                else {
                    let u = w[i - 2];
                    const t1 = ((u >>> 17) | (u << 15)) ^ ((u >>> 19) | (u << 13)) ^ (u >>> 10);
                    u = w[i - 15];
                    const t2 = ((u >>> 7) | (u << 25)) ^ ((u >>> 18) | (u << 14)) ^ (u >>> 3);
                    w[i] = ((t1 + w[i - 7]) | 0) + ((t2 + w[i - 16]) | 0);
                }
                const t1 = ((((((s4 >>> 6) | (s4 << 26)) ^ ((s4 >>> 11) | (s4 << 21)) ^ ((s4 >>> 25) | (s4 << 7))) +
                    ((s4 & s5) ^ (~s4 & s6))) |
                    0) +
                    ((s7 + ((K[i] + w[i]) | 0)) | 0)) |
                    0;
                const t2 = ((((s0 >>> 2) | (s0 << 30)) ^ ((s0 >>> 13) | (s0 << 19)) ^ ((s0 >>> 22) | (s0 << 10))) +
                    ((s0 & s1) ^ (s0 & s2) ^ (s1 & s2))) |
                    0;
                s7 = s6;
                s6 = s5;
                s5 = s4;
                s4 = (s3 + t1) | 0;
                s3 = s2;
                s2 = s1;
                s1 = s0;
                s0 = (t1 + t2) | 0;
            }
            state[0] += s0;
            state[1] += s1;
            state[2] += s2;
            state[3] += s3;
            state[4] += s4;
            state[5] += s5;
            state[6] += s6;
            state[7] += s7;
        }
    }
    const INIT = new Int32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const K = new Int32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]);

    const { digest, sign, importKey } = globalThis?.crypto?.subtle ?? {};
    const subtle = typeof digest === "function" && typeof sign === "function" && typeof importKey === "function"
        ? globalThis.crypto.subtle
        : undefined;
    const MAX_PENDING_BYTES = 8 * 1024 * 1024;
    class Sha256WebCrypto {
        digestLength = 32;
        secret;
        pending = [];
        pendingBytes = 0;
        fallback;
        finished = false;
        constructor(secret) {
            if (secret) {
                this.secret = toUint8Array(secret);
            }
        }
        update(data) {
            if (this.finished) {
                throw new Error("Attempted to update an already finished HMAC.");
            }
            if (this.fallback) {
                this.fallback.update(data);
                return;
            }
            this.pending.push(data.slice());
            this.pendingBytes += data.byteLength;
            if (this.pendingBytes >= MAX_PENDING_BYTES) {
                this.switchToFallback();
            }
        }
        async digest() {
            if (this.fallback) {
                return this.fallback.digest();
            }
            if (this.secret && this.finished) {
                throw new Error("Attempted to digest an already finished HMAC.");
            }
            const data = concatBytes(this.pending);
            if (subtle) {
                if (this.secret) {
                    this.finished = true;
                    const key = await subtle.importKey("raw", this.secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
                    const sig = await subtle.sign("HMAC", key, data);
                    return new Uint8Array(sig);
                }
                const hash = await subtle.digest("SHA-256", data);
                return new Uint8Array(hash);
            }
            const sha256 = new Sha256Js(this.secret);
            sha256.update(data);
            return sha256.digest();
        }
        reset() {
            this.pending = [];
            this.pendingBytes = 0;
            this.fallback = undefined;
            this.finished = false;
        }
        switchToFallback() {
            const sha256Js = new Sha256Js(this.secret);
            for (const chunk of this.pending) {
                sha256Js.update(chunk);
            }
            this.fallback = sha256Js;
            this.pending = [];
            this.pendingBytes = 0;
        }
    }

    let Int64$1 = class Int64 {
        bytes;
        constructor(bytes) {
            this.bytes = bytes;
            if (bytes.byteLength !== 8) {
                throw new Error("Int64 buffers must be exactly 8 bytes");
            }
        }
        static fromNumber(number) {
            if (number > 9_223_372_036_854_775_807 || number < -9223372036854776e3) {
                throw new Error(`${number} is too large (or, if negative, too small) to represent as an Int64`);
            }
            const bytes = new Uint8Array(8);
            for (let i = 7, remaining = Math.abs(Math.round(number)); i > -1 && remaining > 0; i--, remaining /= 256) {
                bytes[i] = remaining;
            }
            if (number < 0) {
                negate$1(bytes);
            }
            return new Int64(bytes);
        }
        valueOf() {
            const bytes = this.bytes.slice(0);
            const negative = bytes[0] & 0b10000000;
            if (negative) {
                negate$1(bytes);
            }
            return parseInt(toHex(bytes), 16) * (negative ? -1 : 1);
        }
        toString() {
            return String(this.valueOf());
        }
    };
    function negate$1(bytes) {
        for (let i = 0; i < 8; i++) {
            bytes[i] ^= 0xff;
        }
        for (let i = 7; i > -1; i--) {
            bytes[i]++;
            if (bytes[i] !== 0)
                break;
        }
    }

    class HeaderMarshaller {
        toUtf8;
        fromUtf8;
        constructor(toUtf8, fromUtf8) {
            this.toUtf8 = toUtf8;
            this.fromUtf8 = fromUtf8;
        }
        format(headers) {
            const chunks = [];
            for (const headerName in headers) {
                if (!hasOwn(headers, headerName))
                    continue;
                const bytes = this.fromUtf8(headerName);
                chunks.push(Uint8Array.from([bytes.byteLength]), bytes, this.formatHeaderValue(headers[headerName]));
            }
            const out = new Uint8Array(chunks.reduce((carry, bytes) => carry + bytes.byteLength, 0));
            let position = 0;
            for (const chunk of chunks) {
                out.set(chunk, position);
                position += chunk.byteLength;
            }
            return out;
        }
        formatHeaderValue(header) {
            switch (header.type) {
                case "boolean":
                    return Uint8Array.from([header.value ? 0 : 1]);
                case "byte":
                    return Uint8Array.from([2, header.value]);
                case "short":
                    const shortView = new DataView(new ArrayBuffer(3));
                    shortView.setUint8(0, 3);
                    shortView.setInt16(1, header.value, false);
                    return new Uint8Array(shortView.buffer);
                case "integer":
                    const intView = new DataView(new ArrayBuffer(5));
                    intView.setUint8(0, 4);
                    intView.setInt32(1, header.value, false);
                    return new Uint8Array(intView.buffer);
                case "long":
                    const longBytes = new Uint8Array(9);
                    longBytes[0] = 5;
                    longBytes.set(header.value.bytes, 1);
                    return longBytes;
                case "binary":
                    const binView = new DataView(new ArrayBuffer(3 + header.value.byteLength));
                    binView.setUint8(0, 6);
                    binView.setUint16(1, header.value.byteLength, false);
                    const binBytes = new Uint8Array(binView.buffer);
                    binBytes.set(header.value, 3);
                    return binBytes;
                case "string":
                    const utf8Bytes = this.fromUtf8(header.value);
                    const strView = new DataView(new ArrayBuffer(3 + utf8Bytes.byteLength));
                    strView.setUint8(0, 7);
                    strView.setUint16(1, utf8Bytes.byteLength, false);
                    const strBytes = new Uint8Array(strView.buffer);
                    strBytes.set(utf8Bytes, 3);
                    return strBytes;
                case "timestamp":
                    const tsBytes = new Uint8Array(9);
                    tsBytes[0] = 8;
                    tsBytes.set(Int64$1.fromNumber(header.value.valueOf()).bytes, 1);
                    return tsBytes;
                case "uuid":
                    if (!UUID_PATTERN$1.test(header.value)) {
                        throw new Error(`Invalid UUID received: ${header.value}`);
                    }
                    const uuidBytes = new Uint8Array(17);
                    uuidBytes[0] = 9;
                    uuidBytes.set(fromHex(header.value.replace(/-/g, "")), 1);
                    return uuidBytes;
            }
        }
        parse(headers) {
            const out = {};
            let position = 0;
            while (position < headers.byteLength) {
                const nameLength = headers.getUint8(position++);
                const name = this.toUtf8(new Uint8Array(headers.buffer, headers.byteOffset + position, nameLength));
                position += nameLength;
                switch (headers.getUint8(position++)) {
                    case 0:
                        out[name] = {
                            type: BOOLEAN_TAG,
                            value: true,
                        };
                        break;
                    case 1:
                        out[name] = {
                            type: BOOLEAN_TAG,
                            value: false,
                        };
                        break;
                    case 2:
                        out[name] = {
                            type: BYTE_TAG,
                            value: headers.getInt8(position++),
                        };
                        break;
                    case 3:
                        out[name] = {
                            type: SHORT_TAG,
                            value: headers.getInt16(position, false),
                        };
                        position += 2;
                        break;
                    case 4:
                        out[name] = {
                            type: INT_TAG,
                            value: headers.getInt32(position, false),
                        };
                        position += 4;
                        break;
                    case 5:
                        out[name] = {
                            type: LONG_TAG,
                            value: new Int64$1(new Uint8Array(headers.buffer, headers.byteOffset + position, 8)),
                        };
                        position += 8;
                        break;
                    case 6:
                        const binaryLength = headers.getUint16(position, false);
                        position += 2;
                        out[name] = {
                            type: BINARY_TAG,
                            value: new Uint8Array(headers.buffer, headers.byteOffset + position, binaryLength),
                        };
                        position += binaryLength;
                        break;
                    case 7:
                        const stringLength = headers.getUint16(position, false);
                        position += 2;
                        out[name] = {
                            type: STRING_TAG,
                            value: this.toUtf8(new Uint8Array(headers.buffer, headers.byteOffset + position, stringLength)),
                        };
                        position += stringLength;
                        break;
                    case 8:
                        out[name] = {
                            type: TIMESTAMP_TAG,
                            value: new Date(new Int64$1(new Uint8Array(headers.buffer, headers.byteOffset + position, 8)).valueOf()),
                        };
                        position += 8;
                        break;
                    case 9:
                        const uuidBytes = new Uint8Array(headers.buffer, headers.byteOffset + position, 16);
                        position += 16;
                        out[name] = {
                            type: UUID_TAG,
                            value: `${toHex(uuidBytes.subarray(0, 4))}-${toHex(uuidBytes.subarray(4, 6))}-${toHex(uuidBytes.subarray(6, 8))}-${toHex(uuidBytes.subarray(8, 10))}-${toHex(uuidBytes.subarray(10))}`,
                        };
                        break;
                    default:
                        throw new Error(`Unrecognized header type tag`);
                }
            }
            return out;
        }
    }
    var HEADER_VALUE_TYPE$1;
    (function (HEADER_VALUE_TYPE) {
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["boolTrue"] = 0] = "boolTrue";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["boolFalse"] = 1] = "boolFalse";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["byte"] = 2] = "byte";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["short"] = 3] = "short";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["integer"] = 4] = "integer";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["long"] = 5] = "long";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["byteArray"] = 6] = "byteArray";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["string"] = 7] = "string";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["timestamp"] = 8] = "timestamp";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["uuid"] = 9] = "uuid";
    })(HEADER_VALUE_TYPE$1 || (HEADER_VALUE_TYPE$1 = {}));
    const BOOLEAN_TAG = "boolean";
    const BYTE_TAG = "byte";
    const SHORT_TAG = "short";
    const INT_TAG = "integer";
    const LONG_TAG = "long";
    const BINARY_TAG = "binary";
    const STRING_TAG = "string";
    const TIMESTAMP_TAG = "timestamp";
    const UUID_TAG = "uuid";
    const UUID_PATTERN$1 = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

    const PRELUDE_MEMBER_LENGTH = 4;
    const PRELUDE_LENGTH = PRELUDE_MEMBER_LENGTH * 2;
    const CHECKSUM_LENGTH = 4;
    const MINIMUM_MESSAGE_LENGTH = PRELUDE_LENGTH + CHECKSUM_LENGTH * 2;
    function splitMessage({ byteLength, byteOffset, buffer }) {
        if (byteLength < MINIMUM_MESSAGE_LENGTH) {
            throw new Error("Provided message too short to accommodate event stream message overhead");
        }
        const view = new DataView(buffer, byteOffset, byteLength);
        const messageLength = view.getUint32(0, false);
        if (byteLength !== messageLength) {
            throw new Error("Reported message length does not match received message length");
        }
        const headerLength = view.getUint32(PRELUDE_MEMBER_LENGTH, false);
        const expectedPreludeChecksum = view.getUint32(PRELUDE_LENGTH, false);
        const expectedMessageChecksum = view.getUint32(byteLength - CHECKSUM_LENGTH, false);
        const checksummer = new Crc32Js();
        checksummer.update(new Uint8Array(buffer, byteOffset, PRELUDE_LENGTH));
        if (expectedPreludeChecksum !== checksummer.digestSync()) {
            throw new Error(`The prelude checksum specified in the message (${expectedPreludeChecksum}) does not match the calculated CRC32 checksum (${checksummer.digestSync()})`);
        }
        checksummer.update(new Uint8Array(buffer, byteOffset + PRELUDE_LENGTH, byteLength - (PRELUDE_LENGTH + CHECKSUM_LENGTH)));
        if (expectedMessageChecksum !== checksummer.digestSync()) {
            throw new Error(`The message checksum (${checksummer.digestSync()}) did not match the expected value of ${expectedMessageChecksum}`);
        }
        return {
            headers: new DataView(buffer, byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH, headerLength),
            body: new Uint8Array(buffer, byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH + headerLength, messageLength - headerLength - (PRELUDE_LENGTH + CHECKSUM_LENGTH + CHECKSUM_LENGTH)),
        };
    }

    class EventStreamCodec {
        headerMarshaller;
        messageBuffer;
        isEndOfStream;
        constructor(toUtf8, fromUtf8) {
            this.headerMarshaller = new HeaderMarshaller(toUtf8, fromUtf8);
            this.messageBuffer = [];
            this.isEndOfStream = false;
        }
        feed(message) {
            this.messageBuffer.push(this.decode(message));
        }
        endOfStream() {
            this.isEndOfStream = true;
        }
        getMessage() {
            const message = this.messageBuffer.pop();
            const isEndOfStream = this.isEndOfStream;
            return {
                getMessage() {
                    return message;
                },
                isEndOfStream() {
                    return isEndOfStream;
                },
            };
        }
        getAvailableMessages() {
            const messages = this.messageBuffer;
            this.messageBuffer = [];
            const isEndOfStream = this.isEndOfStream;
            return {
                getMessages() {
                    return messages;
                },
                isEndOfStream() {
                    return isEndOfStream;
                },
            };
        }
        encode({ headers: rawHeaders, body }) {
            const headers = this.headerMarshaller.format(rawHeaders);
            const length = headers.byteLength + body.byteLength + 16;
            const out = new Uint8Array(length);
            const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
            const checksum = new Crc32Js();
            view.setUint32(0, length, false);
            view.setUint32(4, headers.byteLength, false);
            checksum.update(out.subarray(0, 8));
            view.setUint32(8, checksum.digestSync(), false);
            out.set(headers, 12);
            out.set(body, headers.byteLength + 12);
            checksum.update(out.subarray(8, length - 4));
            view.setUint32(length - 4, checksum.digestSync(), false);
            return out;
        }
        decode(message) {
            const { headers, body } = splitMessage(message);
            return { headers: this.headerMarshaller.parse(headers), body };
        }
        formatHeaders(rawHeaders) {
            return this.headerMarshaller.format(rawHeaders);
        }
    }

    class MessageDecoderStream {
        options;
        constructor(options) {
            this.options = options;
        }
        [Symbol.asyncIterator]() {
            return this.asyncIterator();
        }
        async *asyncIterator() {
            for await (const bytes of this.options.inputStream) {
                const decoded = this.options.decoder.decode(bytes);
                yield decoded;
            }
        }
    }

    class MessageEncoderStream {
        options;
        constructor(options) {
            this.options = options;
        }
        [Symbol.asyncIterator]() {
            return this.asyncIterator();
        }
        async *asyncIterator() {
            for await (const msg of this.options.messageStream) {
                const encoded = this.options.encoder.encode(msg);
                yield encoded;
            }
            if (this.options.includeEndFrame) {
                yield new Uint8Array(0);
            }
        }
    }

    class SmithyMessageDecoderStream {
        options;
        constructor(options) {
            this.options = options;
        }
        [Symbol.asyncIterator]() {
            return this.asyncIterator();
        }
        async *asyncIterator() {
            for await (const message of this.options.messageStream) {
                const deserialized = await this.options.deserializer(message);
                if (deserialized === undefined)
                    continue;
                yield deserialized;
            }
        }
    }

    class SmithyMessageEncoderStream {
        options;
        constructor(options) {
            this.options = options;
        }
        [Symbol.asyncIterator]() {
            return this.asyncIterator();
        }
        async *asyncIterator() {
            for await (const chunk of this.options.inputStream) {
                const payloadBuf = this.options.serializer(chunk);
                yield payloadBuf;
            }
        }
    }

    function getChunkedStream(source) {
        let currentMessageTotalLength = 0;
        let currentMessagePendingLength = 0;
        let currentMessage = null;
        let messageLengthBuffer = null;
        const allocateMessage = (size) => {
            if (typeof size !== "number") {
                throw new Error("Attempted to allocate an event message where size was not a number: " + size);
            }
            currentMessageTotalLength = size;
            currentMessagePendingLength = 4;
            currentMessage = new Uint8Array(size);
            const currentMessageView = new DataView(currentMessage.buffer);
            currentMessageView.setUint32(0, size, false);
        };
        const iterator = async function* () {
            const sourceIterator = source[Symbol.asyncIterator]();
            while (true) {
                const { value, done } = await sourceIterator.next();
                if (done) {
                    if (!currentMessageTotalLength) {
                        return;
                    }
                    else if (currentMessageTotalLength === currentMessagePendingLength) {
                        yield currentMessage;
                    }
                    else {
                        throw new Error("Truncated event message received.");
                    }
                    return;
                }
                const chunkLength = value.length;
                let currentOffset = 0;
                while (currentOffset < chunkLength) {
                    if (!currentMessage) {
                        const bytesRemaining = chunkLength - currentOffset;
                        if (!messageLengthBuffer) {
                            messageLengthBuffer = new Uint8Array(4);
                        }
                        const numBytesForTotal = Math.min(4 - currentMessagePendingLength, bytesRemaining);
                        messageLengthBuffer.set(value.slice(currentOffset, currentOffset + numBytesForTotal), currentMessagePendingLength);
                        currentMessagePendingLength += numBytesForTotal;
                        currentOffset += numBytesForTotal;
                        if (currentMessagePendingLength < 4) {
                            break;
                        }
                        allocateMessage(new DataView(messageLengthBuffer.buffer).getUint32(0, false));
                        messageLengthBuffer = null;
                    }
                    const numBytesToWrite = Math.min(currentMessageTotalLength - currentMessagePendingLength, chunkLength - currentOffset);
                    currentMessage.set(value.slice(currentOffset, currentOffset + numBytesToWrite), currentMessagePendingLength);
                    currentMessagePendingLength += numBytesToWrite;
                    currentOffset += numBytesToWrite;
                    if (currentMessageTotalLength && currentMessageTotalLength === currentMessagePendingLength) {
                        yield currentMessage;
                        currentMessage = null;
                        currentMessageTotalLength = 0;
                        currentMessagePendingLength = 0;
                    }
                }
            }
        };
        return {
            [Symbol.asyncIterator]: iterator,
        };
    }

    function getMessageUnmarshaller(deserializer, toUtf8) {
        return async function (message) {
            const { value: messageType } = message.headers[":message-type"];
            if (messageType === "error") {
                const unmodeledError = new Error(message.headers[":error-message"].value || "UnknownError");
                unmodeledError.name = message.headers[":error-code"].value;
                throw unmodeledError;
            }
            else if (messageType === "exception") {
                const code = message.headers[":exception-type"].value;
                const exception = { [code]: message };
                const deserializedException = await deserializer(exception);
                if (deserializedException.$unknown) {
                    const error = new Error(toUtf8(message.body));
                    error.name = code;
                    throw error;
                }
                throw deserializedException[code];
            }
            else if (messageType === "event") {
                const event = {
                    [message.headers[":event-type"].value]: message,
                };
                const deserialized = await deserializer(event);
                if (deserialized.$unknown)
                    return;
                return deserialized;
            }
            else {
                throw Error(`Unrecognizable event type: ${message.headers[":event-type"].value}`);
            }
        };
    }

    let EventStreamMarshaller$1 = class EventStreamMarshaller {
        eventStreamCodec;
        utfEncoder;
        constructor({ utf8Encoder, utf8Decoder }) {
            this.eventStreamCodec = new EventStreamCodec(utf8Encoder, utf8Decoder);
            this.utfEncoder = utf8Encoder;
        }
        deserialize(body, deserializer) {
            const inputStream = getChunkedStream(body);
            return new SmithyMessageDecoderStream({
                messageStream: new MessageDecoderStream({ inputStream, decoder: this.eventStreamCodec }),
                deserializer: getMessageUnmarshaller(deserializer, this.utfEncoder),
            });
        }
        serialize(inputStream, serializer) {
            return new MessageEncoderStream({
                messageStream: new SmithyMessageEncoderStream({ inputStream, serializer }),
                encoder: this.eventStreamCodec,
                includeEndFrame: true,
            });
        }
    };

    const readableStreamToIterable = (readableStream) => ({
        [Symbol.asyncIterator]: async function* () {
            const reader = readableStream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        return;
                    yield value;
                }
            }
            finally {
                reader.releaseLock();
            }
        },
    });
    const iterableToReadableStream = (asyncIterable) => {
        const iterator = asyncIterable[Symbol.asyncIterator]();
        return new ReadableStream({
            async pull(controller) {
                const { done, value } = await iterator.next();
                if (done) {
                    return controller.close();
                }
                controller.enqueue(value);
            },
        });
    };

    class EventStreamMarshaller {
        universalMarshaller;
        constructor({ utf8Encoder, utf8Decoder }) {
            this.universalMarshaller = new EventStreamMarshaller$1({
                utf8Decoder,
                utf8Encoder,
            });
        }
        deserialize(body, deserializer) {
            const bodyIterable = isReadableStream$1(body) ? readableStreamToIterable(body) : body;
            return this.universalMarshaller.deserialize(bodyIterable, deserializer);
        }
        serialize(input, serializer) {
            const serializedIterable = this.universalMarshaller.serialize(input, serializer);
            return typeof ReadableStream === "function" ? iterableToReadableStream(serializedIterable) : serializedIterable;
        }
    }
    const isReadableStream$1 = (body) => typeof ReadableStream === "function" && body instanceof ReadableStream;
    const eventStreamSerdeProvider = (options) => new EventStreamMarshaller(options);

    const resolveEventStreamSerdeConfig = (input) => Object.assign(input, {
        eventStreamMarshaller: input.eventStreamSerdeProvider(input),
    });

    class EventStreamSerde {
        marshaller;
        serializer;
        deserializer;
        serdeContext;
        defaultContentType;
        compositeErrorRegistry;
        constructor({ marshaller, serializer, deserializer, serdeContext, defaultContentType, compositeErrorRegistry, }) {
            this.marshaller = marshaller;
            this.serializer = serializer;
            this.deserializer = deserializer;
            this.serdeContext = serdeContext;
            this.defaultContentType = defaultContentType;
            this.compositeErrorRegistry = compositeErrorRegistry;
        }
        async serializeEventStream({ eventStream, requestSchema, initialRequest, initialMessageType, }) {
            const marshaller = this.marshaller;
            const eventStreamMember = requestSchema.getEventStreamMember();
            const unionSchema = requestSchema.getMemberSchema(eventStreamMember);
            const serializer = this.serializer;
            const defaultContentType = this.defaultContentType;
            const initialRequestMarker = Symbol("initialRequestMarker");
            const eventStreamIterable = {
                async *[Symbol.asyncIterator]() {
                    if (initialRequest) {
                        const headers = {
                            ":event-type": { type: "string", value: initialMessageType ?? "initial-request" },
                            ":message-type": { type: "string", value: "event" },
                            ":content-type": { type: "string", value: defaultContentType },
                        };
                        serializer.write(requestSchema, initialRequest);
                        const body = serializer.flush();
                        yield {
                            [initialRequestMarker]: true,
                            headers,
                            body,
                        };
                    }
                    for await (const page of eventStream) {
                        yield page;
                    }
                },
            };
            return marshaller.serialize(eventStreamIterable, (event) => {
                if (event[initialRequestMarker]) {
                    return {
                        headers: event.headers,
                        body: event.body,
                    };
                }
                let unionMember = "";
                for (const key in event) {
                    if (!hasOwn(event, key))
                        continue;
                    if (key !== "__type") {
                        unionMember = key;
                        break;
                    }
                }
                const { additionalHeaders, body, eventType, explicitPayloadContentType } = this.writeEventBody(unionMember, unionSchema, event);
                const headers = {
                    ":event-type": { type: "string", value: eventType },
                    ":message-type": { type: "string", value: "event" },
                    ":content-type": { type: "string", value: explicitPayloadContentType ?? defaultContentType },
                    ...additionalHeaders,
                };
                return {
                    headers,
                    body,
                };
            });
        }
        async deserializeEventStream({ response, responseSchema, initialResponseContainer, initialMessageType, }) {
            const marshaller = this.marshaller;
            const eventStreamMember = responseSchema.getEventStreamMember();
            const unionSchema = responseSchema.getMemberSchema(eventStreamMember);
            const memberSchemas = unionSchema.getMemberSchemas();
            const initialResponseMarker = Symbol("initialResponseMarker");
            const asyncIterable = marshaller.deserialize(response.body, async (event) => {
                let unionMember = "";
                for (const key in event) {
                    if (!hasOwn(event, key))
                        continue;
                    if (key !== "__type") {
                        unionMember = key;
                        break;
                    }
                }
                const body = event[unionMember].body;
                if (unionMember === (initialMessageType ?? "initial-response")) {
                    const dataObject = await this.deserializer.read(responseSchema, body);
                    delete dataObject[eventStreamMember];
                    return {
                        [initialResponseMarker]: true,
                        ...dataObject,
                    };
                }
                else if (unionMember in memberSchemas) {
                    const eventStreamSchema = memberSchemas[unionMember];
                    if (eventStreamSchema.isStructSchema()) {
                        const out = {};
                        let hasBindings = false;
                        for (const [name, member] of eventStreamSchema.structIterator()) {
                            const { eventHeader, eventPayload } = member.getMergedTraits();
                            hasBindings = hasBindings || Boolean(eventHeader || eventPayload);
                            if (eventPayload) {
                                if (member.isBlobSchema()) {
                                    out[name] = body;
                                }
                                else if (member.isStringSchema()) {
                                    out[name] = (this.serdeContext?.utf8Encoder ?? toUtf8)(body);
                                }
                                else if (member.isStructSchema()) {
                                    out[name] = await this.deserializer.read(member, body);
                                }
                            }
                            else if (eventHeader) {
                                const value = event[unionMember].headers[name]?.value;
                                if (value != null) {
                                    if (member.isNumericSchema()) {
                                        if (value && typeof value === "object" && "bytes" in value) {
                                            out[name] = BigInt(value.toString());
                                        }
                                        else {
                                            out[name] = Number(value);
                                        }
                                    }
                                    else {
                                        out[name] = value;
                                    }
                                }
                            }
                        }
                        return {
                            [unionMember]: await this.readEventMember(eventStreamSchema, body, hasBindings, out),
                        };
                    }
                    return {
                        [unionMember]: await this.deserializer.read(eventStreamSchema, body),
                    };
                }
                else {
                    return {
                        $unknown: event,
                    };
                }
            });
            const asyncIterator = asyncIterable[Symbol.asyncIterator]();
            const firstEvent = await asyncIterator.next();
            if (firstEvent.done) {
                return asyncIterable;
            }
            if (firstEvent.value?.[initialResponseMarker]) {
                if (!responseSchema) {
                    throw new Error("@smithy::core/protocols - initial-response event encountered in event stream but no response schema given.");
                }
                for (const key in firstEvent.value) {
                    if (!hasOwn(firstEvent.value, key))
                        continue;
                    initialResponseContainer[key] = firstEvent.value[key];
                }
            }
            return {
                async *[Symbol.asyncIterator]() {
                    if (!firstEvent?.value?.[initialResponseMarker]) {
                        yield firstEvent.value;
                    }
                    while (true) {
                        const { done, value } = await asyncIterator.next();
                        if (done) {
                            break;
                        }
                        yield value;
                    }
                },
            };
        }
        async readEventMember(eventStreamSchema, body, hasBindings, out) {
            let ErrCtor;
            const staticStructuralSchema = eventStreamSchema.getSchema();
            if (Array.isArray(staticStructuralSchema) && staticStructuralSchema[0] === -3) {
                const namespace = staticStructuralSchema[1];
                const nsRegistry = TypeRegistry.for(namespace);
                this.compositeErrorRegistry?.copyFrom(nsRegistry);
                ErrCtor = (this.compositeErrorRegistry ?? nsRegistry)?.getErrorCtor(staticStructuralSchema);
            }
            const dataObject = hasBindings
                ? out
                : body.byteLength === 0
                    ? {}
                    : await this.deserializer.read(eventStreamSchema, body);
            if (ErrCtor) {
                const message = dataObject.message ?? dataObject.Message ?? "Unknown";
                const metadata = {};
                const $fault = eventStreamSchema.getMergedTraits().error;
                if ($fault) {
                    metadata.$fault = $fault;
                }
                return Object.assign(new ErrCtor({}), metadata, {
                    message,
                }, dataObject);
            }
            return dataObject;
        }
        writeEventBody(unionMember, unionSchema, event) {
            const serializer = this.serializer;
            let eventType = unionMember;
            let explicitPayloadMember = null;
            let explicitPayloadContentType;
            const isKnownSchema = (() => {
                const struct = unionSchema.getSchema();
                return struct[4].includes(unionMember);
            })();
            const additionalHeaders = {};
            if (!isKnownSchema) {
                const [type, value] = event[unionMember];
                eventType = type;
                serializer.write(15, value);
            }
            else {
                const eventSchema = unionSchema.getMemberSchema(unionMember);
                if (eventSchema.isStructSchema()) {
                    for (const [memberName, memberSchema] of eventSchema.structIterator()) {
                        const { eventHeader, eventPayload } = memberSchema.getMergedTraits();
                        if (eventPayload) {
                            explicitPayloadMember = memberName;
                        }
                        else if (eventHeader) {
                            const value = event[unionMember][memberName];
                            let type = "binary";
                            if (memberSchema.isNumericSchema()) {
                                if ((-2) ** 31 <= value && value <= 2 ** 31 - 1) {
                                    type = "integer";
                                }
                                else {
                                    type = "long";
                                }
                            }
                            else if (memberSchema.isTimestampSchema()) {
                                type = "timestamp";
                            }
                            else if (memberSchema.isStringSchema()) {
                                type = "string";
                            }
                            else if (memberSchema.isBooleanSchema()) {
                                type = "boolean";
                            }
                            if (value != null) {
                                additionalHeaders[memberName] = {
                                    type,
                                    value,
                                };
                                delete event[unionMember][memberName];
                            }
                        }
                    }
                    if (explicitPayloadMember !== null) {
                        const payloadSchema = eventSchema.getMemberSchema(explicitPayloadMember);
                        if (payloadSchema.isBlobSchema()) {
                            explicitPayloadContentType = "application/octet-stream";
                        }
                        else if (payloadSchema.isStringSchema()) {
                            explicitPayloadContentType = "text/plain";
                        }
                        serializer.write(payloadSchema, event[unionMember][explicitPayloadMember]);
                    }
                    else {
                        serializer.write(eventSchema, event[unionMember]);
                    }
                }
                else if (eventSchema.isUnitSchema()) {
                    serializer.write(eventSchema, {});
                }
                else {
                    throw new Error("@smithy/core/event-streams - non-struct member not supported in event stream union.");
                }
            }
            const messageSerialization = serializer.flush() ?? new Uint8Array();
            const body = typeof messageSerialization === "string"
                ? (this.serdeContext?.utf8Decoder ?? fromUtf8)(messageSerialization)
                : messageSerialization;
            return {
                body,
                eventType,
                explicitPayloadContentType,
                additionalHeaders,
            };
        }
    }

    var index_browser = /*#__PURE__*/Object.freeze({
        __proto__: null,
        EventStreamCodec: EventStreamCodec,
        EventStreamMarshaller: EventStreamMarshaller,
        EventStreamSerde: EventStreamSerde,
        HeaderMarshaller: HeaderMarshaller,
        Int64: Int64$1,
        MessageDecoderStream: MessageDecoderStream,
        MessageEncoderStream: MessageEncoderStream,
        SmithyMessageDecoderStream: SmithyMessageDecoderStream,
        SmithyMessageEncoderStream: SmithyMessageEncoderStream,
        UniversalEventStreamMarshaller: EventStreamMarshaller$1,
        eventStreamSerdeProvider: eventStreamSerdeProvider,
        getChunkedStream: getChunkedStream,
        getMessageUnmarshaller: getMessageUnmarshaller,
        iterableToReadableStream: iterableToReadableStream,
        readableStreamToIterable: readableStreamToIterable,
        resolveEventStreamSerdeConfig: resolveEventStreamSerdeConfig
    });

    function createRequest(url, requestOptions) {
        return new Request(url, requestOptions);
    }

    function requestTimeout(timeoutInMs = 0) {
        return new Promise((resolve, reject) => {
            if (timeoutInMs) {
                setTimeout(() => {
                    const timeoutError = new Error(`Request did not complete within ${timeoutInMs} ms`);
                    timeoutError.name = "TimeoutError";
                    reject(timeoutError);
                }, timeoutInMs);
            }
        });
    }

    const keepAliveSupport = {
        supported: undefined,
    };
    class FetchHttpHandler {
        config;
        configProvider;
        static create(instanceOrOptions) {
            if (typeof instanceOrOptions?.handle === "function") {
                return instanceOrOptions;
            }
            return new FetchHttpHandler(instanceOrOptions);
        }
        constructor(options) {
            if (typeof options === "function") {
                this.configProvider = options().then((opts) => opts || {});
            }
            else {
                this.config = options ?? {};
                this.configProvider = Promise.resolve(this.config);
            }
            if (keepAliveSupport.supported === undefined) {
                keepAliveSupport.supported = Boolean(typeof Request !== "undefined" && "keepalive" in createRequest("https://[::1]"));
            }
        }
        destroy() {
        }
        async handle(request, { abortSignal, requestTimeout: requestTimeout$1 } = {}) {
            if (!this.config) {
                this.config = await this.configProvider;
            }
            const requestTimeoutInMs = requestTimeout$1 ?? this.config.requestTimeout;
            const keepAlive = this.config.keepAlive === true;
            const credentials = this.config.credentials;
            const fetchFn = this.config.customFetch ?? fetch;
            if (abortSignal?.aborted) {
                const abortError = buildAbortError(abortSignal);
                return Promise.reject(abortError);
            }
            let path = request.path;
            const queryString = buildQueryString(request.query || {});
            if (queryString) {
                path += `?${queryString}`;
            }
            if (request.fragment) {
                path += `#${request.fragment}`;
            }
            let auth = "";
            if (request.username != null || request.password != null) {
                const username = request.username ?? "";
                const password = request.password ?? "";
                auth = `${username}:${password}@`;
            }
            const { port, method } = request;
            const url = `${request.protocol}//${auth}${request.hostname}${port ? `:${port}` : ""}${path}`;
            const body = method === "GET" || method === "HEAD" ? undefined : request.body;
            const requestOptions = {
                body,
                headers: new Headers(request.headers),
                method: method,
                credentials,
            };
            if (this.config?.cache) {
                requestOptions.cache = this.config.cache;
            }
            if (body) {
                requestOptions.duplex = "half";
            }
            if (typeof AbortController !== "undefined") {
                requestOptions.signal = abortSignal;
            }
            if (keepAliveSupport.supported) {
                requestOptions.keepalive = keepAlive;
            }
            if (typeof this.config.requestInit === "function") {
                Object.assign(requestOptions, this.config.requestInit(request));
            }
            let removeSignalEventListener = () => { };
            const fetchRequest = createRequest(url, requestOptions);
            const raceOfPromises = [
                fetchFn(fetchRequest).then((response) => {
                    const fetchHeaders = response.headers;
                    const transformedHeaders = {};
                    for (const pair of fetchHeaders.entries()) {
                        transformedHeaders[pair[0]] = pair[1];
                    }
                    const hasReadableStream = response.body != undefined;
                    if (!hasReadableStream) {
                        return response.blob().then((body) => ({
                            response: new HttpResponse({
                                headers: transformedHeaders,
                                reason: response.statusText,
                                statusCode: response.status,
                                body,
                            }),
                        }));
                    }
                    return {
                        response: new HttpResponse({
                            headers: transformedHeaders,
                            reason: response.statusText,
                            statusCode: response.status,
                            body: response.body,
                        }),
                    };
                }),
                requestTimeout(requestTimeoutInMs),
            ];
            if (abortSignal) {
                raceOfPromises.push(new Promise((resolve, reject) => {
                    const onAbort = () => {
                        const abortError = buildAbortError(abortSignal);
                        reject(abortError);
                    };
                    if (typeof abortSignal.addEventListener === "function") {
                        const signal = abortSignal;
                        signal.addEventListener("abort", onAbort, { once: true });
                        removeSignalEventListener = () => signal.removeEventListener("abort", onAbort);
                    }
                    else {
                        abortSignal.onabort = onAbort;
                    }
                }));
            }
            return Promise.race(raceOfPromises).finally(removeSignalEventListener);
        }
        updateHttpClientConfig(key, value) {
            this.config = undefined;
            this.configProvider = this.configProvider.then((config) => {
                config[key] = value;
                return config;
            });
        }
        httpHandlerConfigs() {
            return this.config ?? {};
        }
    }
    function buildAbortError(abortSignal) {
        const reason = abortSignal && typeof abortSignal === "object" && "reason" in abortSignal
            ? abortSignal.reason
            : undefined;
        if (reason) {
            if (reason instanceof Error) {
                const abortError = new Error("Request aborted");
                abortError.name = "AbortError";
                abortError.cause = reason;
                return abortError;
            }
            const abortError = new Error(String(reason));
            abortError.name = "AbortError";
            return abortError;
        }
        const abortError = new Error("Request aborted");
        abortError.name = "AbortError";
        return abortError;
    }

    const isWebSocketRequest = (request) => request.protocol === "ws:" || request.protocol === "wss:";

    const DEFAULT_WS_CONNECTION_TIMEOUT_MS = 3000;
    class WebSocketFetchHandler {
        metadata = {
            handlerProtocol: "websocket/h1.1",
        };
        config = {};
        configPromise;
        httpHandler;
        sockets = {};
        static create(instanceOrOptions, httpHandler = new FetchHttpHandler()) {
            if (typeof instanceOrOptions?.handle === "function") {
                return instanceOrOptions;
            }
            return new WebSocketFetchHandler(instanceOrOptions, httpHandler);
        }
        constructor(options, httpHandler = new FetchHttpHandler()) {
            this.httpHandler = httpHandler;
            const setConfig = (opts) => {
                this.config = {
                    ...(opts ?? {}),
                };
                return this.config;
            };
            if (typeof options === "function") {
                this.config = {};
                this.configPromise = options().then((opts) => {
                    return setConfig(opts);
                });
            }
            else {
                this.configPromise = Promise.resolve(setConfig(options));
            }
        }
        destroy() {
            for (const [key, sockets] of Object.entries(this.sockets)) {
                for (const socket of sockets) {
                    socket.close(1000, `Socket closed through destroy() call`);
                }
                delete this.sockets[key];
            }
        }
        async handle(request) {
            this.config = await this.configPromise;
            const { logger } = this.config;
            if (!isWebSocketRequest(request)) {
                logger?.debug?.(`@aws-sdk - ws fetching ${request.protocol}${request.hostname}${request.path}`);
                return this.httpHandler.handle(request);
            }
            const url = formatUrl(request);
            logger?.debug?.(`@aws-sdk - ws connecting ${url.split("?")[0]}`);
            const socket = new WebSocket(url);
            if (!this.sockets[url]) {
                this.sockets[url] = [];
            }
            this.sockets[url].push(socket);
            socket.binaryType = "arraybuffer";
            const { connectionTimeout = DEFAULT_WS_CONNECTION_TIMEOUT_MS } = this.config;
            await this.waitForReady(socket, connectionTimeout);
            const { body } = request;
            const bodyStream = getIterator(body);
            const asyncIterable = this.connect(socket, bodyStream);
            const outputPayload = toReadableStream(asyncIterable);
            return {
                response: new HttpResponse({
                    statusCode: 200,
                    body: outputPayload,
                }),
            };
        }
        updateHttpClientConfig(key, value) {
            this.configPromise = this.configPromise.then((config) => {
                config[key] = value;
                return config;
            });
        }
        httpHandlerConfigs() {
            return this.config ?? {};
        }
        removeNotUsableSockets(url) {
            this.sockets[url] = (this.sockets[url] ?? []).filter((socket) => ![WebSocket.CLOSING, WebSocket.CLOSED].includes(socket.readyState));
        }
        waitForReady(socket, connectionTimeout) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.removeNotUsableSockets(socket.url);
                    reject({
                        $metadata: {
                            httpStatusCode: 500,
                            websocketSynthetic500Error: true,
                        },
                    });
                }, connectionTimeout);
                socket.onopen = () => {
                    clearTimeout(timeout);
                    resolve();
                };
            });
        }
        connect(socket, data) {
            const messageQueue = [];
            let pendingResolve = null;
            let pendingReject = null;
            const push = (item) => {
                if (pendingResolve) {
                    if (item.error) {
                        pendingReject(item.error);
                    }
                    else {
                        pendingResolve({ done: item.done, value: item.value });
                    }
                    pendingResolve = null;
                    pendingReject = null;
                }
                else {
                    messageQueue.push(item);
                }
            };
            socket.onmessage = (event) => {
                const { data } = event;
                if (typeof data === "string") {
                    push({
                        done: false,
                        value: fromBase64(data),
                    });
                }
                else {
                    push({
                        done: false,
                        value: new Uint8Array(data),
                    });
                }
            };
            socket.onerror = (event) => {
                socket.close();
                push({ done: true, error: event });
            };
            socket.onclose = () => {
                this.removeNotUsableSockets(socket.url);
                push({ done: true });
            };
            const outputStream = {
                [Symbol.asyncIterator]: () => ({
                    async next() {
                        if (messageQueue.length > 0) {
                            const item = messageQueue.shift();
                            if (item.error) {
                                throw item.error;
                            }
                            return { done: item.done, value: item.value };
                        }
                        return new Promise((resolve, reject) => {
                            pendingResolve = resolve;
                            pendingReject = reject;
                        });
                    },
                }),
            };
            const send = async () => {
                try {
                    for await (const chunk of data) {
                        if (socket.readyState >= WebSocket.CLOSING) {
                            break;
                        }
                        else {
                            socket.send(chunk);
                        }
                    }
                }
                catch (err) {
                    push({
                        done: true,
                        error: err,
                    });
                }
                finally {
                    socket.close(1000);
                }
            };
            send();
            return outputStream;
        }
    }
    const getIterator = (stream) => {
        if (stream[Symbol.asyncIterator]) {
            return stream;
        }
        if (isReadableStream(stream)) {
            return readableStreamToIterable(stream);
        }
        return {
            [Symbol.asyncIterator]: async function* () {
                yield stream;
            },
        };
    };
    const toReadableStream = (asyncIterable) => typeof ReadableStream === "function" ? iterableToReadableStream(asyncIterable) : asyncIterable;
    const isReadableStream = (payload) => typeof ReadableStream === "function" && payload instanceof ReadableStream;

    const websocketEndpointMiddleware = (config, options) => (next) => (args) => {
        const { request } = args;
        if (HttpRequest.isInstance(request) &&
            config.requestHandler.metadata?.handlerProtocol?.toLowerCase().includes("websocket")) {
            request.protocol = "wss:";
            request.method = "GET";
            request.path = `${request.path}-websocket`;
            const { headers } = request;
            delete headers["content-type"];
            delete headers["x-amz-content-sha256"];
            for (const name of Object.keys(headers)) {
                if (name.indexOf(options.headerPrefix) === 0) {
                    const chunkedName = name.replace(options.headerPrefix, "");
                    request.query[chunkedName] = headers[name];
                }
            }
            if (headers["x-amz-user-agent"]) {
                request.query["user-agent"] = headers["x-amz-user-agent"];
            }
            request.headers = { host: headers.host ?? request.hostname };
        }
        return next(args);
    };
    const websocketEndpointMiddlewareOptions = {
        name: "websocketEndpointMiddleware",
        tags: ["WEBSOCKET", "EVENT_STREAM"],
        relation: "after",
        toMiddleware: "eventStreamHeaderMiddleware",
        override: true,
    };

    const injectSessionIdMiddleware = () => (next) => async (args) => {
        const requestParams = {
            ...args.input,
        };
        const response = await next(args);
        const output = response.output;
        if (requestParams.SessionId && output.SessionId == null) {
            output.SessionId = requestParams.SessionId;
        }
        return response;
    };
    const injectSessionIdMiddlewareOptions = {
        step: "initialize",
        name: "injectSessionIdMiddleware",
        tags: ["WEBSOCKET", "EVENT_STREAM"],
        override: true,
    };

    const getWebSocketPlugin = (config, options) => ({
        applyToStack: (clientStack) => {
            clientStack.addRelativeTo(websocketEndpointMiddleware(config, options), websocketEndpointMiddlewareOptions);
            clientStack.add(injectSessionIdMiddleware(), injectSessionIdMiddlewareOptions);
        },
    });

    class WebsocketSignatureV4 {
        signer;
        constructor(options) {
            this.signer = options.signer;
        }
        presign(originalRequest, options = {}) {
            return this.signer.presign(originalRequest, options);
        }
        async sign(toSign, options) {
            if (HttpRequest.isInstance(toSign) && isWebSocketRequest(toSign)) {
                const signedRequest = await this.signer.presign({ ...toSign, body: "" }, {
                    ...options,
                    expiresIn: 60,
                    unsignableHeaders: new Set(Object.keys(toSign.headers).filter((header) => header !== "host")),
                });
                return {
                    ...signedRequest,
                    body: toSign.body,
                };
            }
            else {
                return this.signer.sign(toSign, options);
            }
        }
        signMessage(message, args) {
            return this.signer.signMessage(message, args);
        }
    }

    const resolveWebSocketConfig = (input) => {
        const { signer } = input;
        return Object.assign(input, {
            signer: async (authScheme) => {
                const signerObj = await signer(authScheme);
                if (validateSigner(signerObj)) {
                    return new WebsocketSignatureV4({ signer: signerObj });
                }
                throw new Error("Expected WebsocketSignatureV4 signer, please check the client constructor.");
            },
        });
    };
    const validateSigner = (signer) => !!signer;

    const getDateHeader = (response) => HttpResponse.isInstance(response) ? (response.headers?.date ?? response.headers?.Date) : undefined;
    const getAgeHeader = (response) => HttpResponse.isInstance(response) ? (response.headers?.age ?? response.headers?.Age) : undefined;

    const getSkewCorrectedDate = (systemClockOffset) => new Date(Date.now() + systemClockOffset);

    const getUpdatedSystemClockOffset = (clockTime, currentSystemClockOffset, timeRequestSent, ageHeader) => {
        if (ageHeader !== undefined) {
            return currentSystemClockOffset;
        }
        const serverTime = Date.parse(clockTime);
        const timeResponseReceived = Date.now();
        if (timeRequestSent !== undefined && timeResponseReceived - timeRequestSent > 900_000) {
            return currentSystemClockOffset;
        }
        const candidateSkew = timeRequestSent !== undefined
            ? serverTime - (timeRequestSent + timeResponseReceived) / 2
            : serverTime - timeResponseReceived;
        return candidateSkew;
    };

    const throwSigningPropertyError = (name, property) => {
        if (!property) {
            throw new Error(`Property \`${name}\` is not resolved for AWS SDK SigV4Auth`);
        }
        return property;
    };
    const validateSigningProperties = async (signingProperties) => {
        const context = throwSigningPropertyError("context", signingProperties.context);
        const config = throwSigningPropertyError("config", signingProperties.config);
        const authScheme = context.endpointV2?.properties?.authSchemes?.[0];
        const signerFunction = throwSigningPropertyError("signer", config.signer);
        const signer = await signerFunction(authScheme);
        const signingRegion = signingProperties?.signingRegion;
        const signingRegionSet = signingProperties?.signingRegionSet;
        const signingName = signingProperties?.signingName;
        return {
            config,
            signer,
            signingRegion,
            signingRegionSet,
            signingName,
        };
    };
    class AwsSdkSigV4Signer {
        async sign(httpRequest, identity, signingProperties) {
            if (!HttpRequest.isInstance(httpRequest)) {
                throw new Error("The request is not an instance of `HttpRequest` and cannot be signed");
            }
            const validatedProps = await validateSigningProperties(signingProperties);
            const { config, signer } = validatedProps;
            let { signingRegion, signingName } = validatedProps;
            const handlerExecutionContext = signingProperties.context;
            if (handlerExecutionContext?.authSchemes?.length ?? 0 > 1) {
                const [first, second] = handlerExecutionContext.authSchemes;
                if (first?.name === "sigv4a" && second?.name === "sigv4") {
                    signingRegion = second?.signingRegion ?? signingRegion;
                    signingName = second?.signingName ?? signingName;
                }
            }
            const noSkewCorrection = (await config.disableClockSkewCorrection?.()) === true;
            signingProperties._disableClockSkewCorrection = noSkewCorrection;
            if (!noSkewCorrection) {
                signingProperties._preRequestSystemClockOffset = config.systemClockOffset;
                signingProperties._requestSentAt = Date.now();
            }
            const signedRequest = await signer.sign(httpRequest, {
                signingDate: noSkewCorrection ? new Date() : getSkewCorrectedDate(config.systemClockOffset),
                signingRegion: signingRegion,
                signingService: signingName,
            });
            return signedRequest;
        }
        errorHandler(signingProperties) {
            return (error) => {
                const errorException = error;
                if (!signingProperties._disableClockSkewCorrection) {
                    const serverTime = errorException.ServerTime ?? getDateHeader(errorException.$response);
                    if (serverTime) {
                        const config = throwSigningPropertyError("config", signingProperties.config);
                        const preRequestOffset = signingProperties._preRequestSystemClockOffset;
                        const timeRequestSent = signingProperties._requestSentAt;
                        const ageHeader = getAgeHeader(errorException.$response);
                        const newOffset = getUpdatedSystemClockOffset(serverTime, config.systemClockOffset, timeRequestSent, ageHeader);
                        config.systemClockOffset = newOffset;
                        const skewExceedsThreshold = Math.abs(newOffset) >= 240_000;
                        const isLocalCorrection = newOffset !== preRequestOffset;
                        const isConcurrentCorrection = preRequestOffset !== undefined && preRequestOffset !== newOffset;
                        if (skewExceedsThreshold && (isLocalCorrection || isConcurrentCorrection) && errorException.$metadata) {
                            errorException.$metadata.clockSkewCorrected = true;
                        }
                    }
                }
                throw error;
            };
        }
        successHandler(httpResponse, signingProperties) {
            if (signingProperties._disableClockSkewCorrection) {
                return;
            }
            const dateHeader = getDateHeader(httpResponse);
            if (dateHeader) {
                const config = throwSigningPropertyError("config", signingProperties.config);
                const timeRequestSent = signingProperties._requestSentAt;
                const ageHeader = getAgeHeader(httpResponse);
                config.systemClockOffset = getUpdatedSystemClockOffset(dateHeader, config.systemClockOffset, timeRequestSent, ageHeader);
            }
        }
    }

    class HeaderFormatter {
        format(headers) {
            const chunks = [];
            for (const headerName in headers) {
                if (!hasOwn(headers, headerName))
                    continue;
                const bytes = fromUtf8(headerName);
                chunks.push(Uint8Array.from([bytes.byteLength]), bytes, this.formatHeaderValue(headers[headerName]));
            }
            const out = new Uint8Array(chunks.reduce((carry, bytes) => carry + bytes.byteLength, 0));
            let position = 0;
            for (const chunk of chunks) {
                out.set(chunk, position);
                position += chunk.byteLength;
            }
            return out;
        }
        formatHeaderValue(header) {
            switch (header.type) {
                case "boolean":
                    return Uint8Array.from([header.value ? 0 : 1]);
                case "byte":
                    return Uint8Array.from([2, header.value]);
                case "short":
                    const shortView = new DataView(new ArrayBuffer(3));
                    shortView.setUint8(0, 3);
                    shortView.setInt16(1, header.value, false);
                    return new Uint8Array(shortView.buffer);
                case "integer":
                    const intView = new DataView(new ArrayBuffer(5));
                    intView.setUint8(0, 4);
                    intView.setInt32(1, header.value, false);
                    return new Uint8Array(intView.buffer);
                case "long":
                    const longBytes = new Uint8Array(9);
                    longBytes[0] = 5;
                    longBytes.set(header.value.bytes, 1);
                    return longBytes;
                case "binary":
                    const binView = new DataView(new ArrayBuffer(3 + header.value.byteLength));
                    binView.setUint8(0, 6);
                    binView.setUint16(1, header.value.byteLength, false);
                    const binBytes = new Uint8Array(binView.buffer);
                    binBytes.set(header.value, 3);
                    return binBytes;
                case "string":
                    const utf8Bytes = fromUtf8(header.value);
                    const strView = new DataView(new ArrayBuffer(3 + utf8Bytes.byteLength));
                    strView.setUint8(0, 7);
                    strView.setUint16(1, utf8Bytes.byteLength, false);
                    const strBytes = new Uint8Array(strView.buffer);
                    strBytes.set(utf8Bytes, 3);
                    return strBytes;
                case "timestamp":
                    const tsBytes = new Uint8Array(9);
                    tsBytes[0] = 8;
                    tsBytes.set(Int64.fromNumber(header.value.valueOf()).bytes, 1);
                    return tsBytes;
                case "uuid":
                    if (!UUID_PATTERN.test(header.value)) {
                        throw new Error(`Invalid UUID received: ${header.value}`);
                    }
                    const uuidBytes = new Uint8Array(17);
                    uuidBytes[0] = 9;
                    uuidBytes.set(fromHex(header.value.replace(/-/g, "")), 1);
                    return uuidBytes;
            }
        }
    }
    var HEADER_VALUE_TYPE;
    (function (HEADER_VALUE_TYPE) {
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["boolTrue"] = 0] = "boolTrue";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["boolFalse"] = 1] = "boolFalse";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["byte"] = 2] = "byte";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["short"] = 3] = "short";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["integer"] = 4] = "integer";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["long"] = 5] = "long";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["byteArray"] = 6] = "byteArray";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["string"] = 7] = "string";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["timestamp"] = 8] = "timestamp";
        HEADER_VALUE_TYPE[HEADER_VALUE_TYPE["uuid"] = 9] = "uuid";
    })(HEADER_VALUE_TYPE || (HEADER_VALUE_TYPE = {}));
    const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
    class Int64 {
        bytes;
        constructor(bytes) {
            this.bytes = bytes;
            if (bytes.byteLength !== 8) {
                throw new Error("Int64 buffers must be exactly 8 bytes");
            }
        }
        static fromNumber(number) {
            if (number > 9_223_372_036_854_775_807 || number < -9223372036854776e3) {
                throw new Error(`${number} is too large (or, if negative, too small) to represent as an Int64`);
            }
            const bytes = new Uint8Array(8);
            for (let i = 7, remaining = Math.abs(Math.round(number)); i > -1 && remaining > 0; i--, remaining /= 256) {
                bytes[i] = remaining;
            }
            if (number < 0) {
                negate(bytes);
            }
            return new Int64(bytes);
        }
        valueOf() {
            const bytes = this.bytes.slice(0);
            const negative = bytes[0] & 0b10000000;
            if (negative) {
                negate(bytes);
            }
            return parseInt(toHex(bytes), 16) * (negative ? -1 : 1);
        }
        toString() {
            return String(this.valueOf());
        }
    }
    function negate(bytes) {
        for (let i = 0; i < 8; i++) {
            bytes[i] ^= 0xff;
        }
        for (let i = 7; i > -1; i--) {
            bytes[i]++;
            if (bytes[i] !== 0)
                break;
        }
    }

    const ALGORITHM_QUERY_PARAM = "X-Amz-Algorithm";
    const CREDENTIAL_QUERY_PARAM = "X-Amz-Credential";
    const AMZ_DATE_QUERY_PARAM = "X-Amz-Date";
    const SIGNED_HEADERS_QUERY_PARAM = "X-Amz-SignedHeaders";
    const EXPIRES_QUERY_PARAM = "X-Amz-Expires";
    const SIGNATURE_QUERY_PARAM = "X-Amz-Signature";
    const TOKEN_QUERY_PARAM = "X-Amz-Security-Token";
    const AUTH_HEADER = "authorization";
    const AMZ_DATE_HEADER = AMZ_DATE_QUERY_PARAM.toLowerCase();
    const DATE_HEADER = "date";
    const GENERATED_HEADERS = [AUTH_HEADER, AMZ_DATE_HEADER, DATE_HEADER];
    const SIGNATURE_HEADER = SIGNATURE_QUERY_PARAM.toLowerCase();
    const SHA256_HEADER = "x-amz-content-sha256";
    const TOKEN_HEADER = TOKEN_QUERY_PARAM.toLowerCase();
    const ALWAYS_UNSIGNABLE_HEADERS = {
        authorization: true,
        "cache-control": true,
        connection: true,
        expect: true,
        from: true,
        "keep-alive": true,
        "max-forwards": true,
        pragma: true,
        referer: true,
        te: true,
        trailer: true,
        "transfer-encoding": true,
        upgrade: true,
        "user-agent": true,
        "x-amzn-trace-id": true,
    };
    const PROXY_HEADER_PATTERN = /^proxy-/;
    const SEC_HEADER_PATTERN = /^sec-/;
    const ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256";
    const EVENT_ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256-PAYLOAD";
    const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
    const MAX_CACHE_SIZE = 50;
    const KEY_TYPE_IDENTIFIER = "aws4_request";
    const MAX_PRESIGNED_TTL = 60 * 60 * 24 * 7;

    const getCanonicalQuery = ({ query = {} }) => {
        const keys = [];
        const serialized = {};
        for (const key in query) {
            if (!hasOwn(query, key))
                continue;
            if (key.toLowerCase() === SIGNATURE_HEADER) {
                continue;
            }
            const encodedKey = escapeUri(key);
            keys.push(encodedKey);
            const value = query[key];
            if (typeof value === "string") {
                serialized[encodedKey] = `${encodedKey}=${escapeUri(value)}`;
            }
            else if (Array.isArray(value)) {
                serialized[encodedKey] = value
                    .slice(0)
                    .reduce((encoded, value) => encoded.concat([`${encodedKey}=${escapeUri(value)}`]), [])
                    .sort()
                    .join("&");
            }
        }
        return keys
            .sort()
            .map((key) => serialized[key])
            .filter((serialized) => serialized)
            .join("&");
    };

    const iso8601 = (time) => toDate(time)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z");
    const toDate = (time) => {
        if (typeof time === "number") {
            return new Date(time * 1000);
        }
        if (typeof time === "string") {
            if (Number(time)) {
                return new Date(Number(time) * 1000);
            }
            return new Date(time);
        }
        return time;
    };

    class SignatureV4Base {
        service;
        regionProvider;
        credentialProvider;
        sha256;
        uriEscapePath;
        applyChecksum;
        constructor({ applyChecksum, credentials, region, service, sha256, uriEscapePath = true, }) {
            this.service = service;
            this.sha256 = sha256;
            this.uriEscapePath = uriEscapePath;
            this.applyChecksum = typeof applyChecksum === "boolean" ? applyChecksum : true;
            this.regionProvider = normalizeProvider$1(region);
            this.credentialProvider = normalizeProvider$1(credentials);
        }
        createCanonicalRequest(request, canonicalHeaders, payloadHash) {
            const sortedHeaders = Object.keys(canonicalHeaders).sort();
            return `${request.method}
${this.getCanonicalPath(request)}
${getCanonicalQuery(request)}
${sortedHeaders.map((name) => `${name}:${canonicalHeaders[name]}`).join("\n")}

${sortedHeaders.join(";")}
${payloadHash}`;
        }
        async createStringToSign(longDate, credentialScope, canonicalRequest, algorithmIdentifier) {
            const hash = new this.sha256();
            hash.update(toUint8Array(canonicalRequest));
            const hashedRequest = await hash.digest();
            return `${algorithmIdentifier}
${longDate}
${credentialScope}
${toHex(hashedRequest)}`;
        }
        getCanonicalPath({ path }) {
            if (this.uriEscapePath) {
                const normalizedPathSegments = [];
                for (const pathSegment of path.split("/")) {
                    if (pathSegment?.length === 0)
                        continue;
                    if (pathSegment === ".")
                        continue;
                    if (pathSegment === "..") {
                        normalizedPathSegments.pop();
                    }
                    else {
                        normalizedPathSegments.push(pathSegment);
                    }
                }
                const normalizedPath = `${path?.startsWith("/") ? "/" : ""}${normalizedPathSegments.join("/")}${normalizedPathSegments.length > 0 && path?.endsWith("/") ? "/" : ""}`;
                const doubleEncoded = escapeUri(normalizedPath);
                return doubleEncoded.replace(/%2F/g, "/");
            }
            return path;
        }
        validateResolvedCredentials(credentials) {
            if (typeof credentials !== "object" ||
                typeof credentials.accessKeyId !== "string" ||
                typeof credentials.secretAccessKey !== "string") {
                throw new Error("Resolved credential object is not valid");
            }
        }
        formatDate(now) {
            const longDate = iso8601(now).replace(/[-:]/g, "");
            return {
                longDate,
                shortDate: longDate.slice(0, 8),
            };
        }
        getCanonicalHeaderList(headers) {
            return Object.keys(headers).sort().join(";");
        }
    }

    const signingKeyCache = {};
    const cacheQueue = [];
    const createScope = (shortDate, region, service) => `${shortDate}/${region}/${service}/${KEY_TYPE_IDENTIFIER}`;
    const getSigningKey = async (sha256Constructor, credentials, shortDate, region, service) => {
        const credsHash = await hmac(sha256Constructor, credentials.secretAccessKey, credentials.accessKeyId);
        const cacheKey = `${shortDate}:${region}:${service}:${toHex(credsHash)}:${credentials.sessionToken}`;
        if (cacheKey in signingKeyCache) {
            return signingKeyCache[cacheKey];
        }
        cacheQueue.push(cacheKey);
        while (cacheQueue.length > MAX_CACHE_SIZE) {
            delete signingKeyCache[cacheQueue.shift()];
        }
        let key = `AWS4${credentials.secretAccessKey}`;
        for (const signable of [shortDate, region, service, KEY_TYPE_IDENTIFIER]) {
            key = await hmac(sha256Constructor, key, signable);
        }
        return (signingKeyCache[cacheKey] = key);
    };
    const hmac = (ctor, secret, data) => {
        const hash = new ctor(secret);
        hash.update(toUint8Array(data));
        return hash.digest();
    };

    const getCanonicalHeaders = ({ headers }, unsignableHeaders, signableHeaders) => {
        const canonical = {};
        for (const headerName of Object.keys(headers).sort()) {
            if (headers[headerName] == undefined) {
                continue;
            }
            const canonicalHeaderName = headerName.toLowerCase();
            if (canonicalHeaderName in ALWAYS_UNSIGNABLE_HEADERS ||
                unsignableHeaders?.has(canonicalHeaderName) ||
                PROXY_HEADER_PATTERN.test(canonicalHeaderName) ||
                SEC_HEADER_PATTERN.test(canonicalHeaderName)) {
                if (!signableHeaders || (signableHeaders && !signableHeaders.has(canonicalHeaderName))) {
                    continue;
                }
            }
            canonical[canonicalHeaderName] = headers[headerName].trim().replace(/\s+/g, " ");
        }
        return canonical;
    };

    const getPayloadHash = async ({ headers, body }, hashConstructor) => {
        for (const headerName in headers) {
            if (!hasOwn(headers, headerName))
                continue;
            if (headerName.toLowerCase() === SHA256_HEADER) {
                return headers[headerName];
            }
        }
        if (body == undefined) {
            return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        }
        else if (typeof body === "string" || ArrayBuffer.isView(body) || isArrayBuffer(body)) {
            const hashCtor = new hashConstructor();
            hashCtor.update(toUint8Array(body));
            return toHex(await hashCtor.digest());
        }
        return UNSIGNED_PAYLOAD;
    };

    const hasHeader = (soughtHeader, headers) => {
        soughtHeader = soughtHeader.toLowerCase();
        for (const headerName in headers) {
            if (!hasOwn(headers, headerName))
                continue;
            if (soughtHeader === headerName.toLowerCase()) {
                return true;
            }
        }
        return false;
    };

    const moveHeadersToQuery = (request, options = {}) => {
        const { headers, query = {} } = HttpRequest.clone(request);
        for (const name in headers) {
            if (!hasOwn(headers, name))
                continue;
            const lname = name.toLowerCase();
            if ((lname.slice(0, 6) === "x-amz-" && !options.unhoistableHeaders?.has(lname)) ||
                options.hoistableHeaders?.has(lname)) {
                query[name] = headers[name];
                delete headers[name];
            }
        }
        return {
            ...request,
            headers,
            query,
        };
    };

    const prepareRequest = (request) => {
        request = HttpRequest.clone(request);
        for (const headerName in request.headers) {
            if (!hasOwn(request.headers, headerName))
                continue;
            if (GENERATED_HEADERS.indexOf(headerName.toLowerCase()) > -1) {
                delete request.headers[headerName];
            }
        }
        return request;
    };

    class SignatureV4 extends SignatureV4Base {
        headerFormatter = new HeaderFormatter();
        constructor({ applyChecksum, credentials, region, service, sha256, uriEscapePath = true, }) {
            super({
                applyChecksum,
                credentials,
                region,
                service,
                sha256,
                uriEscapePath,
            });
        }
        async presign(originalRequest, options = {}) {
            const { signingDate = new Date(), expiresIn = 3600, unsignableHeaders, unhoistableHeaders, signableHeaders, hoistableHeaders, signingRegion, signingService, } = options;
            const credentials = await this.credentialProvider();
            this.validateResolvedCredentials(credentials);
            const region = signingRegion ?? (await this.regionProvider());
            const { longDate, shortDate } = this.formatDate(signingDate);
            if (expiresIn > MAX_PRESIGNED_TTL) {
                return Promise.reject("Signature version 4 presigned URLs" + " must have an expiration date less than one week in" + " the future");
            }
            const scope = createScope(shortDate, region, signingService ?? this.service);
            const request = moveHeadersToQuery(prepareRequest(originalRequest), { unhoistableHeaders, hoistableHeaders });
            if (credentials.sessionToken) {
                request.query[TOKEN_QUERY_PARAM] = credentials.sessionToken;
            }
            request.query[ALGORITHM_QUERY_PARAM] = ALGORITHM_IDENTIFIER;
            request.query[CREDENTIAL_QUERY_PARAM] = `${credentials.accessKeyId}/${scope}`;
            request.query[AMZ_DATE_QUERY_PARAM] = longDate;
            request.query[EXPIRES_QUERY_PARAM] = expiresIn.toString(10);
            const canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
            request.query[SIGNED_HEADERS_QUERY_PARAM] = this.getCanonicalHeaderList(canonicalHeaders);
            request.query[SIGNATURE_QUERY_PARAM] = await this.getSignature(longDate, scope, this.getSigningKey(credentials, region, shortDate, signingService), this.createCanonicalRequest(request, canonicalHeaders, await getPayloadHash(originalRequest, this.sha256)));
            return request;
        }
        async sign(toSign, options) {
            if (typeof toSign === "string") {
                return this.signString(toSign, options);
            }
            else if (toSign.headers && toSign.payload) {
                return this.signEvent(toSign, options);
            }
            else if (toSign.message) {
                return this.signMessage(toSign, options);
            }
            else {
                return this.signRequest(toSign, options);
            }
        }
        async signEvent({ headers, payload }, { signingDate = new Date(), priorSignature, signingRegion, signingService, eventStreamCredentials, }) {
            const region = signingRegion ?? (await this.regionProvider());
            const { shortDate, longDate } = this.formatDate(signingDate);
            const scope = createScope(shortDate, region, signingService ?? this.service);
            const hashedPayload = await getPayloadHash({ headers: {}, body: payload }, this.sha256);
            const hash = new this.sha256();
            hash.update(headers);
            const hashedHeaders = toHex(await hash.digest());
            const stringToSign = [
                EVENT_ALGORITHM_IDENTIFIER,
                longDate,
                scope,
                priorSignature,
                hashedHeaders,
                hashedPayload,
            ].join("\n");
            return this.signString(stringToSign, {
                signingDate,
                signingRegion: region,
                signingService,
                eventStreamCredentials,
            });
        }
        async signMessage(signableMessage, { signingDate = new Date(), signingRegion, signingService, eventStreamCredentials }) {
            const promise = this.signEvent({
                headers: this.headerFormatter.format(signableMessage.message.headers),
                payload: signableMessage.message.body,
            }, {
                signingDate,
                signingRegion,
                signingService,
                priorSignature: signableMessage.priorSignature,
                eventStreamCredentials,
            });
            return promise.then((signature) => {
                return { message: signableMessage.message, signature };
            });
        }
        async signString(stringToSign, { signingDate = new Date(), signingRegion, signingService, eventStreamCredentials, } = {}) {
            const credentials = eventStreamCredentials ?? (await this.credentialProvider());
            this.validateResolvedCredentials(credentials);
            const region = signingRegion ?? (await this.regionProvider());
            const { shortDate } = this.formatDate(signingDate);
            const hash = new this.sha256(await this.getSigningKey(credentials, region, shortDate, signingService));
            hash.update(toUint8Array(stringToSign));
            return toHex(await hash.digest());
        }
        async signRequest(requestToSign, { signingDate = new Date(), signableHeaders, unsignableHeaders, signingRegion, signingService, } = {}) {
            const credentials = await this.credentialProvider();
            this.validateResolvedCredentials(credentials);
            const region = signingRegion ?? (await this.regionProvider());
            const request = prepareRequest(requestToSign);
            const { longDate, shortDate } = this.formatDate(signingDate);
            const scope = createScope(shortDate, region, signingService ?? this.service);
            request.headers[AMZ_DATE_HEADER] = longDate;
            if (credentials.sessionToken) {
                request.headers[TOKEN_HEADER] = credentials.sessionToken;
            }
            const payloadHash = await getPayloadHash(request, this.sha256);
            if (!hasHeader(SHA256_HEADER, request.headers) && this.applyChecksum) {
                request.headers[SHA256_HEADER] = payloadHash;
            }
            const canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
            const signature = await this.getSignature(longDate, scope, this.getSigningKey(credentials, region, shortDate, signingService), this.createCanonicalRequest(request, canonicalHeaders, payloadHash));
            request.headers[AUTH_HEADER] =
                `${ALGORITHM_IDENTIFIER} ` +
                    `Credential=${credentials.accessKeyId}/${scope}, ` +
                    `SignedHeaders=${this.getCanonicalHeaderList(canonicalHeaders)}, ` +
                    `Signature=${signature}`;
            return request;
        }
        async getSignature(longDate, credentialScope, keyPromise, canonicalRequest) {
            const stringToSign = await this.createStringToSign(longDate, credentialScope, canonicalRequest, ALGORITHM_IDENTIFIER);
            const hash = new this.sha256(await keyPromise);
            hash.update(toUint8Array(stringToSign));
            return toHex(await hash.digest());
        }
        getSigningKey(credentials, region, shortDate, service) {
            return getSigningKey(this.sha256, credentials, shortDate, region, service || this.service);
        }
    }

    const bindResolveAwsSdkSigV4Config = (defaultDisableClockSkewCorrection) => (config) => {
        let inputCredentials = config.credentials;
        let isUserSupplied = !!config.credentials;
        let resolvedCredentials = undefined;
        Object.defineProperty(config, "credentials", {
            set(credentials) {
                if (credentials && credentials !== inputCredentials && credentials !== resolvedCredentials) {
                    isUserSupplied = true;
                }
                inputCredentials = credentials;
                const memoizedProvider = normalizeCredentialProvider(config, {
                    credentials: inputCredentials,
                    credentialDefaultProvider: config.credentialDefaultProvider,
                });
                const boundProvider = bindCallerConfig(config, memoizedProvider);
                if (isUserSupplied && !boundProvider.attributed) {
                    const isCredentialObject = typeof inputCredentials === "object" && inputCredentials !== null;
                    resolvedCredentials = async (options) => {
                        const creds = await boundProvider(options);
                        const attributedCreds = creds;
                        if (isCredentialObject && (!attributedCreds.$source || Object.keys(attributedCreds.$source).length === 0)) {
                            return setCredentialFeature(attributedCreds, "CREDENTIALS_CODE", "e");
                        }
                        return attributedCreds;
                    };
                    resolvedCredentials.memoized = boundProvider.memoized;
                    resolvedCredentials.configBound = boundProvider.configBound;
                    resolvedCredentials.attributed = true;
                }
                else {
                    resolvedCredentials = boundProvider;
                }
            },
            get() {
                return resolvedCredentials;
            },
            enumerable: true,
            configurable: true,
        });
        config.credentials = inputCredentials;
        const { signingEscapePath = true, systemClockOffset = config.systemClockOffset || 0, sha256, } = config;
        let signer;
        if (config.signer) {
            signer = normalizeProvider(config.signer);
        }
        else if (config.regionInfoProvider) {
            signer = () => normalizeProvider(config.region)()
                .then(async (region) => [
                (await config.regionInfoProvider(region, {
                    useFipsEndpoint: await config.useFipsEndpoint(),
                    useDualstackEndpoint: await config.useDualstackEndpoint(),
                })) || {},
                region,
            ])
                .then(([regionInfo, region]) => {
                const { signingRegion, signingService } = regionInfo;
                config.signingRegion = config.signingRegion || signingRegion || region;
                config.signingName = config.signingName || signingService || config.serviceId;
                const params = {
                    ...config,
                    credentials: config.credentials,
                    region: config.signingRegion,
                    service: config.signingName,
                    sha256,
                    uriEscapePath: signingEscapePath,
                };
                const SignerCtor = config.signerConstructor || SignatureV4;
                return new SignerCtor(params);
            });
        }
        else {
            signer = async (authScheme) => {
                authScheme = Object.assign({}, {
                    name: "sigv4",
                    signingName: config.signingName || config.defaultSigningName,
                    signingRegion: await normalizeProvider(config.region)(),
                    properties: {},
                }, authScheme);
                const signingRegion = authScheme.signingRegion;
                const signingService = authScheme.signingName;
                config.signingRegion = config.signingRegion || signingRegion;
                config.signingName = config.signingName || signingService || config.serviceId;
                const params = {
                    ...config,
                    credentials: config.credentials,
                    region: config.signingRegion,
                    service: config.signingName,
                    sha256,
                    uriEscapePath: signingEscapePath,
                };
                const SignerCtor = config.signerConstructor || SignatureV4;
                return new SignerCtor(params);
            };
        }
        const resolvedConfig = Object.assign(config, {
            systemClockOffset,
            signingEscapePath,
            signer,
            disableClockSkewCorrection: normalizeProvider(config.disableClockSkewCorrection ?? defaultDisableClockSkewCorrection),
        });
        return resolvedConfig;
    };
    function normalizeCredentialProvider(config, { credentials, credentialDefaultProvider }) {
        let credentialsProvider;
        if (credentials) {
            if (!credentials?.memoized) {
                credentialsProvider = memoizeIdentityProvider(credentials, isIdentityExpired, doesIdentityRequireRefresh);
            }
            else {
                credentialsProvider = credentials;
            }
        }
        else {
            if (credentialDefaultProvider) {
                credentialsProvider = normalizeProvider(credentialDefaultProvider(Object.assign({}, config, {
                    parentClientConfig: config,
                })));
            }
            else {
                credentialsProvider = async () => {
                    throw new Error("@aws-sdk/core::resolveAwsSdkSigV4Config - `credentials` not provided and no credentialDefaultProvider was configured.");
                };
            }
        }
        credentialsProvider.memoized = true;
        return credentialsProvider;
    }
    function bindCallerConfig(config, credentialsProvider) {
        if (credentialsProvider.configBound) {
            return credentialsProvider;
        }
        const fn = async (options) => credentialsProvider({ ...options, callerClientConfig: config });
        fn.memoized = credentialsProvider.memoized;
        fn.configBound = true;
        return fn;
    }

    const DEFAULT_DISABLE_CLOCK_SKEW_CORRECTION = false;

    const resolveAwsSdkSigV4Config = bindResolveAwsSdkSigV4Config(DEFAULT_DISABLE_CLOCK_SKEW_CORRECTION);

    const defaultTranscribeStreamingHttpAuthSchemeParametersProvider = async (config, context, input) => {
        return {
            operation: getSmithyContext(context).operation,
            region: await normalizeProvider$1(config.region)() || (() => {
                throw new Error("expected `region` to be configured for `aws.auth#sigv4`");
            })(),
        };
    };
    function createAwsAuthSigv4HttpAuthOption(authParameters) {
        return {
            schemeId: "aws.auth#sigv4",
            signingProperties: {
                name: "transcribe",
                region: authParameters.region,
            },
            propertiesExtractor: (config, context) => ({
                signingProperties: {
                    config,
                    context,
                },
            }),
        };
    }
    const defaultTranscribeStreamingHttpAuthSchemeProvider = (authParameters) => {
        const options = [];
        switch (authParameters.operation) {
            default: {
                options.push(createAwsAuthSigv4HttpAuthOption(authParameters));
            }
        }
        return options;
    };
    const resolveHttpAuthSchemeConfig = (config) => {
        const config_0 = resolveAwsSdkSigV4Config(config);
        return Object.assign(config_0, {
            authSchemePreference: normalizeProvider$1(config.authSchemePreference ?? []),
        });
    };

    const resolveClientEndpointParameters = (options) => {
        return Object.assign(options, {
            useDualstackEndpoint: options.useDualstackEndpoint ?? false,
            useFipsEndpoint: options.useFipsEndpoint ?? false,
            defaultSigningName: "transcribe",
        });
    };
    const commonParams = {
        UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
        Endpoint: { type: "builtInParams", name: "endpoint" },
        Region: { type: "builtInParams", name: "region" },
        UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" },
    };

    var version = "3.1129.0";
    var packageInfo = {
    	version: version};

    const eventStreamPayloadHandler = {
        handle: (next, args) => next(args),
    };

    const injectResponseValuesMiddleware = (config) => (next) => async (args) => {
        if (args.input.SessionId === undefined && isWebSocket(config)) {
            args.input.SessionId = v4();
        }
        const requestParams = {
            ...args.input,
        };
        const response = await next(args);
        const output = response.output;
        for (const key of Object.keys(output)) {
            if (output[key] === undefined && requestParams[key]) {
                output[key] = requestParams[key];
            }
        }
        return response;
    };
    const isWebSocket = (config) => config.requestHandler.metadata?.handlerProtocol?.includes("websocket");
    const injectResponseValuesMiddlewareOptions = {
        step: "initialize",
        name: "injectResponseValuesMiddleware",
        tags: ["WEBSOCKET", "EVENT_STREAM"],
        override: true,
    };

    const websocketPortMiddleware = (options) => (next) => (args) => {
        const { request } = args;
        if (HttpRequest.isInstance(request) && options.requestHandler.metadata?.handlerProtocol?.includes("websocket")) {
            request.hostname = `${request.hostname}:8443`;
            request.headers.host = request.hostname;
        }
        return next(args);
    };
    const websocketPortMiddlewareOptions = {
        name: "websocketPortMiddleware",
        tags: ["WEBSOCKET", "EVENT_STREAM", "PORT"],
        relation: "after",
        toMiddleware: "eventStreamHeaderMiddleware",
        override: true,
    };

    const getTranscribeStreamingPlugin = (config) => ({
        applyToStack: (clientStack) => {
            clientStack.addRelativeTo(websocketPortMiddleware(config), websocketPortMiddlewareOptions);
            clientStack.add(injectResponseValuesMiddleware(config), injectResponseValuesMiddlewareOptions);
        },
    });

    class ProtocolLib {
        queryCompat;
        errorRegistry;
        constructor(queryCompat = false) {
            this.queryCompat = queryCompat;
        }
        resolveRestContentType(defaultContentType, inputSchema) {
            const members = inputSchema.getMemberSchemas();
            const httpPayloadMember = Object.values(members).find((m) => {
                return !!m.getMergedTraits().httpPayload;
            });
            if (httpPayloadMember) {
                const mediaType = httpPayloadMember.getMergedTraits().mediaType;
                if (mediaType) {
                    return mediaType;
                }
                else if (httpPayloadMember.isStringSchema()) {
                    return "text/plain";
                }
                else if (httpPayloadMember.isBlobSchema()) {
                    return "application/octet-stream";
                }
                else {
                    return defaultContentType;
                }
            }
            else if (!inputSchema.isUnitSchema()) {
                const hasBody = Object.values(members).find((m) => {
                    const { httpQuery, httpQueryParams, httpHeader, httpLabel, httpPrefixHeaders } = m.getMergedTraits();
                    const noPrefixHeaders = httpPrefixHeaders === void 0;
                    return !httpQuery && !httpQueryParams && !httpHeader && !httpLabel && noPrefixHeaders;
                });
                if (hasBody) {
                    return defaultContentType;
                }
            }
        }
        async getErrorSchemaOrThrowBaseException(errorIdentifier, defaultNamespace, response, dataObject, metadata, getErrorSchema) {
            let errorName = errorIdentifier;
            if (errorIdentifier.includes("#")) {
                [, errorName] = errorIdentifier.split("#");
            }
            const errorMetadata = {
                $metadata: metadata,
                $fault: response.statusCode < 500 ? "client" : "server",
            };
            if (!this.errorRegistry) {
                throw new Error("@aws-sdk/core/protocols - error handler not initialized.");
            }
            try {
                const errorSchema = getErrorSchema?.(this.errorRegistry, errorName) ??
                    this.errorRegistry.getSchema(errorIdentifier);
                return { errorSchema, errorMetadata };
            }
            catch (e) {
                dataObject.message = dataObject.message ?? dataObject.Message ?? "UnknownError";
                const synthetic = this.errorRegistry;
                const baseExceptionSchema = synthetic.getBaseException();
                if (baseExceptionSchema) {
                    const ErrorCtor = synthetic.getErrorCtor(baseExceptionSchema) ?? Error;
                    throw this.decorateServiceException(Object.assign(new ErrorCtor({ name: errorName }), errorMetadata), dataObject);
                }
                const d = dataObject;
                const message = d?.message ?? d?.Message ?? d?.Error?.Message ?? d?.Error?.message;
                throw this.decorateServiceException(Object.assign(new Error(message), {
                    name: errorName,
                }, errorMetadata), dataObject);
            }
        }
        compose(composite, errorIdentifier, defaultNamespace) {
            let namespace = defaultNamespace;
            if (errorIdentifier.includes("#")) {
                [namespace] = errorIdentifier.split("#");
            }
            const staticRegistry = TypeRegistry.for(namespace);
            const defaultSyntheticRegistry = TypeRegistry.for("smithy.ts.sdk.synthetic." + defaultNamespace);
            composite.copyFrom(staticRegistry);
            composite.copyFrom(defaultSyntheticRegistry);
            this.errorRegistry = composite;
        }
        decorateServiceException(exception, additions = {}) {
            if (this.queryCompat) {
                const msg = exception.Message ?? additions.Message;
                const error = decorateServiceException(exception, additions);
                if (msg) {
                    error.message = msg;
                }
                const errorObj = error.Error ?? {};
                errorObj.Type = error.Error?.Type;
                errorObj.Code = error.Error?.Code;
                errorObj.Message = error.Error?.message ?? error.Error?.Message ?? msg;
                error.Error = errorObj;
                const reqId = error.$metadata.requestId;
                if (reqId) {
                    error.RequestId = reqId;
                }
                return error;
            }
            return decorateServiceException(exception, additions);
        }
        setQueryCompatError(output, response) {
            const queryErrorHeader = response.headers?.["x-amzn-query-error"];
            if (output !== undefined && queryErrorHeader != null) {
                const [Code, Type] = queryErrorHeader.split(";");
                const keys = Object.keys(output);
                const Error = {
                    Code,
                    Type,
                };
                output.Code = Code;
                output.Type = Type;
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    Error[k === "message" ? "Message" : k] = output[k];
                }
                delete Error.__type;
                output.Error = Error;
            }
        }
        queryCompatOutput(queryCompatErrorData, errorData) {
            if (queryCompatErrorData.Error) {
                errorData.Error = queryCompatErrorData.Error;
            }
            if (queryCompatErrorData.Type) {
                errorData.Type = queryCompatErrorData.Type;
            }
            if (queryCompatErrorData.Code) {
                errorData.Code = queryCompatErrorData.Code;
            }
        }
        findQueryCompatibleError(registry, errorName) {
            try {
                return registry.getSchema(errorName);
            }
            catch (e) {
                return registry.find((schema) => NormalizedSchema.of(schema).getMergedTraits().awsQueryError?.[0] === errorName);
            }
        }
    }

    class SerdeContextConfig {
        serdeContext;
        setSerdeContext(serdeContext) {
            this.serdeContext = serdeContext;
        }
    }

    class UnionSerde {
        from;
        to;
        keys;
        constructor(from, to) {
            this.from = from;
            this.to = to;
            const keys = Object.keys(this.from);
            const set = new Set(keys);
            set.delete("__type");
            this.keys = set;
        }
        mark(key) {
            this.keys.delete(key);
        }
        hasUnknown() {
            return this.keys.size === 1 && Object.keys(this.to).length === 0;
        }
        writeUnknown() {
            if (this.hasUnknown()) {
                const k = this.keys.values().next().value;
                const v = this.from[k];
                this.to.$unknown = [k, v];
            }
        }
    }

    let canParseBuffer;
    function detectBufferParsing() {
        if (canParseBuffer === undefined) {
            try {
                if (typeof Buffer !== "function") {
                    canParseBuffer = false;
                }
                else {
                    const result = JSON.parse(Buffer.from([0x7b, 0x7d]));
                    canParseBuffer = result !== null && typeof result === "object";
                }
            }
            catch {
                canParseBuffer = false;
            }
        }
        return canParseBuffer;
    }

    function jsonReviver(key, value, context) {
        if (context?.source) {
            const numericString = context.source;
            if (typeof value === "number") {
                const inSafeRange = value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER;
                if (inSafeRange) {
                    if (isRepresentable(numericString, value)) {
                        return value;
                    }
                    return new NumericValue(numericString, "bigDecimal");
                }
                else {
                    if (isFractionalBigNumeric(numericString)) {
                        return new NumericValue(numericString, "bigDecimal");
                    }
                    if (/[eE]/.test(numericString)) {
                        return expandExponentToBigInt(numericString);
                    }
                    return BigInt(numericString);
                }
            }
        }
        return value;
    }
    function isFractionalBigNumeric(s) {
        const dotIndex = s.indexOf(".");
        if (dotIndex === -1) {
            return false;
        }
        const eIndex = s.search(/[eE]/);
        if (eIndex === -1) {
            return true;
        }
        const fracDigits = eIndex - dotIndex - 1;
        const exp = parseInt(s.slice(eIndex + 1), 10);
        return exp < fracDigits;
    }
    function isRepresentable(numericString, value) {
        if (numericString === String(value)) {
            return true;
        }
        if (Object.is(value, -0)) {
            return true;
        }
        if (/[eE]/.test(numericString)) {
            return expandToDecimal(numericString) === expandToDecimal(String(value));
        }
        const normalized = numericString.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
        const canonical = String(value);
        if (normalized === canonical) {
            return true;
        }
        if (/[eE]/.test(canonical)) {
            return normalized === expandToDecimal(canonical);
        }
        return false;
    }
    function expandToDecimal(s) {
        const negative = s.startsWith("-");
        const abs = negative ? s.slice(1) : s;
        const eIndex = abs.search(/[eE]/);
        let result;
        if (eIndex === -1) {
            result = abs;
        }
        else {
            const exp = parseInt(abs.slice(eIndex + 1), 10);
            const mantissa = abs.slice(0, eIndex);
            const dotIndex = mantissa.indexOf(".");
            let digits;
            let intLen;
            if (dotIndex === -1) {
                digits = mantissa;
                intLen = mantissa.length;
            }
            else {
                digits = mantissa.slice(0, dotIndex) + mantissa.slice(dotIndex + 1);
                intLen = dotIndex;
            }
            digits = digits.replace(/0+$/, "") || "0";
            const newDotPos = intLen + exp;
            if (digits === "0") {
                result = "0";
            }
            else if (newDotPos <= 0) {
                result = "0." + "0".repeat(-newDotPos) + digits;
            }
            else if (newDotPos >= digits.length) {
                result = digits + "0".repeat(newDotPos - digits.length);
            }
            else {
                result = digits.slice(0, newDotPos) + "." + digits.slice(newDotPos);
            }
        }
        if (result.includes(".")) {
            result = result.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
        }
        return (negative ? "-" : "") + result;
    }
    function expandExponentToBigInt(s) {
        const eIndex = s.search(/[eE]/);
        const exp = parseInt(s.slice(eIndex + 1), 10);
        const negative = s.startsWith("-");
        const mantissa = s.slice(negative ? 1 : 0, eIndex);
        const dotIndex = mantissa.indexOf(".");
        let digits;
        let shift;
        if (dotIndex === -1) {
            digits = mantissa;
            shift = exp;
        }
        else {
            digits = mantissa.slice(0, dotIndex) + mantissa.slice(dotIndex + 1);
            const fracDigits = mantissa.length - dotIndex - 1;
            shift = exp - fracDigits;
        }
        digits = digits.replace(/0+$/, "") || "0";
        const result = BigInt(digits) * 10n ** BigInt(shift + (mantissa.replace(".", "").length - digits.length));
        return negative ? -result : result;
    }

    const REVIVER_SYMBOL = Symbol.for("@aws-sdk/reviver");
    function needsReviver(schema) {
        const ns = NormalizedSchema.of(schema);
        const raw = ns.getSchema();
        if (Array.isArray(raw) && ns.isStructSchema()) {
            if (REVIVER_SYMBOL in raw) {
                return raw[REVIVER_SYMBOL];
            }
            const result = _check(ns, new Set());
            raw[REVIVER_SYMBOL] = result;
            return result;
        }
        return _check(ns, new Set());
    }
    function _check(ns, seen) {
        const raw = ns.getSchema();
        if (seen.has(raw)) {
            return false;
        }
        seen.add(raw);
        if (ns.isBigIntegerSchema() || ns.isBigDecimalSchema()) {
            return true;
        }
        if (ns.isStructSchema()) {
            for (const [, memberSchema] of ns.structIterator()) {
                if (_check(memberSchema, seen)) {
                    return true;
                }
            }
        }
        else if (ns.isListSchema() || ns.isMapSchema()) {
            if (_check(ns.getValueSchema(), seen)) {
                return true;
            }
        }
        else if (ns.isDocumentSchema()) {
            return true;
        }
        return false;
    }

    const collectBodyString = (streamBody, context) => collectBody(streamBody, context).then((body) => (context?.utf8Encoder ?? toUtf8)(body));

    async function parseJsonBody(streamBody, context, schema) {
        let parsingInput;
        if (detectBufferParsing() && typeof streamBody?.[Symbol.asyncIterator] === "function") {
            const buffer = await collectBody(streamBody, context);
            if (typeof Buffer === "function") {
                if (Buffer.isBuffer(buffer)) {
                    parsingInput = buffer;
                }
                else {
                    parsingInput = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
                }
            }
        }
        if (!parsingInput) {
            parsingInput = await collectBodyString(streamBody, context);
        }
        if (parsingInput.length === 0) {
            return {};
        }
        const reviver = schema && needsReviver(schema) ? jsonReviver : undefined;
        try {
            return JSON.parse(parsingInput, reviver);
        }
        catch (e) {
            if (e?.name === "SyntaxError") {
                Object.defineProperty(e, "$responseBodyText", {
                    value: typeof parsingInput === "string" ? parsingInput : parsingInput.toString("utf8"),
                });
            }
            throw e;
        }
    }
    const findKey = (object, key) => Object.keys(object).find((k) => k.toLowerCase() === key.toLowerCase());
    const sanitizeErrorCode = (rawValue) => {
        let cleanValue = rawValue;
        if (typeof cleanValue === "number") {
            cleanValue = cleanValue.toString();
        }
        if (cleanValue.indexOf(",") >= 0) {
            cleanValue = cleanValue.split(",")[0];
        }
        if (cleanValue.indexOf(":") >= 0) {
            cleanValue = cleanValue.split(":")[0];
        }
        if (cleanValue.indexOf("#") >= 0) {
            cleanValue = cleanValue.split("#")[1];
        }
        return cleanValue;
    };
    const loadRestJsonErrorCode = (output, data) => {
        return loadErrorCode(output, data, ["header", "code", "type"]);
    };
    const loadErrorCode = ({ headers }, data, order) => {
        while (order.length > 0) {
            const location = order.shift();
            switch (location) {
                case "header":
                    const headerKey = findKey(headers ?? {}, "x-amzn-errortype");
                    if (headerKey !== undefined) {
                        return sanitizeErrorCode(headers[headerKey]);
                    }
                    break;
                case "code":
                    const codeKey = findKey(data ?? {}, "code");
                    if (codeKey && data[codeKey] !== undefined) {
                        return sanitizeErrorCode(data[codeKey]);
                    }
                    break;
                case "type":
                    if (data?.__type !== undefined) {
                        return sanitizeErrorCode(data.__type);
                    }
                    break;
            }
        }
    };

    function writeKey(obj) {
        Object.defineProperty(obj, "__proto__", { value: undefined, writable: true, enumerable: true, configurable: true });
    }

    class JsonShapeDeserializer2 extends SerdeContextConfig {
        settings;
        constructor(settings) {
            super();
            this.settings = settings;
        }
        async read(schema, data) {
            const reviver = needsReviver(schema) ? jsonReviver : undefined;
            let parsed;
            if (typeof data === "string") {
                if (data.length === 0) {
                    return {};
                }
                parsed = JSON.parse(data, reviver);
            }
            else if (data instanceof Uint8Array && detectBufferParsing()) {
                if (data.byteLength === 0) {
                    return {};
                }
                const buf = Buffer.isBuffer(data) ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
                parsed = JSON.parse(buf, reviver);
            }
            else {
                parsed = await parseJsonBody(data, this.serdeContext, schema);
            }
            return this._read(schema, parsed);
        }
        readObject(schema, data) {
            return this._read(schema, data);
        }
        _read(schema, value) {
            const isObject = value !== null && typeof value === "object";
            const ns = NormalizedSchema.of(schema);
            if (isObject) {
                if (ns.isStructSchema()) {
                    return this._readStruct(ns, value);
                }
                if (Array.isArray(value) && ns.isListSchema()) {
                    const listMember = ns.getValueSchema();
                    if (this.needsTransform(listMember)) {
                        for (let i = 0; i < value.length; ++i) {
                            value[i] = this._read(listMember, value[i]);
                        }
                    }
                    return value;
                }
                if (ns.isMapSchema()) {
                    const mapMember = ns.getValueSchema();
                    const map = value;
                    if (this.needsTransform(mapMember)) {
                        for (const k in map) {
                            if (k === "__proto__") {
                                writeKey(map);
                            }
                            map[k] = this._read(mapMember, map[k]);
                        }
                    }
                    return map;
                }
            }
            if (ns.isBlobSchema() && typeof value === "string") {
                return fromBase64(value);
            }
            const mediaType = ns.getMergedTraits().mediaType;
            if (ns.isStringSchema() && typeof value === "string" && mediaType) {
                const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
                if (isJson) {
                    return LazyJsonString.from(value);
                }
                return value;
            }
            if (ns.isTimestampSchema() && value != null) {
                const format = determineTimestampFormat(ns, this.settings);
                switch (format) {
                    case 5:
                        return parseRfc3339DateTimeWithOffset(value);
                    case 6:
                        return parseRfc7231DateTime(value);
                    case 7:
                        return parseEpochTimestamp(value);
                    default:
                        console.warn("Missing timestamp format, parsing value with Date constructor:", value);
                        return new Date(value);
                }
            }
            if (ns.isBigIntegerSchema() && (typeof value === "number" || typeof value === "string")) {
                return BigInt(value);
            }
            if (ns.isBigDecimalSchema() && value != undefined) {
                if (value instanceof NumericValue) {
                    return value;
                }
                const untyped = value;
                if (untyped.type === "bigDecimal" && "string" in untyped) {
                    return new NumericValue(untyped.string, untyped.type);
                }
                return new NumericValue(String(value), "bigDecimal");
            }
            if (ns.isNumericSchema() && typeof value === "string") {
                switch (value) {
                    case "Infinity":
                        return Infinity;
                    case "-Infinity":
                        return -Infinity;
                    case "NaN":
                        return NaN;
                }
                return value;
            }
            if (ns.isDocumentSchema()) {
                if (isObject) {
                    if (Array.isArray(value)) {
                        for (let i = 0; i < value.length; ++i) {
                            const v = value[i];
                            if (!(v instanceof NumericValue)) {
                                value[i] = this._read(ns, v);
                            }
                        }
                    }
                    else {
                        const doc = value;
                        for (const k in doc) {
                            if (k === "__proto__") {
                                writeKey(doc);
                            }
                            const v = doc[k];
                            if (!(v instanceof NumericValue)) {
                                doc[k] = this._read(ns, v);
                            }
                        }
                    }
                }
            }
            return value;
        }
        _readStruct(ns, record) {
            const union = ns.isUnionSchema();
            const out = {};
            let nameMap;
            const hasType = typeof record.__type === "string";
            const { jsonName } = this.settings;
            if (jsonName && hasType) {
                nameMap = {};
            }
            let unionSerde;
            if (union) {
                unionSerde = new UnionSerde(record, out);
            }
            for (const [memberName, memberSchema] of ns.structIterator()) {
                let fromKey = memberName;
                if (jsonName) {
                    fromKey = memberSchema.getMergedTraits().jsonName ?? fromKey;
                    if (hasType) {
                        nameMap[fromKey] = memberName;
                    }
                }
                if (union) {
                    unionSerde.mark(fromKey);
                }
                if (record[fromKey] != null) {
                    out[memberName] = this._read(memberSchema, record[fromKey]);
                }
            }
            if (union) {
                unionSerde.writeUnknown();
            }
            else if (hasType) {
                for (const k in record) {
                    const v = record[k];
                    const t = jsonName ? (nameMap[k] ?? k) : k;
                    if (!(t in out)) {
                        out[t] = v;
                    }
                }
            }
            return out;
        }
        needsTransform(ns) {
            if (ns.isBlobSchema() || ns.isTimestampSchema() || ns.isBigIntegerSchema() || ns.isBigDecimalSchema()) {
                return true;
            }
            if (ns.isDocumentSchema() || ns.isStructSchema() || ns.isListSchema() || ns.isMapSchema()) {
                return true;
            }
            if (ns.isStringSchema() && ns.getMergedTraits().mediaType) {
                return true;
            }
            return false;
        }
    }

    class JsonBytesStringAdapter extends Uint8Array {
        string = null;
        static allocUnsafe(bytes) {
            if (typeof Buffer === "function") {
                const buffer = Buffer.allocUnsafe(bytes);
                return new JsonBytesStringAdapter(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            }
            return new JsonBytesStringAdapter(bytes);
        }
        toString() {
            return this.s();
        }
        valueOf() {
            return this.s();
        }
        includes(searchString, position) {
            if (typeof searchString === "string") {
                return this.s().includes(searchString, position);
            }
            return Uint8Array.prototype.includes.call(this, searchString, position);
        }
        indexOf(searchString, position) {
            if (typeof searchString === "string") {
                return this.s().indexOf(searchString, position);
            }
            return Uint8Array.prototype.indexOf.call(this, searchString, position);
        }
        lastIndexOf(searchString, position) {
            if (typeof searchString === "string") {
                return this.s().lastIndexOf(searchString, position);
            }
            const fn = Uint8Array.prototype.lastIndexOf;
            if (position !== undefined) {
                return fn.call(this, searchString, position);
            }
            return fn.call(this, searchString);
        }
        startsWith(searchString, position) {
            return this.s().startsWith(searchString, position);
        }
        endsWith(searchString, endPosition) {
            return this.s().endsWith(searchString, endPosition);
        }
        match(regexp) {
            return this.s().match(regexp);
        }
        replace(searchValue, replaceValue) {
            return this.s().replace(searchValue, replaceValue);
        }
        search(regexp) {
            return this.s().search(regexp);
        }
        split(separator, limit) {
            return this.s().split(separator, limit);
        }
        substring(start, end) {
            return this.s().substring(start, end);
        }
        trim() {
            return this.s().trim();
        }
        trimStart() {
            return this.s().trimStart();
        }
        trimEnd() {
            return this.s().trimEnd();
        }
        charAt(pos) {
            return this.s().charAt(pos);
        }
        charCodeAt(index) {
            return this.s().charCodeAt(index);
        }
        padStart(maxLength, fillString) {
            return this.s().padStart(maxLength, fillString);
        }
        padEnd(maxLength, fillString) {
            return this.s().padEnd(maxLength, fillString);
        }
        repeat(count) {
            return this.s().repeat(count);
        }
        toUpperCase() {
            return this.s().toUpperCase();
        }
        toLowerCase() {
            return this.s().toLowerCase();
        }
        s() {
            if (this.string == null) {
                const n = Date.now();
                if (n > warned + 60_000) {
                    console.warn("@aws-sdk/core/protocols - WARN - JsonCodec2: you have called a string method on a Uint8Array request body. " +
                        "It has been automatically converted to string. In a future version this will throw an error.");
                    warned = n;
                }
                this.string = toUtf8(this);
            }
            return this.string;
        }
    }
    var warned = 0;

    const encoder = new TextEncoder();
    const OPEN_BRACE = 0x7b;
    const CLOSE_BRACE = 0x7d;
    const OPEN_BRACKET = 0x5b;
    const CLOSE_BRACKET = 0x5d;
    const QUOTE = 0x22;
    const COLON = 0x3a;
    const COMMA = 0x2c;
    const BACKSLASH = 0x5c;
    const TRUE = new Uint8Array([0x74, 0x72, 0x75, 0x65]);
    const FALSE = new Uint8Array([0x66, 0x61, 0x6c, 0x73, 0x65]);
    const NULL = new Uint8Array([0x6e, 0x75, 0x6c, 0x6c]);
    const ESCAPE_TABLE = new Array(128).fill(null);
    ESCAPE_TABLE[0x08] = "b";
    ESCAPE_TABLE[0x09] = "t";
    ESCAPE_TABLE[0x0a] = "n";
    ESCAPE_TABLE[0x0c] = "f";
    ESCAPE_TABLE[0x0d] = "r";
    ESCAPE_TABLE[0x22] = '"';
    ESCAPE_TABLE[0x5c] = "\\";
    for (let i = 0; i < 0x20; i++) {
        if (ESCAPE_TABLE[i] === null) {
            ESCAPE_TABLE[i] = "u00" + i.toString(16).padStart(2, "0");
        }
    }
    const INITIAL_BUFFER_SIZE = 2048;
    function alloc(size) {
        return JsonBytesStringAdapter.allocUnsafe(size);
    }
    class JsonShapeSerializer2 extends SerdeContextConfig {
        settings;
        json;
        i = 0;
        rootSchema;
        rawValue;
        passthrough = false;
        constructor(settings) {
            super();
            this.settings = settings;
            this.json = alloc(INITIAL_BUFFER_SIZE);
        }
        write(schema, value) {
            this.i = 0;
            this.rawValue = value;
            this.rootSchema = NormalizedSchema.of(schema);
            this.passthrough = this.rootSchema.isBlobSchema() || this.rootSchema.isStringSchema();
            if (!this.passthrough) {
                this.writeValue(this.rootSchema, value, undefined);
            }
        }
        writeDiscriminatedDocument(schema, value) {
            this.i = 0;
            this.rootSchema = NormalizedSchema.of(schema);
            const ns = this.rootSchema;
            if (ns.isStructSchema() && value != null && typeof value === "object") {
                this.writeValue(ns, value, undefined);
                const prefix = `"__type":"${ns.getName(true) ?? "Unknown"}",`;
                const z = prefix.length;
                this.ensure(z);
                this.json.copyWithin(1 + z, 1, this.i);
                encoder.encodeInto(prefix, this.json.subarray(1));
                this.i += z;
            }
            else {
                this.writeValue(ns, value, undefined);
            }
        }
        flush() {
            this.rootSchema = undefined;
            const finalPosition = this.i;
            this.i = 0;
            const raw = this.rawValue;
            this.rawValue = undefined;
            if (finalPosition === 0) {
                return raw;
            }
            const result = this.json.subarray(0, finalPosition);
            this.json = alloc(INITIAL_BUFFER_SIZE);
            return result;
        }
        ensure(byteCount) {
            const { i, json } = this;
            if (i + byteCount > json.length) {
                let newSize = json.length * 2;
                while (newSize < i + byteCount) {
                    newSize *= 2;
                }
                const next = alloc(newSize);
                next.set(this.json);
                this.json = next;
            }
        }
        writeAscii(s) {
            const z = s.length;
            this.ensure(z);
            let { i, json } = this;
            for (let j = 0; j < z; ++j) {
                json[i] = s.charCodeAt(j);
                i += 1;
            }
            this.i = i;
        }
        writeAsciiQuoted(s) {
            const z = s.length;
            this.ensure(z + 4);
            let { json, i } = this;
            json[i++] = QUOTE;
            for (let j = 0; j < z; ++j) {
                json[i++] = s.charCodeAt(j);
            }
            json[i++] = QUOTE;
            this.i = i;
        }
        writeJsonString(s) {
            this.ensure(s.length * 3 + 2);
            this.json[this.i++] = QUOTE;
            const z = s.length;
            for (let j = 0; j < z; ++j) {
                const c = s.charCodeAt(j);
                if (c > 0x22 && c < 0x5c) {
                    this.json[this.i++] = c;
                }
                else if (c < 0x80) {
                    const esc = ESCAPE_TABLE[c];
                    if (esc !== null) {
                        this.ensure(esc.length + 1);
                        this.json[this.i++] = BACKSLASH;
                        for (let k = 0; k < esc.length; k++) {
                            this.json[this.i++] = esc.charCodeAt(k);
                        }
                    }
                    else {
                        this.json[this.i++] = c;
                    }
                }
                else if (c >= 0xd800 && c <= 0xdbff) {
                    const next = j + 1 < z ? s.charCodeAt(j + 1) : 0;
                    if (next >= 0xdc00 && next <= 0xdfff) {
                        this.ensure(4);
                        const { written } = encoder.encodeInto(s.substring(j, j + 2), this.json.subarray(this.i));
                        this.i += written;
                        ++j;
                    }
                    else {
                        this.ensure(6);
                        this.writeUnicodeEscape(c);
                    }
                }
                else if (c >= 0xdc00 && c <= 0xdfff) {
                    this.ensure(6);
                    this.writeUnicodeEscape(c);
                }
                else {
                    let { i, json } = this;
                    if (c < 0x800) {
                        json[i++] = 0xc0 | (c >> 6);
                        json[i++] = 0x80 | (c & 0x3f);
                    }
                    else {
                        json[i++] = 0xe0 | (c >> 12);
                        json[i++] = 0x80 | ((c >> 6) & 0x3f);
                        json[i++] = 0x80 | (c & 0x3f);
                    }
                    this.i = i;
                }
            }
            this.json[this.i++] = QUOTE;
        }
        writeUnicodeEscape(code) {
            let { json, i } = this;
            json[i++] = BACKSLASH;
            json[i++] = 0x75;
            const hex = code.toString(16).padStart(4, "0");
            for (let j = 0; j < 4; ++j) {
                json[i++] = hex.charCodeAt(j);
            }
            this.i = i;
        }
        static B64 = (() => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            const table = new Uint8Array(64);
            for (let i = 0; i < 64; ++i) {
                table[i] = chars.charCodeAt(i);
            }
            return table;
        })();
        writeBase64(data) {
            const b64Len = Math.ceil(data.length / 3) * 4;
            this.ensure(b64Len + 2);
            const json = this.json;
            const B64 = JsonShapeSerializer2.B64;
            let i = this.i;
            json[i++] = QUOTE;
            const len = data.length;
            const remainder = len % 3;
            const mainLen = len - remainder;
            for (let j = 0; j < mainLen; j += 3) {
                const a = data[j];
                const b = data[j + 1];
                const c = data[j + 2];
                json[i++] = B64[a >> 2];
                json[i++] = B64[((a & 0x03) << 4) | (b >> 4)];
                json[i++] = B64[((b & 0x0f) << 2) | (c >> 6)];
                json[i++] = B64[c & 0x3f];
            }
            if (remainder === 2) {
                const a = data[mainLen];
                const b = data[mainLen + 1];
                json[i++] = B64[a >> 2];
                json[i++] = B64[((a & 0x03) << 4) | (b >> 4)];
                json[i++] = B64[(b & 0x0f) << 2];
                json[i++] = 0x3d;
            }
            else if (remainder === 1) {
                const a = data[mainLen];
                json[i++] = B64[a >> 2];
                json[i++] = B64[(a & 0x03) << 4];
                json[i++] = 0x3d;
                json[i++] = 0x3d;
            }
            json[i++] = QUOTE;
            this.i = i;
        }
        writeValue(schema, value, container) {
            if (value == null) {
                if (container?.isStructSchema()) {
                    if (value === undefined) {
                        const ns = NormalizedSchema.of(schema);
                        if (ns.isIdempotencyToken()) {
                            this.writeAsciiQuoted(generateIdempotencyToken());
                            return;
                        }
                    }
                    return;
                }
                this.ensure(4);
                this.json.set(NULL, this.i);
                this.i += 4;
                return;
            }
            const ns = NormalizedSchema.of(schema);
            const isObject = typeof value === "object";
            if (ns.isStringSchema()) {
                const mediaType = ns.getMergedTraits().mediaType;
                if (mediaType) {
                    const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
                    if (isJson) {
                        this.writeJsonString(LazyJsonString.from(value).toString());
                        return;
                    }
                }
            }
            if (isObject) {
                if (ns.isStructSchema()) {
                    this.writeStruct(ns, value);
                    return;
                }
                if (Array.isArray(value) && (ns.isListSchema() || ns.isDocumentSchema())) {
                    this.writeList(ns, value, ns.isDocumentSchema());
                    return;
                }
                if (ns.isMapSchema()) {
                    this.writeMap(ns, value, false);
                    return;
                }
                if (value instanceof Uint8Array && (ns.isBlobSchema() || ns.isDocumentSchema())) {
                    this.writeBase64(value);
                    return;
                }
                if (value instanceof Date && (ns.isTimestampSchema() || ns.isDocumentSchema())) {
                    this.writeTimestamp(ns, value);
                    return;
                }
                if (value instanceof NumericValue) {
                    this.writeAscii(value.string);
                    return;
                }
                if (ns.isDocumentSchema()) {
                    if (Array.isArray(value)) {
                        this.writeList(ns, value, true);
                    }
                    else {
                        this.writeMap(ns, value, true);
                    }
                    return;
                }
                const json = JSON.stringify(value);
                this.writeAscii(json);
                return;
            }
            if (typeof value === "string") {
                if (ns.isBlobSchema()) {
                    const b64 = (this.serdeContext?.base64Encoder ?? toBase64)(value);
                    this.writeAsciiQuoted(b64);
                    return;
                }
                this.writeJsonString(value);
                return;
            }
            if (typeof value === "number") {
                if (Math.abs(value) === Infinity || Number.isNaN(value)) {
                    this.writeAsciiQuoted(String(value));
                    return;
                }
                const numStr = String(value);
                this.writeAscii(numStr);
                return;
            }
            if (typeof value === "boolean") {
                this.ensure(5);
                let { i, json } = this;
                if (value) {
                    json.set(TRUE, i);
                    i += 4;
                }
                else {
                    json.set(FALSE, i);
                    i += 5;
                }
                this.i = i;
                return;
            }
            if (typeof value === "bigint") {
                this.writeAscii(value.toString());
                return;
            }
            this.writeAscii(String(value));
        }
        writeStruct(ns, value) {
            this.ensure(2);
            this.json[this.i++] = OPEN_BRACE;
            let wroteAny = false;
            const hasType = typeof value.__type === "string";
            let writtenKeys;
            if (hasType) {
                writtenKeys = new Set();
            }
            for (const [memberName, memberSchema] of ns.structIterator()) {
                const item = value[memberName];
                if (item == null && !memberSchema.isIdempotencyToken()) {
                    continue;
                }
                if (wroteAny) {
                    this.ensure(1);
                    this.json[this.i++] = COMMA;
                }
                wroteAny = true;
                const targetKey = this.settings.jsonName ? (memberSchema.getMergedTraits().jsonName ?? memberName) : memberName;
                if (writtenKeys) {
                    writtenKeys.add(memberName);
                    writtenKeys.add(targetKey);
                }
                this.writeAsciiQuoted(targetKey);
                this.json[this.i++] = COLON;
                this.writeValue(memberSchema, item, ns);
            }
            if (!wroteAny && ns.isUnionSchema()) {
                const { $unknown } = value;
                if (Array.isArray($unknown)) {
                    const [k, v] = $unknown;
                    this.writeAsciiQuoted(k);
                    this.ensure(1);
                    this.json[this.i++] = COLON;
                    this.writeValue(15, v, ns);
                }
            }
            else if (hasType) {
                for (const k in value) {
                    if (writtenKeys.has(k)) {
                        continue;
                    }
                    writtenKeys.add(k);
                    const v = value[k];
                    if (wroteAny) {
                        this.ensure(1);
                        this.json[this.i++] = COMMA;
                    }
                    wroteAny = true;
                    this.writeAsciiQuoted(k);
                    this.ensure(1);
                    this.json[this.i++] = COLON;
                    this.writeValue(15, v, undefined);
                }
            }
            this.ensure(1);
            this.json[this.i++] = CLOSE_BRACE;
        }
        writeList(ns, value, isDocument) {
            const sparse = !!ns.getMergedTraits().sparse;
            const valueSchema = ns.getValueSchema();
            if (!isDocument) {
                if (valueSchema.isStringSchema() || valueSchema.isNumericSchema() || valueSchema.isBooleanSchema()) {
                    let hasSpecials = false;
                    for (let i = 0; i < value.length; ++i) {
                        const v = value[i];
                        if (Number.isNaN(v) || v === Infinity || v === -Infinity || (v == null && !sparse)) {
                            hasSpecials = true;
                            break;
                        }
                    }
                    let json;
                    if (!hasSpecials) {
                        json = JSON.stringify(value);
                    }
                    else {
                        const out = [];
                        for (let i = 0; i < value.length; ++i) {
                            const v = value[i];
                            if (v == null && !sparse)
                                continue;
                            if (Number.isNaN(v) || v === Infinity || v === -Infinity) {
                                out.push(String(v));
                            }
                            else {
                                out.push(v);
                            }
                        }
                        json = JSON.stringify(out);
                    }
                    this.ensure(json.length * 3);
                    this.i += encoder.encodeInto(json, this.json.subarray(this.i)).written;
                    return;
                }
            }
            this.ensure(2);
            this.json[this.i++] = OPEN_BRACKET;
            let wroteFirstItem = false;
            for (let i = 0; i < value.length; ++i) {
                const item = value[i];
                if (isDocument ? item === undefined : item == null && !sparse) {
                    continue;
                }
                if (wroteFirstItem) {
                    this.ensure(1);
                    this.json[this.i++] = COMMA;
                }
                this.writeValue(valueSchema, item, undefined);
                wroteFirstItem = true;
            }
            this.ensure(1);
            this.json[this.i++] = CLOSE_BRACKET;
        }
        writeMap(ns, value, isDocument) {
            const sparse = !!ns.getMergedTraits().sparse;
            const valueSchema = ns.getValueSchema();
            if (!isDocument) {
                if (valueSchema.isStringSchema() || valueSchema.isNumericSchema() || valueSchema.isBooleanSchema()) {
                    let modifications;
                    for (const k in value) {
                        const v = value[k];
                        if (Number.isNaN(v) || v === Infinity || v === -Infinity) {
                            (modifications ??= {})[k] = v;
                            value[k] = String(v);
                        }
                        else if (v === null && !sparse) {
                            (modifications ??= {})[k] = null;
                            value[k] = undefined;
                        }
                    }
                    const json = JSON.stringify(value);
                    if (modifications) {
                        Object.assign(value, modifications);
                    }
                    this.ensure(json.length * 3);
                    this.i += encoder.encodeInto(json, this.json.subarray(this.i)).written;
                    return;
                }
            }
            this.ensure(2);
            this.json[this.i++] = OPEN_BRACE;
            let first = true;
            for (const k in value) {
                const v = value[k];
                if (isDocument ? v === undefined : v == null && !sparse) {
                    continue;
                }
                if (!first) {
                    this.ensure(1);
                    this.json[this.i++] = COMMA;
                }
                first = false;
                this.writeJsonString(k);
                this.ensure(1);
                this.json[this.i++] = COLON;
                this.writeValue(valueSchema, v, undefined);
            }
            this.ensure(1);
            this.json[this.i++] = CLOSE_BRACE;
        }
        writeTimestamp(ns, value) {
            const format = determineTimestampFormat(ns, this.settings);
            switch (format) {
                case 5: {
                    const iso = value.toISOString().replace(".000Z", "Z");
                    this.writeAsciiQuoted(iso);
                    return;
                }
                case 6: {
                    this.writeAsciiQuoted(dateToUtcString(value));
                    return;
                }
                case 7: {
                    const epochSecs = String(value.getTime() / 1000);
                    this.writeAscii(epochSecs);
                    return;
                }
                default: {
                    const epochSecs = String(value.getTime() / 1000);
                    this.writeAscii(epochSecs);
                    return;
                }
            }
        }
    }

    class JsonCodec2 extends SerdeContextConfig {
        settings;
        constructor(settings) {
            super();
            this.settings = settings;
        }
        createSerializer() {
            const serializer = new JsonShapeSerializer2(this.settings);
            serializer.setSerdeContext(this.serdeContext);
            return serializer;
        }
        createDeserializer() {
            const deserializer = new JsonShapeDeserializer2(this.settings);
            deserializer.setSerdeContext(this.serdeContext);
            return deserializer;
        }
    }

    class AwsRestJsonProtocol extends HttpBindingProtocol {
        serializer;
        deserializer;
        codec;
        mixin = new ProtocolLib();
        constructor({ defaultNamespace, errorTypeRegistries, jsonCodec, }) {
            super({
                defaultNamespace,
                errorTypeRegistries,
            });
            const settings = {
                timestampFormat: {
                    useTrait: true,
                    default: 7,
                },
                httpBindings: true,
                jsonName: true,
            };
            this.codec = jsonCodec ?? new JsonCodec2(settings);
            this.serializer = new HttpInterceptingShapeSerializer(this.codec.createSerializer(), settings);
            this.deserializer = new HttpInterceptingShapeDeserializer(this.codec.createDeserializer(), settings);
        }
        getShapeId() {
            return "aws.protocols#restJson1";
        }
        getPayloadCodec() {
            return this.codec;
        }
        setSerdeContext(serdeContext) {
            this.codec.setSerdeContext(serdeContext);
            super.setSerdeContext(serdeContext);
        }
        async serializeRequest(operationSchema, input, context) {
            const request = await super.serializeRequest(operationSchema, input, context);
            const inputSchema = NormalizedSchema.of(operationSchema.input);
            if (!request.headers["content-type"]) {
                const contentType = this.mixin.resolveRestContentType(this.getDefaultContentType(), inputSchema);
                if (contentType) {
                    request.headers["content-type"] = contentType;
                }
            }
            if (request.body == null && request.headers["content-type"] === this.getDefaultContentType()) {
                request.body = "{}";
            }
            return request;
        }
        async deserializeResponse(operationSchema, context, response) {
            const output = await super.deserializeResponse(operationSchema, context, response);
            const outputSchema = NormalizedSchema.of(operationSchema.output);
            for (const [name, member] of outputSchema.structIterator()) {
                if (member.getMemberTraits().httpPayload && !(name in output)) {
                    output[name] = null;
                }
            }
            return output;
        }
        async handleError(operationSchema, context, response, dataObject, metadata) {
            const errorIdentifier = loadRestJsonErrorCode(response, dataObject) ?? "Unknown";
            this.mixin.compose(this.compositeErrorRegistry, errorIdentifier, this.options.defaultNamespace);
            const { errorSchema, errorMetadata } = await this.mixin.getErrorSchemaOrThrowBaseException(errorIdentifier, this.options.defaultNamespace, response, dataObject, metadata);
            const ns = NormalizedSchema.of(errorSchema);
            const message = dataObject.message ?? dataObject.Message ?? "UnknownError";
            const ErrorCtor = this.compositeErrorRegistry.getErrorCtor(errorSchema) ?? Error;
            const exception = new ErrorCtor({});
            await this.deserializeHttpMessage(errorSchema, context, response, dataObject);
            const output = {};
            const errorDeserializer = this.codec.createDeserializer();
            for (const [name, member] of ns.structIterator()) {
                const target = member.getMergedTraits().jsonName ?? name;
                output[name] = errorDeserializer.readObject(member, dataObject[target]);
            }
            throw this.mixin.decorateServiceException(Object.assign(exception, errorMetadata, {
                $fault: ns.getMergedTraits().error,
                message,
            }, output), dataObject);
        }
        getDefaultContentType() {
            return "application/json";
        }
    }

    const k = "ref";
    const a = -1, b = true, c = "isSet", d = "PartitionResult", e = "booleanEquals", f = "getAttr", g = { [k]: "Endpoint" }, h = { [k]: d }, i = {}, j = [{ [k]: "Region" }];
    const _data = {
        conditions: [
            [c, [g]],
            [c, j],
            ["aws.partition", j, d],
            [e, [{ [k]: "UseFIPS" }, b]],
            [e, [{ [k]: "UseDualStack" }, b]],
            [e, [{ fn: f, argv: [h, "supportsDualStack"] }, b]],
            [e, [{ fn: f, argv: [h, "supportsFIPS"] }, b]]
        ],
        results: [
            [a],
            [a, "Invalid Configuration: FIPS and custom endpoint are not supported"],
            [a, "Invalid Configuration: Dualstack and custom endpoint are not supported"],
            [g, i],
            ["https://transcribestreaming-fips.{Region}.{PartitionResult#dualStackDnsSuffix}", i],
            [a, "FIPS and DualStack are enabled, but this partition does not support one or both"],
            ["https://transcribestreaming-fips.{Region}.{PartitionResult#dnsSuffix}", i],
            [a, "FIPS is enabled but this partition does not support FIPS"],
            ["https://transcribestreaming.{Region}.{PartitionResult#dualStackDnsSuffix}", i],
            [a, "DualStack is enabled but this partition does not support DualStack"],
            ["https://transcribestreaming.{Region}.{PartitionResult#dnsSuffix}", i],
            [a, "Invalid Configuration: Missing Region"]
        ]
    };
    const root = 2;
    const r = 100_000_000;
    const nodes = new Int32Array([
        -1, 1, -1,
        0, 12, 3,
        1, 4, r + 11,
        2, 5, r + 11,
        3, 8, 6,
        4, 7, r + 10,
        5, r + 8, r + 9,
        4, 10, 9,
        6, r + 6, r + 7,
        5, 11, r + 5,
        6, r + 4, r + 5,
        3, r + 1, 13,
        4, r + 2, r + 3,
    ]);
    const bdd = BinaryDecisionDiagram.from(nodes, root, _data.conditions, _data.results);

    const cache = new EndpointCache({
        size: 50,
        params: ["Endpoint", "Region", "UseDualStack", "UseFIPS"],
    });
    const defaultEndpointResolver = (endpointParams, context = {}) => {
        return cache.get(endpointParams, () => decideEndpoint(bdd, {
            endpointParams: endpointParams,
            logger: context.logger,
        }));
    };
    customEndpointFunctions.aws = awsEndpointFunctions;

    class TranscribeStreamingServiceException extends ServiceException {
        constructor(options) {
            super(options);
            Object.setPrototypeOf(this, TranscribeStreamingServiceException.prototype);
        }
    }

    class BadRequestException extends TranscribeStreamingServiceException {
        name = "BadRequestException";
        $fault = "client";
        Message;
        constructor(opts) {
            super({
                name: "BadRequestException",
                $fault: "client",
                ...opts,
            });
            Object.setPrototypeOf(this, BadRequestException.prototype);
            this.Message = opts.Message;
        }
    }
    class ConflictException extends TranscribeStreamingServiceException {
        name = "ConflictException";
        $fault = "client";
        Message;
        constructor(opts) {
            super({
                name: "ConflictException",
                $fault: "client",
                ...opts,
            });
            Object.setPrototypeOf(this, ConflictException.prototype);
            this.Message = opts.Message;
        }
    }
    class InternalFailureException extends TranscribeStreamingServiceException {
        name = "InternalFailureException";
        $fault = "server";
        Message;
        constructor(opts) {
            super({
                name: "InternalFailureException",
                $fault: "server",
                ...opts,
            });
            Object.setPrototypeOf(this, InternalFailureException.prototype);
            this.Message = opts.Message;
        }
    }
    class LimitExceededException extends TranscribeStreamingServiceException {
        name = "LimitExceededException";
        $fault = "client";
        Message;
        constructor(opts) {
            super({
                name: "LimitExceededException",
                $fault: "client",
                ...opts,
            });
            Object.setPrototypeOf(this, LimitExceededException.prototype);
            this.Message = opts.Message;
        }
    }
    class ServiceUnavailableException extends TranscribeStreamingServiceException {
        name = "ServiceUnavailableException";
        $fault = "server";
        Message;
        constructor(opts) {
            super({
                name: "ServiceUnavailableException",
                $fault: "server",
                ...opts,
            });
            Object.setPrototypeOf(this, ServiceUnavailableException.prototype);
            this.Message = opts.Message;
        }
    }
    class ResourceNotFoundException extends TranscribeStreamingServiceException {
        name = "ResourceNotFoundException";
        $fault = "client";
        Message;
        constructor(opts) {
            super({
                name: "ResourceNotFoundException",
                $fault: "client",
                ...opts,
            });
            Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
            this.Message = opts.Message;
        }
    }

    const _A = "Alternative";
    const _AC = "AudioChunk";
    const _AE = "AudioEvent";
    const _AL = "AlternativeList";
    const _AS = "AudioStream";
    const _Al = "Alternatives";
    const _BRE = "BadRequestException";
    const _C = "Category";
    const _CD = "ChannelDefinition";
    const _CDh = "ChannelDefinitions";
    const _CE = "ConflictException";
    const _CEo = "ConfigurationEvent";
    const _CI = "ChannelId";
    const _CIT = "ContentIdentificationType";
    const _CRO = "ContentRedactionOutput";
    const _CRT = "ContentRedactionType";
    const _Co = "Content";
    const _Con = "Confidence";
    const _DARA = "DataAccessRoleArn";
    const _E = "Entities";
    const _ECI = "EnableChannelIdentification";
    const _EL = "EntityList";
    const _EPRS = "EnablePartialResultsStabilization";
    const _ET = "EndTime";
    const _Ent = "Entity";
    const _I = "Items";
    const _IFE = "InternalFailureException";
    const _IL = "IdentifyLanguage";
    const _ILt = "ItemList";
    const _IML = "IdentifyMultipleLanguages";
    const _IP = "IsPartial";
    const _It = "Item";
    const _LC = "LanguageCode";
    const _LEE = "LimitExceededException";
    const _LI = "LanguageIdentification";
    const _LMN = "LanguageModelName";
    const _LO = "LanguageOptions";
    const _LWS = "LanguageWithScore";
    const _M = "Message";
    const _MEe = "MediaEncoding";
    const _MSRH = "MediaSampleRateHertz";
    const _NOC = "NumberOfChannels";
    const _OEKMSKI = "OutputEncryptionKMSKeyId";
    const _OL = "OutputLocation";
    const _PCAS = "PostCallAnalyticsSettings";
    const _PET = "PiiEntityTypes";
    const _PL = "PreferredLanguage";
    const _PR = "ParticipantRole";
    const _PRS = "PartialResultsStability";
    const _R = "Results";
    const _RI = "ResultId";
    const _RIe = "RequestId";
    const _RL = "ResultList";
    const _RNFE = "ResourceNotFoundException";
    const _Re = "Result";
    const _S = "Stable";
    const _SI = "SessionId";
    const _SRW = "SessionResumeWindow";
    const _SSL = "ShowSpeakerLabel";
    const _SST = "StartStreamTranscription";
    const _SSTR = "StartStreamTranscriptionRequest";
    const _SSTRt = "StartStreamTranscriptionResponse";
    const _ST = "StartTime";
    const _SUE = "ServiceUnavailableException";
    const _Sc = "Score";
    const _Sp = "Speaker";
    const _T = "Transcript";
    const _TE = "TranscriptEvent";
    const _TF = "TranscriptFormat";
    const _TRS = "TranscriptResultStream";
    const _Ty = "Type";
    const _VFM = "VocabularyFilterMatch";
    const _VFMo = "VocabularyFilterMethod";
    const _VFN = "VocabularyFilterName";
    const _VFNo = "VocabularyFilterNames";
    const _VN = "VocabularyName";
    const _VNo = "VocabularyNames";
    const _c = "client";
    const _e = "error";
    const _eP = "eventPayload";
    const _h = "http";
    const _hE = "httpError";
    const _hH = "httpHeader";
    const _s = "smithy.ts.sdk.synthetic.com.amazonaws.transcribestreaming";
    const _se = "server";
    const _st = "streaming";
    const _xari = "x-amzn-request-id";
    const _xatcit = "x-amzn-transcribe-content-identification-type";
    const _xatcrt = "x-amzn-transcribe-content-redaction-type";
    const _xateci = "x-amzn-transcribe-enable-channel-identification";
    const _xateprs = "x-amzn-transcribe-enable-partial-results-stabilization";
    const _xatil = "x-amzn-transcribe-identify-language";
    const _xatiml = "x-amzn-transcribe-identify-multiple-languages";
    const _xatlc = "x-amzn-transcribe-language-code";
    const _xatlmn = "x-amzn-transcribe-language-model-name";
    const _xatlo = "x-amzn-transcribe-language-options";
    const _xatme = "x-amzn-transcribe-media-encoding";
    const _xatnoc = "x-amzn-transcribe-number-of-channels";
    const _xatpet = "x-amzn-transcribe-pii-entity-types";
    const _xatpl = "x-amzn-transcribe-preferred-language";
    const _xatprs = "x-amzn-transcribe-partial-results-stability";
    const _xatsi = "x-amzn-transcribe-session-id";
    const _xatsr = "x-amzn-transcribe-sample-rate";
    const _xatsrw = "x-amzn-transcribe-session-resume-window";
    const _xatssl = "x-amzn-transcribe-show-speaker-label";
    const _xattf = "x-amzn-transcribe-transcript-format";
    const _xatvfm = "x-amzn-transcribe-vocabulary-filter-method";
    const _xatvfn = "x-amzn-transcribe-vocabulary-filter-name";
    const _xatvfn_ = "x-amzn-transcribe-vocabulary-filter-names";
    const _xatvn = "x-amzn-transcribe-vocabulary-name";
    const _xatvn_ = "x-amzn-transcribe-vocabulary-names";
    const n0 = "com.amazonaws.transcribestreaming";
    const _s_registry = TypeRegistry.for(_s);
    var TranscribeStreamingServiceException$ = [-3, _s, "TranscribeStreamingServiceException", 0, [], []];
    _s_registry.registerError(TranscribeStreamingServiceException$, TranscribeStreamingServiceException);
    const n0_registry = TypeRegistry.for(n0);
    var BadRequestException$ = [-3, n0, _BRE,
        { [_e]: _c, [_hE]: 400 },
        [_M],
        [0]
    ];
    n0_registry.registerError(BadRequestException$, BadRequestException);
    var ConflictException$ = [-3, n0, _CE,
        { [_e]: _c, [_hE]: 409 },
        [_M],
        [0]
    ];
    n0_registry.registerError(ConflictException$, ConflictException);
    var InternalFailureException$ = [-3, n0, _IFE,
        { [_e]: _se, [_hE]: 500 },
        [_M],
        [0]
    ];
    n0_registry.registerError(InternalFailureException$, InternalFailureException);
    var LimitExceededException$ = [-3, n0, _LEE,
        { [_e]: _c, [_hE]: 429 },
        [_M],
        [0]
    ];
    n0_registry.registerError(LimitExceededException$, LimitExceededException);
    var ResourceNotFoundException$ = [-3, n0, _RNFE,
        { [_e]: _c, [_hE]: 404 },
        [_M],
        [0]
    ];
    n0_registry.registerError(ResourceNotFoundException$, ResourceNotFoundException);
    var ServiceUnavailableException$ = [-3, n0, _SUE,
        { [_e]: _se, [_hE]: 503 },
        [_M],
        [0]
    ];
    n0_registry.registerError(ServiceUnavailableException$, ServiceUnavailableException);
    const errorTypeRegistries = [
        _s_registry,
        n0_registry,
    ];
    var Alternative$ = [3, n0, _A,
        0,
        [_T, _I, _E],
        [0, () => ItemList, () => EntityList]
    ];
    var AudioEvent$ = [3, n0, _AE,
        0,
        [_AC],
        [[21, { [_eP]: 1 }]]
    ];
    var ChannelDefinition$ = [3, n0, _CD,
        0,
        [_CI, _PR],
        [1, 0], 2
    ];
    var ConfigurationEvent$ = [3, n0, _CEo,
        0,
        [_CDh, _PCAS],
        [() => ChannelDefinitions, () => PostCallAnalyticsSettings$]
    ];
    var Entity$ = [3, n0, _Ent,
        0,
        [_ST, _ET, _C, _Ty, _Co, _Con],
        [1, 1, 0, 0, 0, 1]
    ];
    var Item$ = [3, n0, _It,
        0,
        [_ST, _ET, _Ty, _Co, _VFM, _Sp, _Con, _S],
        [1, 1, 0, 0, 2, 0, 1, 2]
    ];
    var LanguageWithScore$ = [3, n0, _LWS,
        0,
        [_LC, _Sc],
        [0, 1]
    ];
    var PostCallAnalyticsSettings$ = [3, n0, _PCAS,
        0,
        [_OL, _DARA, _CRO, _OEKMSKI],
        [0, 0, 0, 0], 2
    ];
    var Result$ = [3, n0, _Re,
        0,
        [_RI, _ST, _ET, _IP, _Al, _CI, _LC, _LI],
        [0, 1, 1, 2, () => AlternativeList, 0, 0, () => LanguageIdentification]
    ];
    var StartStreamTranscriptionRequest$ = [3, n0, _SSTR,
        0,
        [_MSRH, _MEe, _AS, _LC, _VN, _SI, _VFN, _VFMo, _SSL, _ECI, _NOC, _EPRS, _PRS, _CIT, _CRT, _PET, _LMN, _IL, _LO, _PL, _IML, _VNo, _VFNo, _SRW, _TF],
        [[1, { [_hH]: _xatsr }], [0, { [_hH]: _xatme }], [() => AudioStream$, 16], [0, { [_hH]: _xatlc }], [0, { [_hH]: _xatvn }], [0, { [_hH]: _xatsi }], [0, { [_hH]: _xatvfn }], [0, { [_hH]: _xatvfm }], [2, { [_hH]: _xatssl }], [2, { [_hH]: _xateci }], [1, { [_hH]: _xatnoc }], [2, { [_hH]: _xateprs }], [0, { [_hH]: _xatprs }], [0, { [_hH]: _xatcit }], [0, { [_hH]: _xatcrt }], [0, { [_hH]: _xatpet }], [0, { [_hH]: _xatlmn }], [2, { [_hH]: _xatil }], [0, { [_hH]: _xatlo }], [0, { [_hH]: _xatpl }], [2, { [_hH]: _xatiml }], [0, { [_hH]: _xatvn_ }], [0, { [_hH]: _xatvfn_ }], [1, { [_hH]: _xatsrw }], [0, { [_hH]: _xattf }]], 3
    ];
    var StartStreamTranscriptionResponse$ = [3, n0, _SSTRt,
        0,
        [_RIe, _LC, _MSRH, _MEe, _VN, _SI, _TRS, _VFN, _VFMo, _SSL, _ECI, _NOC, _EPRS, _PRS, _CIT, _CRT, _PET, _LMN, _IL, _LO, _PL, _IML, _VNo, _VFNo, _SRW, _TF],
        [[0, { [_hH]: _xari }], [0, { [_hH]: _xatlc }], [1, { [_hH]: _xatsr }], [0, { [_hH]: _xatme }], [0, { [_hH]: _xatvn }], [0, { [_hH]: _xatsi }], [() => TranscriptResultStream$, 16], [0, { [_hH]: _xatvfn }], [0, { [_hH]: _xatvfm }], [2, { [_hH]: _xatssl }], [2, { [_hH]: _xateci }], [1, { [_hH]: _xatnoc }], [2, { [_hH]: _xateprs }], [0, { [_hH]: _xatprs }], [0, { [_hH]: _xatcit }], [0, { [_hH]: _xatcrt }], [0, { [_hH]: _xatpet }], [0, { [_hH]: _xatlmn }], [2, { [_hH]: _xatil }], [0, { [_hH]: _xatlo }], [0, { [_hH]: _xatpl }], [2, { [_hH]: _xatiml }], [0, { [_hH]: _xatvn_ }], [0, { [_hH]: _xatvfn_ }], [1, { [_hH]: _xatsrw }], [0, { [_hH]: _xattf }]]
    ];
    var Transcript$ = [3, n0, _T,
        0,
        [_R],
        [() => ResultList]
    ];
    var TranscriptEvent$ = [3, n0, _TE,
        0,
        [_T],
        [() => Transcript$]
    ];
    var AlternativeList = [1, n0, _AL,
        0, () => Alternative$
    ];
    var ChannelDefinitions = [1, n0, _CDh,
        0, () => ChannelDefinition$
    ];
    var EntityList = [1, n0, _EL,
        0, () => Entity$
    ];
    var ItemList = [1, n0, _ILt,
        0, () => Item$
    ];
    var LanguageIdentification = [1, n0, _LI,
        0, () => LanguageWithScore$
    ];
    var ResultList = [1, n0, _RL,
        0, () => Result$
    ];
    var AudioStream$ = [4, n0, _AS,
        { [_st]: 1 },
        [_AE, _CEo],
        [[() => AudioEvent$, 0], () => ConfigurationEvent$]
    ];
    var TranscriptResultStream$ = [4, n0, _TRS,
        { [_st]: 1 },
        [_TE, _BRE, _LEE, _IFE, _CE, _SUE],
        [() => TranscriptEvent$, [() => BadRequestException$, 0], [() => LimitExceededException$, 0], [() => InternalFailureException$, 0], [() => ConflictException$, 0], [() => ServiceUnavailableException$, 0]]
    ];
    var StartStreamTranscription$ = [9, n0, _SST,
        { [_h]: ["POST", "/stream-transcription", 200] }, () => StartStreamTranscriptionRequest$, () => StartStreamTranscriptionResponse$
    ];

    const getRuntimeConfig$1 = (config) => {
        return {
            apiVersion: "2017-10-26",
            base64Decoder: config?.base64Decoder ?? fromBase64,
            base64Encoder: config?.base64Encoder ?? toBase64,
            disableHostPrefix: config?.disableHostPrefix ?? false,
            endpointProvider: config?.endpointProvider ?? defaultEndpointResolver,
            extensions: config?.extensions ?? [],
            httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? defaultTranscribeStreamingHttpAuthSchemeProvider,
            httpAuthSchemes: config?.httpAuthSchemes ?? [
                {
                    schemeId: "aws.auth#sigv4",
                    identityProvider: (ipc) => ipc.getIdentityProvider("aws.auth#sigv4"),
                    signer: new AwsSdkSigV4Signer(),
                },
            ],
            logger: config?.logger ?? new NoOpLogger(),
            protocol: config?.protocol ?? AwsRestJsonProtocol,
            protocolSettings: config?.protocolSettings ?? {
                defaultNamespace: "com.amazonaws.transcribestreaming",
                errorTypeRegistries,
                version: "2017-10-26",
                serviceTarget: "Transcribe",
            },
            serviceId: config?.serviceId ?? "Transcribe Streaming",
            sha256: config?.sha256 ?? Sha256WebCrypto,
            urlParser: config?.urlParser ?? parseUrl,
            utf8Decoder: config?.utf8Decoder ?? fromUtf8,
            utf8Encoder: config?.utf8Encoder ?? toUtf8,
        };
    };

    const getRuntimeConfig = (config) => {
        const defaultsMode = resolveDefaultsModeConfig(config);
        const defaultConfigProvider = () => defaultsMode().then(loadConfigsForDefaultMode);
        const clientSharedValues = getRuntimeConfig$1(config);
        return {
            ...clientSharedValues,
            ...config,
            runtime: "browser",
            defaultsMode,
            bodyLengthChecker: config?.bodyLengthChecker ?? calculateBodyLength,
            credentialDefaultProvider: config?.credentialDefaultProvider ?? ((_) => () => Promise.reject(new Error("Credential is missing"))),
            defaultUserAgentProvider: config?.defaultUserAgentProvider ?? createDefaultUserAgentProvider({ serviceId: clientSharedValues.serviceId, clientVersion: packageInfo.version }),
            eventStreamPayloadHandlerProvider: config?.eventStreamPayloadHandlerProvider ?? (() => eventStreamPayloadHandler),
            eventStreamSerdeProvider: config?.eventStreamSerdeProvider ?? eventStreamSerdeProvider,
            maxAttempts: config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            region: config?.region ?? invalidProvider("Region is missing"),
            requestHandler: WebSocketFetchHandler.create(config?.requestHandler
                ?? defaultConfigProvider, FetchHttpHandler.create(defaultConfigProvider)),
            retryMode: config?.retryMode ?? (async () => (await defaultConfigProvider()).retryMode || DEFAULT_RETRY_MODE),
            streamCollector: config?.streamCollector ?? streamCollector,
            useDualstackEndpoint: config?.useDualstackEndpoint ?? (() => Promise.resolve(DEFAULT_USE_DUALSTACK_ENDPOINT)),
            useFipsEndpoint: config?.useFipsEndpoint ?? (() => Promise.resolve(DEFAULT_USE_FIPS_ENDPOINT)),
        };
    };

    const getHttpAuthExtensionConfiguration = (runtimeConfig) => {
        const _httpAuthSchemes = runtimeConfig.httpAuthSchemes;
        let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider;
        let _credentials = runtimeConfig.credentials;
        return {
            setHttpAuthScheme(httpAuthScheme) {
                const index = _httpAuthSchemes.findIndex((scheme) => scheme.schemeId === httpAuthScheme.schemeId);
                if (index === -1) {
                    _httpAuthSchemes.push(httpAuthScheme);
                }
                else {
                    _httpAuthSchemes.splice(index, 1, httpAuthScheme);
                }
            },
            httpAuthSchemes() {
                return _httpAuthSchemes;
            },
            setHttpAuthSchemeProvider(httpAuthSchemeProvider) {
                _httpAuthSchemeProvider = httpAuthSchemeProvider;
            },
            httpAuthSchemeProvider() {
                return _httpAuthSchemeProvider;
            },
            setCredentials(credentials) {
                _credentials = credentials;
            },
            credentials() {
                return _credentials;
            },
        };
    };
    const resolveHttpAuthRuntimeConfig = (config) => {
        return {
            httpAuthSchemes: config.httpAuthSchemes(),
            httpAuthSchemeProvider: config.httpAuthSchemeProvider(),
            credentials: config.credentials(),
        };
    };

    const resolveRuntimeExtensions = (runtimeConfig, extensions) => {
        const extensionConfiguration = Object.assign(getAwsRegionExtensionConfiguration(runtimeConfig), getDefaultExtensionConfiguration(runtimeConfig), getHttpHandlerExtensionConfiguration(runtimeConfig), getHttpAuthExtensionConfiguration(runtimeConfig));
        extensions.forEach((extension) => extension.configure(extensionConfiguration));
        return Object.assign(runtimeConfig, resolveAwsRegionExtensionConfiguration(extensionConfiguration), resolveDefaultRuntimeConfig(extensionConfiguration), resolveHttpHandlerRuntimeConfig(extensionConfiguration), resolveHttpAuthRuntimeConfig(extensionConfiguration));
    };

    class TranscribeStreamingClient extends Client {
        config;
        constructor(...[configuration]) {
            const _config_0 = getRuntimeConfig(configuration || {});
            super(_config_0);
            this.initConfig = _config_0;
            const _config_1 = resolveClientEndpointParameters(_config_0);
            const _config_2 = resolveUserAgentConfig(_config_1);
            const _config_3 = resolveRetryConfig(_config_2);
            const _config_4 = resolveRegionConfig(_config_3);
            const _config_5 = resolveHostHeaderConfig(_config_4);
            const _config_6 = resolveEndpointConfig(_config_5);
            const _config_7 = resolveEventStreamSerdeConfig(_config_6);
            const _config_8 = resolveHttpAuthSchemeConfig(_config_7);
            const _config_9 = resolveEventStreamConfig(_config_8);
            const _config_10 = resolveWebSocketConfig(_config_9);
            const _config_11 = resolveRuntimeExtensions(_config_10, configuration?.extensions || []);
            this.config = _config_11;
            this.middlewareStack.use(getSchemaSerdePlugin(this.config));
            this.middlewareStack.use(getUserAgentPlugin(this.config));
            this.middlewareStack.use(getRetryPlugin(this.config));
            this.middlewareStack.use(getContentLengthPlugin(this.config));
            this.middlewareStack.use(getHostHeaderPlugin(this.config));
            this.middlewareStack.use(getLoggerPlugin(this.config));
            this.middlewareStack.use(getRecursionDetectionPlugin(this.config));
            this.middlewareStack.use(getHttpAuthSchemeEndpointRuleSetPlugin(this.config, {
                httpAuthSchemeParametersProvider: defaultTranscribeStreamingHttpAuthSchemeParametersProvider,
                identityProviderConfigProvider: async (config) => new DefaultIdentityProviderConfig({
                    "aws.auth#sigv4": config.credentials,
                }),
            }));
            this.middlewareStack.use(getHttpSigningPlugin(this.config));
        }
        destroy() {
            super.destroy();
        }
    }

    const command = makeBuilder(commonParams, "Transcribe", "TranscribeStreamingClient", getEndpointPlugin);
    const _ep0 = {};
    const _mw1 = (Command, cs, config, o) => [
        getEventStreamPlugin(config),
        getWebSocketPlugin(config, {
            headerPrefix: "x-amzn-transcribe-",
        }),
        getTranscribeStreamingPlugin(config),
    ];

    class StartStreamTranscriptionCommand extends command(_ep0, _mw1, "StartStreamTranscription", StartStreamTranscription$) {
    }

    const TARGET_SAMPLE_RATE = 16000;
    class AwsSpeechRecognizer {
        constructor(accessKeyId, secretAccessKey, region, sessionToken, recoLanguage) {
            this.accessKeyId = accessKeyId;
            this.secretAccessKey = secretAccessKey;
            this.sessionToken = sessionToken;
            this.region = region;
            this.languageCode = (recoLanguage ?? 'en-US');
            this.client = new TranscribeStreamingClient({
                region: this.region,
                credentials: {
                    accessKeyId: this.accessKeyId,
                    secretAccessKey: this.secretAccessKey,
                    sessionToken: this.sessionToken,
                },
            });
            this.isListening = false;
            this.recoStart = new Date();
            this.mediaStream = null;
            this.audioContext = null;
            this.processorNode = null;
            this.sourceNode = null;
            this.audioQueue = [];
            this.audioQueueResolve = null;
            this.audioStreamDone = false;
            this.abortController = null;
        }
        async recognizeOnce(maxRetries) {
            const delay = 250;
            if (!maxRetries) {
                maxRetries = 2000 / delay;
            }
            for (let i = 0; i < maxRetries; i++) {
                try {
                    const result = await this.trySingleReco();
                    return result;
                }
                catch (_e) {
                }
                if (i < maxRetries - 1) {
                    await new Promise((r) => setTimeout(r, delay));
                }
            }
            const err = new Error('Failed to recognize speech');
            this.onError?.call(this, err);
            throw err;
        }
        async trySingleReco() {
            this.recoStart = new Date();
            await this.startMicrophone();
            const audioStream = this.createAudioStream();
            const command = new StartStreamTranscriptionCommand({
                LanguageCode: this.languageCode,
                MediaEncoding: 'pcm',
                MediaSampleRateHertz: TARGET_SAMPLE_RATE,
                AudioStream: audioStream,
            });
            try {
                this.abortController = new AbortController();
                const response = await this.client.send(command, {
                    abortSignal: this.abortController.signal,
                });
                if (!response.TranscriptResultStream) {
                    this.cleanup();
                    return null;
                }
                for await (const event of response.TranscriptResultStream) {
                    if (event.TranscriptEvent) {
                        const results = event.TranscriptEvent.Transcript?.Results ?? [];
                        for (const result of results) {
                            if (result.IsPartial) {
                                const snippet = (result.Alternatives ?? [])
                                    .map((alt) => (alt.Items ?? []).map((it) => it.Content).join(' '))
                                    .join(' ');
                                this.onRecognizing?.call(this, snippet);
                            }
                            else {
                                const recoResult = this.convertResult(result);
                                this.onRecognized?.call(this, recoResult);
                                this.cleanup();
                                return recoResult;
                            }
                        }
                    }
                }
                this.cleanup();
                return null;
            }
            catch (e) {
                this.cleanup();
                throw e;
            }
        }
        startRecognizing() {
            if (this.isListening) {
                return;
            }
            this.isListening = true;
            this.recoStart = new Date();
            this.runContinuousRecognition().catch((e) => {
                this.isListening = false;
                if (this.onError) {
                    this.onError.call(this, e instanceof Error ? e : new Error(String(e)));
                }
                else {
                    this.onRecognized?.call(this, null);
                }
            });
        }
        async runContinuousRecognition() {
            await this.startMicrophone();
            const audioStream = this.createAudioStream();
            const command = new StartStreamTranscriptionCommand({
                LanguageCode: this.languageCode,
                MediaEncoding: 'pcm',
                MediaSampleRateHertz: TARGET_SAMPLE_RATE,
                AudioStream: audioStream,
            });
            this.abortController = new AbortController();
            const response = await this.client.send(command, {
                abortSignal: this.abortController.signal,
            });
            if (!response.TranscriptResultStream) {
                this.cleanup();
                return;
            }
            try {
                for await (const event of response.TranscriptResultStream) {
                    if (!this.isListening)
                        break;
                    if (event.TranscriptEvent) {
                        const results = event.TranscriptEvent.Transcript?.Results ?? [];
                        for (const result of results) {
                            if (result.IsPartial) {
                                const snippet = (result.Alternatives ?? [])
                                    .map((alt) => (alt.Items ?? []).map((it) => it.Content).join(' '))
                                    .join(' ');
                                this.onRecognizing?.call(this, snippet);
                            }
                            else {
                                const recoResult = this.convertResult(result);
                                this.onRecognized?.call(this, recoResult);
                            }
                        }
                    }
                }
            }
            catch (e) {
                if (e.name !== 'AbortError') {
                    throw e;
                }
            }
            finally {
                this.cleanup();
            }
        }
        stopRecognizing(wait) {
            if (wait && wait > 0) {
                setTimeout(() => this.doStop(), wait);
            }
            else {
                this.doStop();
            }
        }
        doStop() {
            this.isListening = false;
            this.audioStreamDone = true;
            if (this.audioQueueResolve) {
                this.audioQueueResolve();
                this.audioQueueResolve = null;
            }
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = null;
            }
            this.stopMicrophone();
        }
        async startMicrophone() {
            this.audioQueue = [];
            this.audioQueueResolve = null;
            this.audioStreamDone = false;
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            const bufferSize = 4096;
            this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
            this.processorNode.onaudioprocess = (event) => {
                if (this.audioStreamDone)
                    return;
                const inputData = event.inputBuffer.getChannelData(0);
                const pcm = this.pcmEncode(inputData);
                this.audioQueue.push(pcm);
                if (this.audioQueueResolve) {
                    this.audioQueueResolve();
                    this.audioQueueResolve = null;
                }
            };
            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);
        }
        stopMicrophone() {
            if (this.processorNode) {
                this.processorNode.disconnect();
                this.processorNode.onaudioprocess = null;
                this.processorNode = null;
            }
            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }
            if (this.audioContext) {
                this.audioContext.close().catch(() => { });
                this.audioContext = null;
            }
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach((t) => t.stop());
                this.mediaStream = null;
            }
        }
        cleanup() {
            this.isListening = false;
            this.audioStreamDone = true;
            this.stopMicrophone();
        }
        pcmEncode(float32) {
            const buffer = new ArrayBuffer(float32.length * 2);
            const view = new DataView(buffer);
            for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
                view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            }
            return buffer;
        }
        createAudioStream() {
            const self = this;
            return (async function* () {
                while (!self.audioStreamDone) {
                    if (self.audioQueue.length === 0) {
                        await new Promise((resolve) => {
                            self.audioQueueResolve = resolve;
                        });
                    }
                    while (self.audioQueue.length > 0) {
                        const chunk = self.audioQueue.shift();
                        yield {
                            AudioEvent: {
                                AudioChunk: new Uint8Array(chunk),
                            },
                        };
                    }
                }
            })();
        }
        convertResult(result) {
            const alternatives = result.Alternatives ?? [];
            if (alternatives.length === 0)
                return null;
            const items = [];
            for (const alt of alternatives) {
                const text = (alt.Items ?? []).map((it) => it.Content).join(' ');
                const confidences = (alt.Items ?? [])
                    .map((it) => it.Confidence)
                    .filter((c) => c != null);
                const avgConfidence = confidences.length > 0
                    ? confidences.reduce((a, b) => a + b, 0) /
                        confidences.length
                    : 1.0;
                items.push(new SpeechRecoItem(text, avgConfidence));
            }
            const firstAlt = alternatives[0];
            const firstItems = firstAlt.Items ?? [];
            const startSec = firstItems.length > 0 && firstItems[0].StartTime != null
                ? firstItems[0].StartTime
                : 0;
            const endSec = firstItems.length > 0 &&
                firstItems[firstItems.length - 1].EndTime != null
                ? firstItems[firstItems.length - 1].EndTime
                : 0;
            const recoResult = new SpeechRecoResult();
            recoResult.startTime = new Date(this.recoStart.getTime() + startSec * 1000);
            recoResult.endTime = new Date(this.recoStart.getTime() + endSec * 1000);
            recoResult.results = items.sort((a, b) => b.confidence - a.confidence);
            const basicConversion = Array.from(items);
            for (const item of basicConversion) {
                if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z]$/) >= 0) {
                    const acronym = item.text.replace(/\s/g, '');
                    const conf = item.confidence * 0.9;
                    recoResult.results.push(new SpeechRecoItem(acronym, conf));
                }
                else if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z][a-zA-Z]+$/) >= 0) {
                    const parts = item.text.match(/^(([a-zA-Z]\s)+)([a-zA-Z][a-zA-Z]+)$/);
                    if (parts && parts.length === 4) {
                        const acronym = parts[1].replace(/\s/g, '');
                        const designator = parts[3];
                        const conf = item.confidence * 0.85;
                        recoResult.results.push(new SpeechRecoItem(acronym + ' ' + designator, conf));
                    }
                }
            }
            recoResult.results.sort((a, b) => b.confidence - a.confidence);
            return recoResult;
        }
    }
    class SpeechRecoResult {
        constructor() {
            this.results = [];
            this.startTime = new Date();
            this.endTime = new Date();
        }
    }
    class SpeechRecoItem {
        constructor(text, confidence) {
            this.text = text;
            this.confidence = confidence;
        }
    }

    exports.AwsSpeechRecognizer = AwsSpeechRecognizer;

}));

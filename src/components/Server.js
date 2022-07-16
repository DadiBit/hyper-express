const Route = require('./router/Route.js');
const Router = require('./router/Router.js');
const Stream = require('stream'); // lgtm [js/unused-local-variable]
const Request = require('./http/Request.js');
const Response = require('./http/Response.js');
const uWebSockets = require('uWebSockets.js');
const WebsocketRoute = require('./ws/WebsocketRoute.js');

const { wrap_object } = require('../shared/operators.js');

class Server extends Router {
    #uws_instance;
    #listen_socket;
    #options = {
        is_ssl: false,
        auto_close: true,
        fast_abort: false,
        trust_proxy: false,
        fast_buffers: false,
        max_body_length: 250 * 1000,
        streaming: {},
    };

    /**
     * @param {Object} options Server Options
     * @param {String=} options.cert_file_name Path to SSL certificate file.
     * @param {String=} options.key_file_name Path to SSL private key file to be used for SSL/TLS.
     * @param {String=} options.passphrase Strong passphrase for SSL cryptographic purposes.
     * @param {String=} options.dh_params_file_name Path to SSL Diffie-Hellman parameters file.
     * @param {Boolean=} options.ssl_prefer_low_memory_usage Specifies uWebsockets to prefer lower memory usage while serving SSL
     * @param {Boolean=} options.fast_buffers Buffer.allocUnsafe is used when set to true for faster performance.
     * @param {Boolean=} options.fast_abort Determines whether HyperExpress will abrubptly close bad requests. This can be much faster but the client does not receive an HTTP status code as it is a premature connection closure.
     * @param {Boolean=} options.trust_proxy Specifies whether to trust incoming request data from intermediate proxy(s)
     * @param {Number=} options.max_body_length Maximum body content length allowed in bytes. For Reference: 1kb = 1000 bytes and 1mb = 1000kb.
     * @param {Boolean=} options.auto_close Whether to automatically close the server instance when the process exits. Default: true
     * @param {Object} options.streaming Global content streaming options.
     * @param {Stream.ReadableOptions=} options.streaming.readable Global content streaming options for Readable streams.
     * @param {Stream.WritableOptions=} options.streaming.writable Global content streaming options for Writable streams.
     */
    constructor(options = {}) {
        // Only accept object as a parameter type for options
        if (options == null || typeof options !== 'object')
            throw new Error(
                'HyperExpress: HyperExpress.Server constructor only accepts an object type for the options parameter.'
            );

        // Initialize extended Router instance
        super();

        // Store options locally for access throughout processing
        wrap_object(this.#options, options);

        // Create underlying uWebsockets App or SSLApp to power HyperExpress
        const { cert_file_name, key_file_name } = options;
        this.#options.is_ssl = cert_file_name && key_file_name; // cert and key are required for SSL
        if (this.#options.is_ssl) {
            this.#uws_instance = uWebSockets.SSLApp(options);
        } else {
            this.#uws_instance = uWebSockets.App(options);
        }
    }

    /**
     * This object can be used to store properties/references local to this Server instance.
     */
    locals = {};

    /**
     * @private
     * This method binds a cleanup handler which automatically closes this Server instance.
     */
    _bind_auto_close() {
        const reference = this;
        ['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM'].forEach((type) =>
            process.once(type, () => reference.close())
        );
    }

    /**
     * Starts HyperExpress webserver on specified port and host.
     *
     * @param {Number} port
     * @param {String=} host Optional. Default: 0.0.0.0
     * @returns {Promise} Promise
     */
    listen(port, host = '0.0.0.0') {
        const reference = this;
        return new Promise((resolve, reject) =>
            reference.#uws_instance.listen(host, port, (listen_socket) => {
                if (listen_socket) {
                    // Store the listen socket for future closure & bind the auto close handler if enabled from constructor options
                    reference.#listen_socket = listen_socket;
                    if (reference.#options.auto_close) reference._bind_auto_close();
                    resolve(listen_socket);
                } else {
                    reject('No Socket Received From uWebsockets.js');
                }
            })
        );
    }

    /**
     * Stops/Closes HyperExpress webserver instance.
     *
     * @param {uWebSockets.us_listen_socket=} [listen_socket] Optional
     * @returns {Boolean}
     */
    close(listen_socket) {
        // Fall back to self listen socket if none provided by user
        const socket = listen_socket || this.#listen_socket;
        if (socket) {
            // Close the listen socket from uWebsockets and nullify the reference
            uWebSockets.us_listen_socket_close(socket);
            this.#listen_socket = null;
            return true;
        }
        return false;
    }

    #routes_locked = false;
    #handlers = {
        on_not_found: null,
        on_error: (request, response, error) => {
            // Throw on default if user has not bound an error handler
            response.status(500).send('HyperExpress: Uncaught Exception Occured');
            throw error;
        },
    };

    /**
     * @typedef RouteErrorHandler
     * @type {function(Request, Response, Error):void}
     */

    /**
     * Sets a global error handler which will catch most uncaught errors across all routes/middlewares.
     *
     * @param {RouteErrorHandler} handler
     */
    set_error_handler(handler) {
        if (typeof handler !== 'function') throw new Error('HyperExpress: handler must be a function');
        this.#handlers.on_error = handler;
    }

    /**
     * @typedef RouteHandler
     * @type {function(Request, Response):void}
     */

    /**
     * Sets a global not found handler which will handle all requests that are unhandled by any registered route.
     * Note! This handler must be registered after all routes and routers.
     *
     * @param {RouteHandler} handler
     */
    set_not_found_handler(handler) {
        if (typeof handler !== 'function') throw new Error('HyperExpress: handler must be a function');

        // Store not_found handler and bind it as a catchall route
        if (this.#handlers.on_not_found === null) {
            this.#handlers.on_not_found = handler;
            return setTimeout(
                (reference) => {
                    reference.any('/*', (request, response) => reference.#handlers.on_not_found(request, response));
                    reference.#routes_locked = true;
                },
                0,
                this
            );
        }

        // Do not allow user to re-register not found handler
        throw new Error('HyperExpress: A Not Found handler has already been registered.');
    }

    /**
     * Publish a message to a topic in MQTT syntax to all WebSocket connections on this Server instance.
     * You cannot publish using wildcards, only fully specified topics.
     *
     * @param {String} topic
     * @param {String|Buffer|ArrayBuffer} message
     * @param {Boolean=} is_binary
     * @param {Boolean=} compress
     * @returns {Boolean}
     */
    publish(topic, message, is_binary, compress) {
        return this.#uws_instance.publish(topic, message, is_binary, compress);
    }

    /**
     * Returns the number of subscribers to a topic across all WebSocket connections on this Server instance.
     *
     * @param {String} topic
     * @returns {Number}
     */
    num_of_subscribers(topic) {
        return this.#uws_instance.numSubscribers(topic);
    }

    /* Server Routes & Middlewares Logic */

    #middlewares = {
        '/': [], // This will contain global middlewares
    };

    #routes = {
        any: {},
        get: {},
        post: {},
        del: {},
        head: {},
        options: {},
        patch: {},
        put: {},
        trace: {},
        upgrade: {},
        ws: {},
    };

    /**
     * Binds route to uWS server instance and begins handling incoming requests.
     *
     * @private
     * @param {Object} record { method, pattern, options, handler }
     */
    _create_route(record) {
        // Destructure record into route options
        const reference = this;
        const { method, pattern, options, handler } = record;

        // Do not allow route creation once it is locked after a not found handler has been bound
        if (this.#routes_locked === true)
            throw new Error(
                `HyperExpress: Routes/Routers must not be created or used after the set_not_found_handler() has been set due to uWebsockets.js's internal router not allowing for this to occur. [${method.toUpperCase()} ${pattern}]`
            );

        // Do not allow duplicate routes for performance/stability reasons
        // We make an exception for 'upgrade' routes as they must replace the default route added by WebsocketRoute
        if (method !== 'upgrade' && this.#routes[method]?.[pattern])
            throw new Error(
                `HyperExpress: Failed to create route as duplicate routes are not allowed. Ensure that you do not have any routers or routes that try to handle requests at the same pattern. [${method.toUpperCase()} ${pattern}]`
            );

        // Process and combine middlewares for routes that support middlewares
        if (!['ws'].includes(method)) {
            // Initialize route-specific middlewares if they do not exist
            if (!Array.isArray(options.middlewares)) options.middlewares = [];

            // Parse middlewares that apply to this route based on execution pattern
            const middlewares = [];
            Object.keys(this.#middlewares).forEach((match) => {
                // Do not match with global middlewares as they are always executed separately
                if (match == '/') return;

                // Store middleware if its execution pattern matches our route pattern
                if (pattern.startsWith(match))
                    reference.#middlewares[match].forEach((object) => middlewares.push(object));
            });

            // Map all user specified route specific middlewares with a priority of 2
            options.middlewares = options.middlewares.map((middleware) => ({
                priority: 2,
                middleware,
            }));

            // Combine matched middlewares with route middlewares
            options.middlewares = middlewares.concat(options.middlewares);
        }

        // Create a Route object to contain route information through handling process
        const route = new Route({
            app: this,
            method,
            pattern,
            options,
            handler,
        });

        // Mark route as temporary if specified from options
        if (options._temporary === true) route._temporary = true;

        // Handle websocket/upgrade routes separately as they follow a different lifecycle
        switch (method) {
            case 'ws':
                // Create a WebsocketRoute which initializes uWS.ws() route
                this.#routes[method][pattern] = new WebsocketRoute({
                    app: this,
                    pattern,
                    handler,
                    options,
                });
                break;
            case 'upgrade':
                // Throw an error if an upgrade route already exists that was not created by WebsocketRoute
                const current = this.#routes[method][pattern];
                if (current && current._temporary !== true)
                    throw new Error(
                        `HyperExpress: Failed to create upgrade route as an upgrade route with the same pattern already exists and duplicate routes are not allowed. [${method.toUpperCase()} ${pattern}]`
                    );

                // Overwrite the upgrade route that exists from WebsocketRoute with this custom route
                this.#routes[method][pattern] = route;

                // Assign route to companion WebsocketRoute
                const companion = this.#routes['ws'][pattern];
                if (companion) companion._set_companion_route(route);
                break;
            default:
                // Store route in routes object for structural tracking
                this.#routes[method][pattern] = route;

                // Bind uWS.method() route which passes incoming request/respone to our handler
                return this.#uws_instance[method](pattern, (response, request) =>
                    this._handle_uws_request(route, request, response, null)
                );
        }
    }

    /**
     * Binds middleware to server instance and distributes over all created routes.
     *
     * @private
     * @param {Object} record
     */
    _create_middleware(record) {
        // Destructure record from Router
        const reference = this;
        const { pattern, middleware } = record;

        // Initialize middlewares array for specified pattern
        if (this.#middlewares[pattern] == undefined) this.#middlewares[pattern] = [];

        // Create a middleware object with an appropriate priority
        const object = {
            priority: pattern == '/' ? 0 : 1, // 0 priority are global middlewares
            middleware,
        };

        // Store middleware object in its pattern branch
        this.#middlewares[pattern].push(object);

        // Inject middleware into all routes that match its execution pattern if it is non global
        const match = pattern.endsWith('/') ? pattern.substr(0, pattern.length - 1) : pattern;
        if (object.priority !== 0)
            Object.keys(this.#routes).forEach((method) => {
                // Ignore ws routes as they are WebsocketRoute components
                if (method === 'ws') return;

                // Match middleware pattern against all routes with this method
                const routes = reference.#routes[method];
                Object.keys(routes).forEach((pattern) => {
                    // If route's pattern starts with middleware pattern, then use middleware
                    if (pattern.startsWith(match)) routes[pattern].use(object);
                });
            });
    }

    /* uWS -> Server Request/Response Handling Logic */

    /**
     * This method is used to handle incoming requests from uWS and pass them to the appropriate route through the HyperExpress request lifecycle.
     *
     * @private
     * @param {Route} route
     * @param {uWebSockets.HttpRequest} uws_request
     * @param {uWebSockets.HttpResponse} uws_response
     * @param {uWebSockets.us_socket_context_t=} socket
     */
    _handle_uws_request(route, uws_request, uws_response, socket) {
        // Wrap uWS.Request -> HyperExpress.Request
        const request = new Request(route, uws_request, uws_response);

        // Wrap uWS.Response -> HyperExpress.Response
        const response = new Response(route, request, uws_response, socket);

        // Bind a 'limit' event handler which will send the appropriate response if the request body size exceeds the limit
        request.on('limit', (received_bytes, flushed) => {
            // Determine if the response has not been initiated yet
            if (!response.initiated) {
                // Abort the request instantly as user has specified usage of fast abort
                if (route.app._options.fast_abort) {
                    response.close();
                } else if (flushed) {
                    // Send a 413 response if the incoming data has been flushed
                    response.status(413).send();
                }
            }
        });

        // Stream any incoming request body data with configured limit
        // Use the route-specific max body length if it is set else use the global max body length
        if (request._stream_with_limit(route.max_body_length)) {
            // Chain incoming request/response through all global/local/route-specific middlewares
            route.app._chain_middlewares(route, request, response);
        }
    }

    /**
     * This method chains a request/response through all middlewares and then calls route handler in end.
     *
     * @private
     * @param {Route} route - Route Object
     * @param {Request} request - Request Object
     * @param {Response} response - Response Object
     * @param {Error} error - Error or Extended Error Object
     */
    _chain_middlewares(route, request, response, cursor = 0, error) {
        // Break chain if response has been aborted
        if (response.aborted) return;

        // Trigger error handler if an error was provided by a middleware
        if (error instanceof Error) return response.throw(error);

        // Determine next callback based on if either global or route middlewares exist
        const has_global_middlewares = this.#middlewares['/'].length > 0;
        const has_route_middlewares = route.options.middlewares.length > 0;
        const next =
            has_global_middlewares || has_route_middlewares
                ? (err) => route.app._chain_middlewares(route, request, response, cursor + 1, err)
                : undefined;

        // Execute global middlewares first as they take precedence over route specific middlewares
        if (has_global_middlewares) {
            // Determine current global middleware and execute
            const object = this.#middlewares['/'][cursor];
            if (object) {
                // If middleware invocation returns a Promise, bind a then handler to trigger next iterator
                response._track_middleware_cursor(cursor);
                const output = object.middleware(request, response, next);
                if (output instanceof Promise) output.then(next).catch(next);
                return;
            }
        }

        // Execute route specific middlewares if they exist
        if (has_route_middlewares) {
            // Determine current route specific/method middleware and execute while accounting for global middlewares cursor offset
            const object = route.options.middlewares[cursor - this.#middlewares['/'].length];
            if (object) {
                // If middleware invocation returns a Promise, bind a then handler to trigger next iterator
                response._track_middleware_cursor(cursor);
                const output = object.middleware(request, response, next);
                if (output instanceof Promise) output.then(next).catch(next);
                return;
            }
        }

        // Safely execute the user provided route handler
        try {
            // If route handler returns a Promise, bind a catch handler to trigger the error handler
            const output = route.handler(request, response, response.upgrade_socket);
            if (output instanceof Promise)
                output.catch((error) => {
                    // If the error is not an instance of Error, wrap it in an Error object that
                    if (!(error instanceof Error)) error = new Error(`ERR_CAUGHT_NON_ERROR_TYPE: ${error}`);

                    // Trigger the error handler
                    response.throw(error);
                });
        } catch (error) {
            // Wrap the error in an Error object if it is not already one
            if (!(error instanceof Error)) error = new Error(`ERR_CAUGHT_NON_ERROR_TYPE: ${error}`);

            // Trigger the error handler
            response.throw(error);
        }
    }

    /* Safe Server Getters */

    /**
     * Underlying uWS instance.
     * @returns {uWebSockets.us_listen_socket}
     */
    get uws_instance() {
        return this.#uws_instance;
    }

    /**
     * Server instance options.
     * @returns {Object}
     */
    get _options() {
        return this.#options;
    }

    /**
     * Server instance global handlers.
     * @returns {Object}
     */
    get handlers() {
        return this.#handlers;
    }

    /**
     * Server instance routes.
     * @returns {Object}
     */
    get routes() {
        return this.#routes;
    }

    /**
     * Server instance middlewares.
     * @returns {Object}
     */
    get middlewares() {
        return this.#middlewares;
    }
}

module.exports = Server;

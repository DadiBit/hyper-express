import { ReadableOptions } from 'stream';
import { Request } from '../http/Request';
import { Response } from '../http/Response';
import { Websocket } from '../ws/Websocket';
import { MiddlewareHandler } from '../middleware/MiddlewareHandler';

// Define types for HTTP Route Creators
export type UserRouteHandler = (request: Request, response: Response) => void;
export interface UserRouteOptions {
    middlewares?: Array<MiddlewareHandler>,
    stream_options?: ReadableOptions,
    max_body_length?: number
}

// Define types for Websocket Route Creator
export type WSRouteHandler = (websocket: Websocket) => void;
export interface WSRouteOptions {
    message_type?: "String" | "Buffer" | "ArrayBuffer",
    idle_timeout?: number,
    max_backpressure?: number,
    max_payload_length?: number
}

// Define types for internal route/middleware records
export interface RouteRecord {
    method: string,
    pattern: string,
    options: UserRouteOptions | WSRouteOptions,
    handler: UserRouteHandler
}

export interface MiddlewareRecord {
    pattern: string,
    middleware: MiddlewareHandler
}

export class Router {
    constructor()

    /**
     * Registers a middleware/router with specified path.
     *
     * @param {String|MiddlewareHandler|Router} pattern
     * @param {MiddlewareHandler|Router} handler (request, response, next) => {} OR (request, response) => new Promise((resolve, reject) => {})
     */
    use(handler: MiddlewareHandler | Router): void;
    use(pattern: string, handler: MiddlewareHandler | Router): void;

    /**
     * Creates an HTTP route that handles any HTTP method requests.
     * Note! ANY routes do not support route specific middlewares.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    any(pattern: string, handler: UserRouteHandler): void;
    any(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    any(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    any(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles GET method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    get(pattern: string, handler: UserRouteHandler): void;
    get(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    get(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    get(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles POST method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    post(pattern: string, handler: UserRouteHandler): void;
    post(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    post(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    post(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles PUT method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    put(pattern: string, handler: UserRouteHandler): void;
    put(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    put(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    put(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles DELETE method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    delete(pattern: string, handler: UserRouteHandler): void;
    delete(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    delete(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    delete(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles HEAD method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    head(pattern: string, handler: UserRouteHandler): void;
    head(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    head(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    head(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles OPTIONS method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    options(pattern: string, handler: UserRouteHandler): void;
    options(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    options(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    options(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles PATCH method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    patch(pattern: string, handler: UserRouteHandler): void;
    patch(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    patch(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    patch(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles TRACE method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    trace(pattern: string, handler: UserRouteHandler): void;
    trace(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    trace(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    trace(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Creates an HTTP route that handles CONNECT method requests.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    connect(pattern: string, handler: UserRouteHandler): void;
    connect(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    connect(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    connect(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * Intercepts and handles upgrade requests for incoming websocket connections.
     * Note! You must call response.upgrade(data) at some point in this route to open a websocket connection.
     *
     * @param {String} pattern
     * @param {RouteOptions|Array<MiddlewareHandler>|MiddlewareHandler|RouteHandler} options
     * @param {RouteHandler} handler
     */
    upgrade(pattern: string, handler: UserRouteHandler): void;
    upgrade(pattern: string, options: UserRouteOptions, handler: UserRouteHandler): void;
    upgrade(pattern: string, middleware: MiddlewareHandler, handler: UserRouteHandler): void;
    upgrade(pattern: string, middlewares: MiddlewareHandler[], handler: UserRouteHandler): void;

    /**
     * @param {String} pattern
     * @param {WSRouteOptions|WSRouteHandler} options
     * @param {WSRouteHandler} handler
     */
    ws(pattern: string, handler: WSRouteHandler): void;
    ws(pattern: string, options: WSRouteOptions, handler: WSRouteHandler): void;

    /**
     * Returns All routes in this router in the order they were registered.
     * @returns {Array}
     */
    get routes(): Array<RouteRecord>;

    /**
     * Returns all middlewares in this router in the order they were registered.
     * @returns {Array}
     */
    get middlewares(): Array<MiddlewareRecord>;
}
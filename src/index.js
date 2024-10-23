/* eslint-env worker */
import {
  withContext,
  withCorsHeaders,
  withContentDispositionHeader,
  withErrorHandler,
  createWithHttpMethod,
  withCdnCache,
  withParsedIpfsUrl,
  withFixedLengthStream,
  composeMiddleware
} from '@web3-storage/gateway-lib/middleware'
import {
  handleUnixfs,
  handleBlock,
  handleCar
} from '@web3-storage/gateway-lib/handlers'
import {
  withContentClaimsDagula,
  withVersionHeader,
  withAuthToken,
  withCarBlockHandler,
  withRateLimit
} from './middleware/index.js'

/**
 * @import {
 *   Handler,
 *   Middleware,
 *   Context,
 *   IpfsUrlContext,
 *   BlockContext,
 *   DagContext,
 *   UnixfsContext
 * } from '@web3-storage/gateway-lib'
 * @import { Environment } from './bindings.js'
 */

export default {
  /** @type {Handler<Context, Environment>} */
  fetch (request, env, ctx) {
    console.log(request.method, request.url)
    const middleware = composeMiddleware(
      // Prepare the Context
      withCdnCache,
      withContext,
      withCorsHeaders,
      withVersionHeader,
      withErrorHandler,
      withParsedIpfsUrl,
      createWithHttpMethod('GET', 'HEAD'),
      withAuthToken,

      // Rate-limit requests
      withRateLimit,

      // Fetch data
      withCarBlockHandler,
      withContentClaimsDagula,
      withFormatRawHandler,
      withFormatCarHandler,

      // Prepare the Response
      withContentDispositionHeader,
      withFixedLengthStream
    )
    return middleware(handleUnixfs)(request, env, ctx)
  }
}

/**
 * @type {Middleware<BlockContext & UnixfsContext & IpfsUrlContext, BlockContext & UnixfsContext & IpfsUrlContext, Environment>}
 */
export function withFormatRawHandler (handler) {
  return async (request, env, ctx) => {
    const { headers } = request
    const { searchParams } = ctx
    if (!searchParams) throw new Error('missing URL search params')
    if (
      searchParams.get('format') === 'raw' ||
      headers.get('Accept')?.includes('application/vnd.ipld.raw')
    ) {
      return await handleBlock(request, env, ctx)
    }
    return handler(request, env, ctx) // pass to other handlers
  }
}

/**
 * @type {Middleware<DagContext & IpfsUrlContext, DagContext & IpfsUrlContext, Environment>}
 */
export function withFormatCarHandler (handler) {
  return async (request, env, ctx) => {
    const { headers } = request
    const { searchParams } = ctx
    if (!searchParams) throw new Error('missing URL search params')
    if (
      searchParams.get('format') === 'car' ||
      headers.get('Accept')?.includes('application/vnd.ipld.car')
    ) {
      return await handleCar(request, env, ctx)
    }
    return handler(request, env, ctx) // pass to other handlers
  }
}

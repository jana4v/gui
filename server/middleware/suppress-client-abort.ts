/**
 * Suppresses ECONNABORTED / ECONNRESET / EPIPE errors that arise when a
 * browser client disconnects while Nitro's dev-proxy is still streaming a
 * backend response.  Without this handler those errors become unhandled
 * Promise rejections which cause Nuxt to restart the dev server every ~20s.
 */
export default defineEventHandler((event) => {
  const socket = event.node.req.socket
  if (!socket) return

  const suppressConnectionError = (err: NodeJS.ErrnoException) => {
    if (
      err.code === 'ECONNABORTED' ||
      err.code === 'ECONNRESET' ||
      err.code === 'EPIPE'
    ) {
      // Client closed the connection before we finished writing — not fatal.
      return
    }
    // Re-emit other socket errors so they are still visible.
    socket.emit('error', err)
  }

    // Use EventEmitter.listenerCount if available (real sockets); mock sockets
    // (used during SSR error rendering) may not have this method.
    const hasHandler = typeof socket.listenerCount === 'function'
      ? socket.listenerCount('error') > 0
      : typeof (socket as any)._events?.error !== 'undefined'

    if (!hasHandler && typeof socket.on === 'function') {
      socket.on('error', suppressConnectionError)
    }
})

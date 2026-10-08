class WebSocketTeste {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3
  readyState = 0
  url = ''
  protocol = ''
  binaryType = 'blob'
  bufferedAmount = 0
  extensions = ''
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true
  }
}

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocketTeste as unknown as typeof WebSocket
}

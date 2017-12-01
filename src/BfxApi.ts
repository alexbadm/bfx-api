import ActionsStack from './ActionsStack'
import Expectations from './Expectations'
import config from './config'

const allowedVersions = config.BitfinexAPIVersions
const bfxApi = config.BitfinexDefaultAPIUrl

interface wsOnOpen {
  (this: WebSocket, ev: Event): any
}

class BfxApi {
  apiKey: string
  apiSecret: string
  url: string

  log: Function
  debug: Function
  error: Function

  paused: boolean
  resumeStack: ActionsStack
  pingCounter: number

  expectations: Expectations
  subscribed: Array<Object>
  ws: WebSocket

  constructor (params: Object) {
    this.apiKey = params && params.apiKey
    this.apiSecret = params && params.apiSecret
    this.url = (params && params.url) || bfxApi

    const logger = (params && params.logger) || window.console
    this.log = logger.log || window.console.log
    this.debug = logger.debug || this.log
    this.error = logger.error || this.log

    this.paused = false
    this.resumeStack = new ActionsStack()
    this.pingCounter = 0

    this.expectations = new Expectations()
    this.subscribed = []

    this.auth = this.auth.bind(this)
    this.close = this.close.bind(this)
    this.connect = this.connect.bind(this)
    this.ping = this.ping.bind(this)
    this.restart = this.restart.bind(this)
  }

  connect () {
    this.debug('connect')
    this.expectations.add((msg) => msg.event === 'info' && msg.version).process(msg => {
      this.debug('msg.version', msg.version)
      if (allowedVersions.indexOf(msg.version) === -1) {
        this.error('unexpected version', msg.version)
        this.error('closing socket')
        this.ws.close()
      }
    })

    this.ws = new WebSocket(this.url)
    this.ws.onmessage = this.handleMessage.bind(this)
  }

  close () {
    this.log('closing socket')
    this.ws.close()
  }

  set onopen (openFunc: wsOnOpen) {
    this.ws.onopen = openFunc
  }

  auth () {
    if (this.paused) {
      this.resumeStack.add(this.auth)
      return
    }
    this.log('auth not implemented')
  }

  handleMessage (rawMsg: MessageEvent) {
    const msg = JSON.parse(rawMsg.data)

    if (this.expectations.exec(msg)) {
      return
    }

    switch (msg.event) {
      case 'info':
        this.processMsgInfo(msg)
        break

      case 'subscribed':
        this.processMsgSubscribed(msg)
        break

      case 'unsubscribed':
        this.processMsgUnsubscribed(msg)
        break

      default:
        this.debug('unprocessed message', msg)
    }
  }

  processMsgInfo (msg) {
    this.debug('info message', msg)

    switch (msg.code) {
      case 20051:
        this.restart()
        break
      case 20060:
        this.pause()
        break
      case 20061:
        this.resume()
        break
      default:
        console.log('unknown info message code', msg.code)
    }
  }

  pause () {
    this.debug('pause')
    this.paused = true
  }

  resume () {
    this.debug('resume')
    this.paused = false
    this.resumeStack.fire()
  }

  restart () {
    this.debug('restart')
    this.close()
    this.connect()
  }

  ping () {
    if (this.paused) {
      this.resumeStack.add(this.ping)
      return
    }
    const cid = ++this.pingCounter
    this.expectations.add(msg => msg.event === 'pong' && msg.cid === cid).process(({ ts }) => {
      this.log('proper ping/pong, ts is', ts)
    })
    this.send(JSON.stringify({ cid, event: 'ping' }))
  }

  send (data) {
    if (this.paused) {
      this.resumeStack.add(this.send.bind(this, data))
      return
    }
    if (this.ws.readyState !== window.WebSocket.OPEN) {
      this.error('ws is not ready')
      return
    }
    if (typeof data !== 'string') {
      data = JSON.stringify(data)
    }
    this.ws.send(data)
  }

  subscribe (channel: string, params: Object) {
    const event = 'subscribe'
    this.send({ event, channel, ...params })
  }

  processMsgSubscribed (data) {
    this.subscribed.push(data)
    this.debug('subscribed', this.subscribed)
  }

  ubsubscribe (chanId: number) {
    const event = 'unsubscribe'
    this.send({ event, chanId })
  }

  processMsgUnsubscribed (data: Object) {
    this.subscribed = this.subscribed.filter((subs: Object) => subs.chanId !== data.chanId)
    this.debug('unsubscribed')
    this.debug('subscribed', this.subscribed)
  }

  subscribeTicker (pair: string) {
    this.subscribe('ticker', { symbol: 't' + pair })
  }

  subscribeFTicker (pair: string) {
    this.subscribe('fticker', { symbol: 'f' + pair })
  }

  subscribeTrades (pair: string) {
    this.subscribe('trades', { symbol: 't' + pair })
  }

  subscribeFTrades (pair: string) {
    this.subscribe('trades', { symbol: 'f' + pair })
  }

  subscribeBooks (pair: string) {
    this.subscribe('book', { symbol: 't' + pair })
  }

  subscribeRawBooks (pair: string) {
    this.subscribe('book', { symbol: 't' + pair, prec: 'R0' })
  }

  subscribeCandles (pair: string, timeFrame = '1m') {
    this.subscribe('candles', { key: `trade:${timeFrame}:t${pair}` })
  }
}

export default BfxApi
